-- ============================================
-- Phase 0 / task 0.2 + RB6 — enable & verify RLS on EVERY public table.
--
-- The audit found ~9 production tables that exist outside this repo's
-- migrations (created via the SQL editor / a prior project). Tables created
-- that way default to RLS DISABLED, so the anon key can read/write them. This
-- migration force-enables RLS on every base table in `public` and installs a
-- DENY-BY-DEFAULT policy set, WITHOUT needing to know each table's columns.
--
-- Policy model (deny-by-default; per schema proposal §0 + POPIA):
--   * service_role: full access on EVERY table (the app/workers use the
--     service-role key server-side and bypass RLS anyway, but the explicit
--     policy documents intent).
--   * anon + authenticated: SELECT ONLY on the three intentionally-public
--     browse tables (tenders, tender_documents, wiki_articles). NOTHING else.
--   * All other tables (ocds_sync_cursor, ingestion_log, scraping_*,
--     raw_scrape_data, data_quality_checks, calculated_opportunities,
--     client_notifications_queue, opportunity_sync_log, cipc, saved_searches,
--     …): service-role-only — no anon, no authenticated access. The dashboard
--     reads these via the service-role client server-side, so the UI is
--     unaffected, and any PII/ops table is closed to the browser anon key.
--
-- Idempotent & drift-safe: iterates over whatever tables actually exist, so it
-- runs cleanly regardless of which tables are present in a given environment.
-- Re-runnable: every policy is dropped-if-exists then recreated.
-- ============================================

-- Public browse tables that anon + authenticated may read.
-- Everything else is service-role-only.
-- (kept inline in each block below as an array literal)

-- 1. Enable RLS on every base table in public.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t.tablename);
  end loop;
end $$;

-- 2. service_role full access on every table. Also scrub any legacy public-read
--    or blanket read policies left over from the init migration / prior project
--    so the only non-service access is the scoped browse-read added in step 3.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('drop policy if exists "svc_all" on public.%I;', t.tablename);
    execute format(
      'create policy "svc_all" on public.%I for all to service_role using (true) with check (true);',
      t.tablename);

    -- Remove our own prior-iteration policy names and the known legacy ones.
    execute format('drop policy if exists "auth_read" on public.%I;', t.tablename);
    execute format('drop policy if exists "anon_read" on public.%I;', t.tablename);
  end loop;

  -- Named legacy policies from the init migration (only on tables that have them).
  if exists (select 1 from pg_tables where schemaname='public' and tablename='tenders') then
    execute 'drop policy if exists "Public read tenders" on public.tenders;';
    execute 'drop policy if exists "Service role all tenders" on public.tenders;';
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='tender_documents') then
    execute 'drop policy if exists "Public read documents" on public.tender_documents;';
    execute 'drop policy if exists "Service role all docs" on public.tender_documents;';
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='wiki_articles') then
    execute 'drop policy if exists "Public read wiki" on public.wiki_articles;';
    execute 'drop policy if exists "Service role all wiki" on public.wiki_articles;';
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='ingestion_log') then
    execute 'drop policy if exists "Service role all logs" on public.ingestion_log;';
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='ocds_sync_cursor') then
    execute 'drop policy if exists "Service role all cursor" on public.ocds_sync_cursor;';
  end if;
end $$;

-- 3. anon + authenticated SELECT ONLY on the public browse tables.
--    (No write policy for either role anywhere — writes are service-role-only.)
do $$
declare t text;
begin
  foreach t in array array['tenders','tender_documents','wiki_articles']
  loop
    if exists (select 1 from pg_tables where schemaname='public' and tablename=t) then
      execute format('create policy "anon_read" on public.%I for select to anon using (true);', t);
      execute format('create policy "auth_read" on public.%I for select to authenticated using (true);', t);
    end if;
  end loop;
end $$;

-- VERIFY (run after applying):
--   -- every table has RLS on:
--   select relname, relrowsecurity from pg_class
--   where relnamespace='public'::regnamespace and relkind='r' order by 1;   -- all true
--   -- only the 3 browse tables expose anon/authenticated SELECT; the rest are svc_all only:
--   select tablename, policyname, cmd, roles from pg_policies
--   where schemaname='public' order by tablename, policyname;
