-- ============================================
-- TenderIntel OCDS sync rewrite migration
-- Replaces the legacy Portal API sync with a pure OCDS pipeline.
--   * Adds OCDS-native columns to public.tenders
--   * Adds a UNIQUE constraint on tenders.ocid for upsert-by-ocid
--   * Creates public.ocds_sync_cursor to track sync state per mode
--   * Adds a (tender_id, source_url) unique index for document de-dup
-- ============================================

-- ── New OCDS columns on tenders ────────────────────────────────────────────
alter table public.tenders
  add column if not exists ocds_tags          text[],
  add column if not exists ocds_status         text,
  add column if not exists award_supplier_name text,
  add column if not exists award_supplier_id   text,
  add column if not exists award_value         numeric,
  add column if not exists award_currency      text,
  add column if not exists contract_value      numeric,
  add column if not exists contract_currency   text,
  add column if not exists contract_start_date timestamptz,
  add column if not exists contract_end_date   timestamptz,
  add column if not exists buyer_name          text,
  add column if not exists buyer_id            text,
  add column if not exists last_ocds_sync      timestamptz,
  add column if not exists sync_source         text;

-- ── UNIQUE constraint on ocid (required for upsert onConflict: 'ocid') ──────
-- A unique index permits multiple NULLs, so portal-only rows without an ocid
-- are unaffected while OCDS rows are de-duplicated by ocid.
create unique index if not exists tenders_ocid_unique_idx on public.tenders(ocid);

create index if not exists tenders_ocds_tags_idx on public.tenders using gin(ocds_tags);
create index if not exists tenders_last_ocds_sync_idx on public.tenders(last_ocds_sync desc);

-- ── Document de-dup support for documents mode ──────────────────────────────
create unique index if not exists tender_documents_tender_source_idx
  on public.tender_documents(tender_id, source_url);

-- ============================================
-- OCDS SYNC CURSOR TABLE
-- Tracks per-mode sync progress so each cron invocation resumes where the
-- previous one stopped (kept within the Coolify 300s task timeout).
-- ============================================
create table if not exists public.ocds_sync_cursor (
  id                uuid primary key default uuid_generate_v4(),
  sync_mode         text unique not null,   -- 'incremental'|'backfill'|'awarded'|'documents'
  last_synced_date  timestamptz,            -- high-water mark for this mode
  last_page_number  int default 0,
  total_pages       int default 0,
  total_records     int default 0,
  status            text default 'idle',    -- 'idle'|'running'|'completed'|'failed'
  updated_at        timestamptz default now()
);

-- Seed one cursor row per mode (idempotent).
insert into public.ocds_sync_cursor (sync_mode, last_synced_date)
values
  ('incremental', '2020-01-01T00:00:00Z'),
  ('backfill',    '2015-01-01T00:00:00Z'),
  ('awarded',     '2020-01-01T00:00:00Z'),
  ('documents',   null)
on conflict (sync_mode) do nothing;

-- ── RLS: service role full access ───────────────────────────────────────────
alter table public.ocds_sync_cursor enable row level security;
drop policy if exists "Service role all cursor" on public.ocds_sync_cursor;
create policy "Service role all cursor" on public.ocds_sync_cursor
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop trigger if exists ocds_sync_cursor_updated_at on public.ocds_sync_cursor;
create trigger ocds_sync_cursor_updated_at before update on public.ocds_sync_cursor
  for each row execute function public.handle_updated_at();

comment on table public.ocds_sync_cursor is
  'Per-mode sync cursor for the OCDS pipeline. last_synced_date is the resume point for the next cron run.';
