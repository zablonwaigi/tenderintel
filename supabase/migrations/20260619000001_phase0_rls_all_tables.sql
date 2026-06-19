-- ============================================
-- Phase 0 / task 0.2 + RB6 — enable & verify RLS on EVERY public table.
--
-- The audit found ~9 production tables that exist outside this repo's
-- migrations (created via the SQL editor / a prior project). Tables created
-- that way default to RLS DISABLED, so the anon key can read/write them. This
-- migration force-enables RLS on every base table in `public` and installs a
-- safe default policy set, WITHOUT needing to know each table's columns.
--
-- Policy model (per schema proposal §0):
--   * service_role: full access everywhere (workers/server use the service key).
--   * authenticated: read access (staff are logged-in Supabase users).
--   * anon: read ONLY the three intentionally-public browse tables
--     (tenders, tender_documents, wiki_articles); no anon writes anywhere.
--
-- Idempotent & drift-safe: iterates over whatever tables actually exist, so it
-- runs cleanly regardless of which tables are present in a given environment.
-- Re-runnable: every policy is dropped-if-exists then recreated.
-- ============================================

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

-- 2. service_role full access + authenticated read on every table.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    -- service role: everything
    execute format('drop policy if exists "svc_all" on public.%I;', t.tablename);
    execute format(
      'create policy "svc_all" on public.%I for all to service_role using (true) with check (true);',
      t.tablename);

    -- authenticated staff: read
    execute format('drop policy if exists "auth_read" on public.%I;', t.tablename);
    execute format(
      'create policy "auth_read" on public.%I for select to authenticated using (true);',
      t.tablename);
  end loop;
end $$;

-- 3. anon read ONLY on the public browse tables (no anon writes anywhere).
do $$
declare t text;
begin
  foreach t in array array['tenders','tender_documents','wiki_articles']
  loop
    if exists (select 1 from pg_tables where schemaname='public' and tablename=t) then
      execute format('drop policy if exists "anon_read" on public.%I;', t);
      execute format(
        'create policy "anon_read" on public.%I for select to anon using (true);', t);
    end if;
  end loop;
end $$;

-- 4. Remove the old blanket public-read policies from the init migration so the
--    scoped anon_read above is the only anon path (defence in depth).
do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='tenders') then
    execute 'drop policy if exists "Public read tenders" on public.tenders;';
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='tender_documents') then
    execute 'drop policy if exists "Public read documents" on public.tender_documents;';
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename='wiki_articles') then
    execute 'drop policy if exists "Public read wiki" on public.wiki_articles;';
  end if;
end $$;

-- VERIFY (run after applying):
--   select relname, relrowsecurity from pg_class
--   where relnamespace='public'::regnamespace and relkind='r' order by 1;  -- all true
--   select tablename, policyname, cmd from pg_policies
--   where schemaname='public' order by 1,3;
