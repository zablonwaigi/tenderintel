# TenderIntel → SMME Tender Workspace — UX Enhancement Blueprint

**Author:** Engineering · **Date:** 2026-06-23 · **Branch:** `claude/wizardly-davinci-ijzsn5`
**Status:** Proposed blueprint (no product code changed by this document)

> **Product thesis.** TenderIntel stops being "a search engine over 150k tenders" and
> becomes a **decision-and-execution workspace** for ordinary SA SMMEs:
> *match → understand → qualify → track deadlines → prepare the pack (or hand to GrowYourBiz).*
> The strategic moat is that GrowYourBiz already knows each client's real compliance
> state (CIPC, CSD, SARS TCS, B-BBEE, COIDA, CIDB), so matching is based on **what the
> business actually has**, not keywords.

---

## 0. What already exists (verified in code)

This blueprint is grounded in the current repo, not the public site alone.

| Area | Reality on disk | Implication |
|---|---|---|
| Framework | Next.js 14 App Router, Tailwind, TypeScript | Add new route groups; no migration off the stack. |
| Data | Supabase Postgres; **6 repo-managed tables** (`tenders`, `tender_documents`, `wiki_articles`, `ingestion_log`, `saved_searches`, `ocds_sync_cursor`) | New SMME tables are additive. |
| Auth | Supabase Auth **live but staff-only**; `src/middleware.ts` gates `/dashboard` + `/api/pipeline`; `saved_searches.user_id → auth.users` already exists | Client accounts reuse this — we add a *client* door, not a new auth system. |
| AI | `src/lib/pipeline/aiAnalyser.ts` — **Claude `claude-opus-4-8` primary**, OpenAI fallback; writes `ai_summary/ai_requirements/ai_keywords/ai_compliance` on `tenders` | The analysis engine exists; it needs **structured-field extension**, not a rebuild. |
| Security | Phase 0 done: RLS **deny-by-default**; only `tenders/tender_documents/wiki_articles` are anon-readable (`20260619000001_phase0_rls_all_tables.sql`) | **Every new SMME table MUST ship owner-scoped RLS** or it won't load in the browser. |
| Schema discipline | Prod drifted from migrations historically (`REPO_AUDIT_FINDINGS.md`) | Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` **always**. |
| Public UX | `src/app/page.tsx` hero = "Find & Win… search every tender"; stats = raw counts; nav = Tenders/Wiki/Learn/Dashboard(staff) | Repositioning + a client workspace shell are the front-end gaps. |

**Net read:** the data spine and AI plumbing are solid. The missing product is the
**client layer** — company profile, matching, pipeline, calendar, vault, escalation —
plus a repositioned front door. Roughly 70% of effort is *new client-facing* surface;
30% is *extending the existing tender analysis* into structured decision data.

---

## 1. Gap analysis (vision → concrete work)

| Vision capability | Today | Work item |
|---|---|---|
| "Which tenders are for me?" | Browse-all only | **Matching engine** (deterministic, explainable) |
| Company profile / readiness | None | `companies` table + onboarding wizard + readiness score |
| Plain-English tender decision page | `ai_summary` only | Extend AI extraction → structured `tender_analysis` |
| Pipeline (New→Won) | None | `pipeline_items` + Kanban UI |
| Calendar & deadline warnings | None | Derived calendar + reminder rules |
| Document Vault | None | `company_documents` + private bucket + per-tender "you have 7 of 11" |
| GrowYourBiz escalation / leads | WhatsApp CTA only (manual) | `service_requests` + escalation CTAs + lead handover |
| Tiering (free→paid) | None | `plan` on company + feature gates |
| Repositioned messaging | "search 150k" | Hero + nav rewrite |
| Known defects | Wiki/404/staff-dashboard | Stabilisation pass (Phase 1) |

---

## 2. Target architecture

### 2.1 New data model (all additive, all RLS owner-scoped)

> Migration file naming follows the repo convention `supabase/migrations/2026MMDD000000_*.sql`.
> Every statement uses `IF NOT EXISTS`. Every table gets `svc_all` (service role) +
> **owner policies** mirroring the `saved_searches` pattern (`auth.uid() = user_id`).

```
profiles                -- bridges auth.users → role ('client' | 'staff'), display name
companies               -- the Tender Matching Profile (1 user → 1+ companies)
company_documents       -- Document Vault rows (storage in a new private bucket)
company_compliance      -- normalised compliance flags (CSD/TCS/BBBEE/COIDA/CIDB/NHBRC/PSIRA)
tender_analysis         -- structured, decision-grade extraction per tender (shared, not per-user)
tender_matches          -- cached score rows (company_id × tender_id) + reason breakdown
pipeline_items          -- a tender on a company's board: stage, notes, internal deadlines
service_requests        -- GrowYourBiz escalation tickets (the lead/revenue engine)
```

**Why `tender_analysis` is a new table, not more `ai_*` columns:** the existing four
`ai_*` arrays stay (cheap, already populated). The *decision* fields (briefing
required, site visit, evaluation method, red flags, recommended action, extracted
required-document list, confidence, model version, analysed_at) are richer and
versioned — a 1:1 side table keyed by `tender_id` keeps `tenders` lean and lets us
re-run analysis without rewriting the core row. Store the verbose payload as `jsonb`
plus a few promoted columns we filter on (`compulsory_briefing bool`,
`briefing_date timestamptz`, `closing_date` already on `tenders`).

**Why `tender_matches` is cached, not purely on-the-fly:** scoring is deterministic
and cheap, but "My Matches" must paginate/sort across thousands of active tenders per
company. Compute on profile-save and on new-tender ingest; store score + factor
breakdown so the UI explains *why*. Recompute job piggybacks on the existing
`ingestion_log`/cron spine.

### 2.2 RLS posture (non-negotiable, given Phase 0)

- `companies`, `company_documents`, `company_compliance`, `pipeline_items`,
  `service_requests`, `tender_matches`: **owner-scoped** — `using (auth.uid() = user_id)`
  (join through `companies.user_id` for child tables). No anon access.
- `tender_analysis`: anon/authenticated **SELECT-only** (it's derived public tender
  data, same class as `tenders`) — add to the browse-table allowlist.
- Staff override: `profiles.role = 'staff'` policy for GrowYourBiz to read client
  `service_requests` and (consented) profiles for done-with-you service.

### 2.3 Routing & navigation

Split the front door cleanly so SMMEs never hit "Staff sign in":

```
/                      Public landing (repositioned)
/tenders, /tenders/[id]  Public browse + decision page (enhanced)
/wiki, /learn          Education (stabilised)
/login                 Staff sign in (unchanged)
/signup                NEW — SMME self-serve account
/workspace             NEW — client home = "My Matches" (was the gap behind /dashboard)
  /workspace/profile      Company profile + onboarding wizard + readiness score
  /workspace/matches      My Matches (best / possible / closing soon / missing-doc / partner)
  /workspace/pipeline     Kanban board
  /workspace/calendar     Deadline calendar
  /workspace/vault        Document Vault
  /workspace/requests     GrowYourBiz service requests
/dashboard             Staff ops (unchanged; rename label to "Staff" in Header)
```

Middleware change: add a `/workspace/*` rule requiring **any** authenticated user
(client or staff); keep `/dashboard/*` requiring `role = 'staff'`. This is a small,
well-contained edit to `src/middleware.ts` reusing `resolveUser()`.

### 2.4 Component reuse

Reuse, don't reinvent: `TenderCard`, `TenderFilters`, `TenderSearch`, `Card`, `Badge`,
`Button`, `PipelineStatus` already exist. New components are additive:
`MatchScoreBadge`, `ReadinessMeter`, `OnboardingWizard`, `PipelineBoard`,
`CalendarGrid`, `DocumentChecklist`, `EscalationCTA`.

---

## 3. The matching engine (deterministic & explainable — start here, not with AI)

Per the vision's 6-factor model. Pure TypeScript over the company profile + the
(extended) tender analysis. No model call on the hot path → fast, free, auditable.

```
Score /100 =
  Industry fit       25  category/keyword overlap (company services ↔ tender category/ai_keywords)
  Location fit       15  province / service-area match
  Compliance fit     20  required registrations present (CSD/TCS/BBBEE/COIDA/CIDB/NHBRC/PSIRA)
  Capacity fit       15  turnover / staff / experience vs tender size signal
  Deadline fit       10  days-to-close vs a "prep-time-needed" heuristic
  Document readiness 15  required docs present in the vault
```

Output is **not just a number** — it's a `reasons[]` breakdown the UI renders verbatim:

> **Match 78% — Good fit.** You match the category, province and basic compliance.
> **Risk:** COIDA/LOGS missing and only 4 days to prepare.

Bucketing for "My Matches": `≥70 strong`, `40–69 possible`, `<40 hidden by default`.
Special lanes computed from the same row: *closing this week*, *missing-document
opportunities* (high industry+location fit but failing only on docs → escalation gold),
*partner opportunities* (capacity fit low but everything else high).

`file: src/lib/matching/score.ts` (pure, unit-tested like `rateLimit.test.ts`).

---

## 4. Tender analysis engine (extend what exists)

Keep `aiAnalyser.ts`'s provider abstraction (Claude primary). Extend the system prompt
+ output schema to a **structured decision profile** and write it to `tender_analysis`:

```
{ summary, eligible_if[], may_struggle_if[],
  required_documents[], required_registrations[], required_forms[] (SBD/MBD),
  compulsory_briefing: bool, briefing_date, site_visit: bool,
  evaluation_method, preference_points,
  red_flags[], recommended_action: 'bid'|'shortlist'|'needs_docs'|'find_partner'|'skip',
  confidence: 0..1, needs_human_review: bool }
```

Guardrails (already partly present): defensive JSON extraction, `MAX_INPUT_CHARS`,
rate limiting, `confidence` + `needs_human_review` flag for unclear tenders, and a
mandatory **"AI analysis is decision-support only"** disclaimer on every analysis view.
Backfill runs through the existing cron/pipeline spine, oldest-active first.

---

## 5. GrowYourBiz escalation = the revenue engine

Every *gap* the system detects becomes a one-tap `service_requests` row + WhatsApp
handover:

| Detected gap | CTA → service request |
|---|---|
| No CSD | "Request CSD registration/update" |
| No SARS TCS | "Request SARS Tax Compliance" |
| No B-BBEE | "Generate B-BBEE affidavit" |
| No COIDA | "Request COIDA / Letter of Good Standing" |
| No capability statement | "Build capability statement" |
| Wants full bid | "Ask GrowYourBiz to prepare the pack" |

These feed CRM/lead handover and map to the annual packages (R4,500 Readiness /
R6,500 Growth Partner / premium advisory). Tiering is enforced by a `plan` field on
`companies` + a single `requirePlan()` guard helper used by gated routes/components.

---

## 6. Phased roadmap (mapped to real files)

**Phase 1 — Stabilise & reposition** *(trust + messaging; mostly front-end)*
- Verify wiki `summary` fix is live; fix any remaining tender/wiki/learn 404s.
- Reposition `src/app/page.tsx`: hero → *"Find tenders that fit your business."*;
  stats get a "last updated" timestamp; add Treasury-data + AI-decision-support disclaimers.
- `Header.tsx`: relabel "Dashboard" → "Staff", add "Sign in / Get started" for SMMEs.
- Enhance tender filters/cards (closing-soon, briefing, docs-available, sector chips).

**Phase 2 — SMME accounts & profile** *(the first true product gap)*
- `/signup`, `profiles`, `companies`, `company_compliance` (+ RLS).
- Onboarding wizard → **readiness score** (compliance complete / docs missing /
  sector-reg missing / tender-ready / needs-GrowYourBiz).
- `/workspace` shell + middleware rule.

**Phase 3 — Matching engine** → `/workspace/matches`
- `src/lib/matching/score.ts` (+ tests), `tender_matches` table + recompute job,
  Best/Possible/Closing/Missing-doc/Partner lanes, "not for me" feedback.

**Phase 4 — Tender analysis extension** → enhanced `/tenders/[id]`
- Extend `aiAnalyser.ts` + `tender_analysis` table; plain-English decision page with
  recommended action; backfill via cron.

**Phase 5 — Pipeline & calendar**
- `pipeline_items` + Kanban (reuse `PipelineStatus`); derived calendar + reminder rules
  (7/3/1-day, briefing-missed, missing-docs, no-time-to-prepare).

**Phase 6 — Document Vault & bid-pack assistant**
- `company_documents` + new **private** storage bucket (mirror `documentDownloader`'s
  `ensureBucket` private pattern); per-tender "you have 7 of 11" checklist; draft
  cover letter / capability statement generation.

**Phase 7 — Monetisation & GrowYourBiz integration**
- `service_requests` everywhere a gap is detected; `plan` gating; WhatsApp/CRM handover;
  package recommendation.

---

## 7. MVP cut (ship this first)

Public browse · enhanced tender decision page · create company profile · My Matches ·
tender checklist · saved tenders · calendar · pipeline · document vault · "Request
GrowYourBiz help". That's Phases 1–3 + the thin slices of 4–6 — enough to be genuinely
useful without overbuilding.

---

## 8. Immediate fixes (do regardless of roadmap)

1. Confirm `wiki_articles.summary` migration is applied in prod (audit flagged drift).
2. Audit & fix 404s on tender detail, wiki article, and Learn pages.
3. Add "last updated" to homepage stat counts.
4. Add the two disclaimers: Treasury-data-incompleteness + AI-decision-support-only.
5. Relabel staff "Dashboard" so SMMEs aren't sent to "Staff sign in".

---

## 9. Key decisions to confirm before building

1. **One company per user, or many?** (Agencies/consultants may manage several SMMEs →
   suggest many; `companies.user_id` + a "current company" switch.)
2. **Self-serve signup, or invite-only via GrowYourBiz?** Affects `/signup` + onboarding.
3. **Matching = deterministic only at launch** (recommended) vs AI-assisted from day one.
4. **Tier enforcement now or later** — recommend ship free tier first, gate in Phase 7.

---

### Appendix — guardrails carried from the audit
- All schema changes: `IF NOT EXISTS`; never edit an existing `create table`.
- Every new client table ships **owner-scoped RLS** (Phase 0 is deny-by-default).
- Reuse the Claude-primary `aiAnalyser` provider abstraction; never hardcode a provider.
- Private storage buckets only for vault docs (reuse `ensureBucket` private pattern).
- Keep the not-affiliated-with-Government + verify-on-eTenders disclaimers.
</content>
</invoke>
