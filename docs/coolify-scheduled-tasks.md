# Coolify Scheduled Tasks

## ⚠️ REQUIRED FIRST: apply the database migration

The sync upserts on `tenders.ocid` and queues documents — both need schema that
the `20260616000002_ocds_sync_rewrite.sql` migration creates. If it has **not**
been applied, every write fails with:

> `there is no unique or exclusion constraint matching the ON CONFLICT specification`

…and the table stays frozen (the "stuck at 245" symptom). Apply it once:

```bash
# Option A — from the repo (needs the Postgres connection string)
SUPABASE_DB_URL="postgres://...supabase.co:5432/postgres" npm run db:migrate

# Option B — paste supabase/migrations/20260616000002_ocds_sync_rewrite.sql
#            into the Supabase SQL Editor and run it.
```

Verify with the diagnostics endpoint (no data written, just reports state):

```bash
curl -s "https://growyourbizsa.co.za/api/cron/sync-tenders?mode=status" \
  -H "Authorization: Bearer TndrInt3l2026SecureCOrnJ0bK3ylZA"
# => { tenders, documents, cursors: [...], now }
```

If `cursors` is empty or the call 500s on a missing column, the migration has not
been applied yet.

### Then load history

`incremental` only keeps the recent window fresh — history is loaded by the
backfill engine. After the migration, kick the chained backfill (see
"One-time historical backfill" below) or just let the monthly `sync-ocds-full`
task walk forward. The engine auto-skips the data-less pre-2017 years.

---


The tender sync runs entirely off the public OCDS API
(`https://ocds-api.etenders.gov.za/api/OCDSReleases`). The legacy "Portal API"
path has been removed — every mode below pulls from OCDS and upserts into
`public.tenders` keyed on `ocid`.

All endpoints are protected by a Bearer token that must match the `CRON_SECRET`
environment variable. Each task command therefore sends:

```
-H "Authorization: Bearer TndrInt3l2026SecureCOrnJ0bK3ylZA"
```

> The container timeout is **300s**. Every mode is capped (page limits / single
> month-window per invocation) so a run finishes well inside that budget.

## Tasks

| Task | Schedule | Command |
| --- | --- | --- |
| `sync-tenders` | Daily 06:00 | `curl -X GET "https://growyourbizsa.co.za/api/cron/sync-tenders?mode=incremental" -H "Authorization: Bearer TndrInt3l2026SecureCOrnJ0bK3ylZA"` |
| `sync-awarded` | Mon 07:00 | `curl -X GET "https://growyourbizsa.co.za/api/cron/sync-tenders?mode=awarded" -H "Authorization: Bearer TndrInt3l2026SecureCOrnJ0bK3ylZA"` |
| `sync-documents` | Every 4 hours | `curl -X GET "https://growyourbizsa.co.za/api/cron/sync-tenders?mode=documents" -H "Authorization: Bearer TndrInt3l2026SecureCOrnJ0bK3ylZA"` |
| `sync-ocds-full` | 1st of month 02:00 | `curl -X GET "https://growyourbizsa.co.za/api/cron/sync-tenders?mode=backfill" -H "Authorization: Bearer TndrInt3l2026SecureCOrnJ0bK3ylZA"` |
| `sync-backfill-init` | Manual / run-once | `curl -X GET "https://growyourbizsa.co.za/api/cron/sync-backfill?from=2015-01-01&to=2026-06-01" -H "Authorization: Bearer TndrInt3l2026SecureCOrnJ0bK3ylZA"` |

### `sync-closed` — DELETE this task

Closed/cancelled state now comes directly from the OCDS release `tag[]`
(`tenderCancellation`, etc.) and is handled by the daily `incremental` run, so a
dedicated closed-tender sweep is no longer needed. If the task is left in place
it no longer hard-errors — the removed `closed`/`ocds`/`full` modes are now
aliased to a working mode — but it should still be removed to avoid redundant
runs.

## Mode reference

- **`incremental`** — reads the `incremental` cursor, pages forward from
  `dateFrom = last_synced_date` (max 10 pages / ~5000 records), then advances the
  cursor to `now()`.
- **`awarded`** — same paging as incremental but only upserts award-notice
  releases; tracked under its own `awarded` cursor.
- **`backfill`** — processes one **1-month** window per run (max 20 pages),
  advancing the `backfill` cursor by a month each time. Stops once the cursor is
  within 30 days of now (incremental takes over). The monthly `sync-ocds-full`
  task drives this until history is filled.
- **`ocds-full`** — same engine as `backfill` with **3-month** windows. It now
  **continues** the `backfill` cursor run-to-run (it no longer resets every run,
  which previously pinned it to the empty 2015 window forever). Pass
  `?reset=true` to deliberately restart history from `2015-01-01`.
- **`status`** — read-only diagnostics: returns `tenders`/`documents` counts and
  every sync cursor. Writes nothing.
- **`documents`** — scans recently-synced tenders for OCDS document URLs in
  `ocds_data->'tender'->'documents'` and `ocds_data->'awards'->0->'documents'`,
  queueing new rows into `tender_documents`
  (`ON CONFLICT (tender_id, source_url) DO NOTHING`).

## One-time historical backfill

`sync-backfill` processes a single month window per call and returns
`{ done, nextFrom, processed }`. Chain calls until `done` is `true`:

```bash
SECRET="TndrInt3l2026SecureCOrnJ0bK3ylZA"
FROM="2015-01-01"
TO="2026-06-01"
while true; do
  RESP=$(curl -s -X GET \
    "https://growyourbizsa.co.za/api/cron/sync-backfill?from=$FROM&to=$TO" \
    -H "Authorization: Bearer $SECRET")
  echo "$RESP"
  echo "$RESP" | grep -q '"done":true' && break
  FROM=$(echo "$RESP" | sed -E 's/.*"nextFrom":"([^"]+)".*/\1/')
  sleep 2
done
```

Progress is persisted in `ocds_sync_cursor` under the `backfill-init` mode, so the
loop is safe to stop and resume.
