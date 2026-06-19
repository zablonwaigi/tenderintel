# REPO_AUDIT_FINDINGS.md

**STEP 0 — Repo Audit (read-only). No code changed.**
**Date:** 2026-06-19 · **Branch:** `claude/elegant-shannon-ff1d34`
**Scope note:** Per the CONFIRMED FINDINGS in the task, `cipc` and `calculated_opportunities`
are out of scope (different project; never referenced in this repo's code) and Q1/Q2 are skipped.

**Evidence legend:** `[code]` proven from this repo · `[live]` requires a query against the
production Supabase (this sandbox has **no DB/network access** — those checks are delegated to
the web agent, with exact SQL/commands given below) · `[logic]` deduced from how the code +
OCDS data model must behave.

---

## 0. Critical context: the production DB has drifted from this repo's migrations

The repo's `supabase/migrations/` defines only **6 tables**:
`tenders`, `tender_documents`, `wiki_articles`, `ingestion_log`, `saved_searches`, `ocds_sync_cursor`. `[code]`

The audit reports **15 production tables**. The other 9 (`cipc`, `calculated_opportunities`,
`scraping_jobs`, `scraping_job_runs`, `scraping_errors`, `raw_scrape_data`,
`client_notifications_queue`, `data_quality_checks`, `opportunity_sync_log`) **do not appear in
any migration and are not referenced in code** (0 code refs each, verified by grep). `[code]`

**Implication (recurring theme):** the production schema was partly built outside these
migrations (manual SQL / a different project). Because the init migration uses
`create table if not exists`, any column added to that statement *after* the table already
existed in prod was silently skipped — this is the same drift that produced the
`ai_compliance` 404 (fixed in `20260617000000`) and the wiki `summary` bug (below). **Every
Phase-0/1 schema change must therefore use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` /
`CREATE TABLE IF NOT EXISTS`, never rely on editing an existing `create table`.**

---

## Q3 — Provenance of pre-2021 tenders (DB has data from 2012; OCDS starts Apr 2021)

**Answer: pre-2021 rows are portal-scraped and cannot carry an OCDS `ocid`.** `[logic][code]`

- The OCDS API's earliest release is `ocds-9t57fa-332` (2021-04-30) `[Research]`. Anything dated
  2012–2021 therefore **cannot** have come from OCDS and **cannot** have a real `ocid`.
- Two ingestion paths write to `tenders`:
  - `src/lib/pipeline/ocdsIngester.ts` → sets `ocid` (OCDS source, Apr 2021+ only). `[code]`
  - `src/lib/pipeline/portalIngester.ts` → maps `TENDERID`/`TENDERNUMBER` from the portal,
    **no `ocid`** (`mapPortalRecord`-style rows are keyed by portal id). `[code]`
- So pre-2021 tenders are **portal-sourced, low-trust, OCID-less** — exactly matching audit
  conflict C1. They will not dedup against OCDS rows and should be treated as legacy until/unless
  re-matched.

**`[live]` confirmation queries for the web agent:**
```sql
-- earliest dates and OCID coverage by era
select min(date_advertised), max(date_advertised) from tenders;
select count(*) filter (where ocid is not null) as with_ocid,
       count(*) filter (where ocid is null)     as without_ocid,
       count(*) filter (where date_advertised < '2021-04-30') as pre_ocds
from tenders;
-- spot the source of old rows
select sync_source, count(*) from tenders
where date_advertised < '2021-04-30' group by 1;   -- expect 'portal'/null, never 'ocds'
```
**Expected:** every pre-2021 row has `ocid IS NULL` and `sync_source <> 'ocds'`.

---

## Q5 — Is the `tender-documents` bucket private?

**Answer: the code always creates/normalises it as private (`public: false`); needs one live probe to confirm prod.** `[code]`

- `src/lib/pipeline/documentDownloader.ts` `ensureBucket()`:
  - On create: `createBucket(STORAGE_BUCKET, { public: false, ... })`. `[code]`
  - On an existing bucket: if it has a MIME allowlist it calls `updateBucket(..., { public: false, ... })`. `[code]`
- Documents are served via the app route `src/app/api/documents/[id]/download/route.ts` (signed
  access through the service client), consistent with a private bucket. `[code]`
- **Caveat:** if the bucket was created manually in the Supabase UI *before* this code ran,
  `ensureBucket()` only forces `public:false` when an allowlist is present — a manually-created
  **public** bucket with no allowlist would NOT be flipped. So a live check is still required.

**`[live]` confirmation for the web agent:**
```bash
# 1. Should be denied / not 200 for a raw object path:
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://<project>.supabase.co/storage/v1/object/public/tender-documents/<any/known/path>"
# 2. Authoritative — check the bucket flag:
#    Supabase Studio → Storage → tender-documents → should show "Private".
#    or SQL: select id, public from storage.buckets where id = 'tender-documents';
```
**Expected:** `storage.buckets.public = false`; the public URL returns 400/403/404, not 200.

---

## Q6 — Are the 7 `ocds_sync_cursor` rows duplicated?

**Answer: the migration seeds 6 distinct modes with a UNIQUE constraint, so true duplicates are impossible *if* the constraint exists in prod. The audit's "7 rows" is almost certainly 6 seeded + 1 legacy leftover, not a duplicate.** `[code]`

- `20260616000002_ocds_sync_rewrite.sql`: `sync_mode text unique not null`, seeded with
  `incremental, backfill, awarded, documents, download, portal` (6 rows) via
  `on conflict (sync_mode) do nothing`. `[code]`
- With the UNIQUE on `sync_mode`, you cannot get two rows for the same mode. A 7th row is most
  likely a pre-rewrite legacy mode (e.g. `closed`, `ocds`, or `full`) left behind — harmless but
  worth pruning.
- **Drift risk:** if the prod table predates the rewrite and the UNIQUE index was never actually
  created (same pattern as the `tenders_ocid_unique_idx` issue found earlier), duplicates *would*
  be possible. Confirm the constraint exists.

**`[live]` confirmation for the web agent:**
```sql
select sync_mode, count(*) from ocds_sync_cursor group by 1 having count(*) > 1;  -- expect 0 rows
select sync_mode, status, last_synced_date, last_page_number, updated_at
from ocds_sync_cursor order by sync_mode;                                          -- list all 7
-- confirm the UNIQUE actually exists:
select conname from pg_constraint
where conrelid = 'public.ocds_sync_cursor'::regclass and contype = 'u';
```
**Action if a stray legacy row exists:** `delete from ocds_sync_cursor where sync_mode in ('closed','ocds','full');`

---

## Portal-scraping code (the HTTP 405 source) — located + why it fails

There are **two** portal implementations in the repo:

| File | Method | Wired into | Status |
|---|---|---|---|
| `src/lib/pipeline/portalIngester.ts` | **POST** `/Home/PaginatedTenderOpportunities` | `runner.ts` → dashboard Server Actions + `/api/pipeline/run` | **THE 405 SOURCE** `[code]` |
| `src/app/api/cron/sync-tenders/portal-client.ts` | **GET** (DataTables querystring) | `sync-tenders` cron `?mode=portal` | Working rewrite `[code]` |

**Why the legacy one fails:** `portalIngester.ts:127` does `fetch(..., { method: "POST", ... })`.
The eTenders endpoint now **rejects POST with 405 (Allow: GET only)** — confirmed in earlier
live probing. The legacy ingester retries 3× then throws `Portal fetch failed after 3 attempts`,
so any dashboard "Run incremental"/"awarded"/"closed" action or `/api/pipeline/run` that routes
through `executeRun()` → `PortalIngester.ingestAll()` fails on the portal legs. `[code]`

It also still uses the **old field shape** (`TENDERID`, `Documents[]`, `StatusId`,
`searchPhrase`) which no longer matches the current portal response — a second reason it would
return nothing even if POST were allowed. `[code]`

**Disposition (matches RB1 / 0.9):** the modern GET `portal-client.ts` already replaces it for
the cron path. The legacy `portalIngester.ts` + its `runner.ts` wiring are the thing to
demote/disable in Step 1.

---

## Document-download code (the `docs_downloaded: 0` symptom) — located + why it failed

**File:** `src/lib/pipeline/documentDownloader.ts` (class `DocumentDownloader`). Invoked by the
`sync-tenders` cron `?mode=download` and the `/api/pipeline/documents` POST route. `[code]`

The audit's "0 downloads/run" reflects an **earlier state**; the current repo already contains
three fixes for the root causes that were diagnosed and pushed in prior sessions:

1. **Silent post-upload status-update failure** → rows stayed `pending` and every batch
   re-selected/re-uploaded the same rows. Fixed: `downloadOne()` now throws on the update error
   (`"status update failed: ..."`). `[code]`
2. **MIME allowlist rejecting `.doc`/`.xls`/`.zip`** (e.g. `application/msword`). Fixed:
   `ensureBucket()` clears the allowlist and `upload()` falls back to `application/octet-stream`. `[code]`
3. **Next.js patched-`fetch` caching PostgREST GETs** → `limit=500` pending-list reads were
   served from a stale cache, so the same "pending" set replayed forever. Fixed: service client
   forces `cache: "no-store"` and both cron routes set `fetchCache = "force-no-store"`. `[code]`

**Residual gaps vs. the schema proposal (to address in Phase 2, task 2.1):** no `sha256` hashing,
no per-attempt `document_downloads` log, no broken-URL capture into `crawl_errors`, and storage
path is still `active/{year}/{ocid}/...` (needs `{status}/{year}/{ocid}/raw/`). `[code]`

**`[live]` confirmation for the web agent:**
```sql
select download_status, count(*) from tender_documents group by 1;          -- watch 'downloaded' climb
select date_trunc('hour', downloaded_at) h, count(*) from tender_documents
where downloaded_at is not null group by 1 order by 1 desc limit 12;        -- recent throughput
```

---

## API routes, cron handlers, and the tables each writes to

**Auth status** (`isAuthorized` = CRON_SECRET bearer check; **no user-session auth anywhere** —
no `middleware.ts`, no `@supabase/ssr`/`getSession`/`signIn` in the codebase). `[code]`

| Route | Handler | Auth | Writes to | Notes |
|---|---|---|---|---|
| `/api/cron/sync-tenders` | GET | ✅ CRON_SECRET | `tenders`, `tender_documents`, `ocds_sync_cursor`, `ingestion_log` | Main spine; modes incremental/backfill/awarded/documents/download/ocds-full/portal/status |
| `/api/cron/sync-backfill` | GET | ✅ CRON_SECRET | `ingestion_log` (+ `tenders` via shared backfill engine) | One-shot historical backfill |
| `/api/pipeline/run` | POST | ✅ CRON_SECRET | `ingestion_log` (+ `tenders`/`tender_documents` via `executeRun`) | Routes through **legacy** ingesters (405 risk) |
| `/api/pipeline/documents` | POST | ✅ CRON_SECRET | `tender_documents` | Triggers `DocumentDownloader` |
| `/api/pipeline/status` | GET | ❌ **OPEN** | — (reads `ingestion_log`) | **0.4: needs gating** |
| `/api/tenders` | GET | ❌ **OPEN** | — (reads `tenders`) | **0.4: unbounded read, needs rate-limit/auth** |
| `/api/tenders/[id]` | GET | ❌ open | — (reads) | Detail fetch |
| `/api/documents/[id]/download` | GET | ❌ open | — (reads `tender_documents`, signs URL) | Serves a stored doc |
| `/api/wiki` | GET | ❌ open | `wiki_articles` (**upsert** — see below) | |
| `/api/admin/seed-wiki` | — | ⚠️ verify | `wiki_articles` | Admin seed |
| `/api/health` | GET | ❌ open | — | Healthcheck (intended public) |

**Dashboard (`src/app/dashboard/page.tsx`)** — server component with **unprotected Next.js
Server Actions** (`"use server"`): `runIncremental`, `downloadDocuments`, `parseDocuments`,
`analyseTenders`. Anyone who can load `/dashboard` can invoke these (they don't go through
`isAuthorized`). This is the critical RB2/0.1 hole and is the top Step-1 priority. `[code]`

---

## RLS (Q4 context — answered from migrations)

RLS is **enabled in the init migration** on the 6 repo-managed tables, but `tenders`,
`tender_documents`, `wiki_articles` carry a **`for select using (true)` public-read policy** —
i.e. the anon key can read all tender/document/wiki data by design. Writes are restricted to
`service_role`. `saved_searches` is owner-scoped. `[code]`

**The real exposure:** the ~9 non-migration prod tables have **unknown RLS state** (tables made
via the SQL editor default to **RLS disabled** unless explicitly enabled). Those — plus the
public-read policy on the core tables — are what Step-1 task 0.2 must verify and tighten.

**`[live]` confirmation for the web agent:**
```sql
select relname, relrowsecurity
from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relrowsecurity, relname;                       -- any 'f' = RLS OFF = exposed
select tablename, policyname, cmd, qual from pg_policies where schemaname='public' order by 1;
```

---

## `wiki_articles.summary` mismatch (0.7)

The init migration **does** define `summary text` (line 80), yet the audit reports the column
missing in prod. This is the **same `create table if not exists` drift** as `ai_compliance`: the
prod `wiki_articles` table pre-existed the migration, so `summary` was never added. `[code][logic]`
`src/lib/wiki/query.ts` selects/orders by it, so `/wiki` errors. **Fix in Step 1 with an
idempotent `ALTER TABLE wiki_articles ADD COLUMN IF NOT EXISTS summary text;`** (do not "fix the
query" — the column is genuinely used).

---

## Summary table — STEP 0 answers

| Item | Answer | Confidence |
|---|---|---|
| Q3 pre-2021 provenance | Portal-scraped, no OCID (OCDS starts Apr 2021) | `[logic][code]` high; `[live]` to quantify |
| Q5 bucket private | Code forces `public:false`; one manual-creation edge case → confirm live | `[code]` high |
| Q6 cursor duplicates | Impossible if UNIQUE present; 7th row = legacy leftover, not a dup | `[code]` high; `[live]` to confirm constraint |
| 405 source | `portalIngester.ts` (POST) via `runner.ts`/dashboard/`pipeline/run` | `[code]` certain |
| 0 downloads | Earlier bugs (silent update / MIME / fetch-cache) **already fixed** in repo; live count should be climbing | `[code]` high |
| Route→table map + auth gaps | Table above; `/dashboard` actions, `/api/tenders`, `/api/pipeline/status` are open | `[code]` certain |
| Schema drift | 9 prod tables + several columns exist outside migrations → use `IF NOT EXISTS` everywhere | `[code]` certain |

**Nothing in the codebase contradicts the plan's Option C.** No code was changed in STEP 0.
