-- ============================================
-- Fix: tender detail pages 500 with
--   "column tenders.ai_compliance does not exist"
--
-- The init schema (20260616000000_tenderintel_init.sql) defines these columns,
-- but on the live database the `tenders` table pre-existed when that migration's
-- `create table if not exists` ran, so the AI columns were never added. The list
-- query only selects `ai_summary` (which is present) and therefore works, while
-- the detail query (src/lib/tenders/detail.ts) also selects ai_keywords,
-- ai_requirements and ai_compliance — the first missing one (ai_compliance)
-- aborts the query with a 500, which the page surfaces as a blank 404.
--
-- This migration is idempotent: ADD COLUMN IF NOT EXISTS is a no-op where the
-- column already exists, so it is safe to run on any environment.
-- ============================================

alter table public.tenders
  add column if not exists full_text       text,
  add column if not exists ai_summary      text,
  add column if not exists ai_keywords     text[],
  add column if not exists ai_requirements text[],
  add column if not exists ai_compliance   text[];
