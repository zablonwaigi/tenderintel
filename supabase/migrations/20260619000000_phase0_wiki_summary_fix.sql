-- ============================================
-- Phase 0 / task 0.7 — fix wiki_articles.summary mismatch (RB4)
--
-- src/lib/wiki/query.ts selects `summary` (and orders the list by title using
-- it), but on the live DB the wiki_articles table pre-existed the init
-- migration's `create table if not exists`, so the `summary` column was never
-- added — /wiki errors with "column wiki_articles.summary does not exist".
-- Same drift pattern as the ai_compliance fix. Idempotent: no-op where present.
-- ============================================

alter table public.wiki_articles
  add column if not exists summary text;
