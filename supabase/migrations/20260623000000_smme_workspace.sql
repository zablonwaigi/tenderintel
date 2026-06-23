-- ============================================
-- SMME Workspace — client accounts, company profile, lead capture
-- Phase 2/3 of the UX Enhancement Blueprint.
--
-- ADDITIVE & DRIFT-SAFE: every statement uses IF NOT EXISTS. New tables ship
-- their OWN owner-scoped RLS (the Phase-0 deny-by-default migration only ran
-- over tables that existed then), so without these policies the browser anon
-- key cannot see client rows.
--
-- Auth model: one company per authenticated user (companies.user_id unique).
-- Writes happen server-side via the service-role key (server actions verify the
-- session first); owner policies are added for defense-in-depth + future direct
-- client reads.
-- ============================================

-- ---------- profiles: bridge auth.users -> role ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'client',   -- 'client' | 'staff'
  full_name   text,
  phone       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ---------- companies: the Tender Matching Profile ----------
create table if not exists public.companies (
  id                       uuid primary key default uuid_generate_v4(),
  user_id                  uuid not null unique references auth.users(id) on delete cascade,
  name                     text not null,
  registration_number      text,                 -- CIPC reg no
  provinces                text[] default '{}',  -- operating provinces (incl. 'National')
  service_areas            text[] default '{}',
  industries               text[] default '{}',  -- selected category labels
  services_offered         text,                 -- free-text description
  years_experience         int,
  annual_turnover_band     text,                 -- '0-1m'|'1-5m'|'5-20m'|'20m+'
  team_size                text,                  -- '1-5'|'6-20'|'21-50'|'50+'
  plan                     text not null default 'free', -- 'free'|'starter'|'readiness'|'growth'
  -- compliance signals (the GrowYourBiz moat)
  csd_registered           boolean default false,
  tax_compliant            boolean default false,
  bbbee_level              int,                   -- 1..8, null = none/unknown
  coida_registered         boolean default false,
  cidb_grade               text,                  -- e.g. '3GB', null = n/a
  nhbrc_registered         boolean default false,
  psira_registered         boolean default false,
  has_capability_statement boolean default false,
  onboarding_complete      boolean default false,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

create index if not exists companies_user_id_idx on public.companies(user_id);

-- ---------- service_requests: GrowYourBiz lead / revenue engine ----------
create table if not exists public.service_requests (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  company_id  uuid references public.companies(id) on delete set null,
  kind        text not null,                     -- 'csd'|'tax'|'bbbee'|'coida'|'capability'|'bid_pack'|'general'
  tender_id   text,                              -- optional context (portal tender id)
  message     text,
  status      text not null default 'new',       -- 'new'|'contacted'|'in_progress'|'done'|'closed'
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists service_requests_user_id_idx on public.service_requests(user_id);
create index if not exists service_requests_status_idx on public.service_requests(status);

-- ---------- updated_at triggers (reuse init-migration function) ----------
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at before update on public.companies
  for each row execute function public.handle_updated_at();
drop trigger if exists service_requests_updated_at on public.service_requests;
create trigger service_requests_updated_at before update on public.service_requests
  for each row execute function public.handle_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (owner-scoped + service-role)
-- ============================================
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.service_requests enable row level security;

-- service_role full access (workers / server actions)
drop policy if exists "svc_all" on public.profiles;
create policy "svc_all" on public.profiles for all to service_role using (true) with check (true);
drop policy if exists "svc_all" on public.companies;
create policy "svc_all" on public.companies for all to service_role using (true) with check (true);
drop policy if exists "svc_all" on public.service_requests;
create policy "svc_all" on public.service_requests for all to service_role using (true) with check (true);

-- profiles: a user owns the row whose id = their uid
drop policy if exists "own_profile_select" on public.profiles;
create policy "own_profile_select" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "own_profile_insert" on public.profiles;
create policy "own_profile_insert" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "own_profile_update" on public.profiles;
create policy "own_profile_update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- companies: owner-scoped by user_id
drop policy if exists "own_company_select" on public.companies;
create policy "own_company_select" on public.companies for select to authenticated using (user_id = auth.uid());
drop policy if exists "own_company_insert" on public.companies;
create policy "own_company_insert" on public.companies for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own_company_update" on public.companies;
create policy "own_company_update" on public.companies for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- service_requests: owner can create + read their own; staff/service handle updates
drop policy if exists "own_request_select" on public.service_requests;
create policy "own_request_select" on public.service_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists "own_request_insert" on public.service_requests;
create policy "own_request_insert" on public.service_requests for insert to authenticated with check (user_id = auth.uid());
