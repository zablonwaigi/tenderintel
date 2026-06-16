-- ============================================
-- TenderIntel initial schema
-- ============================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- ============================================
-- TENDERS TABLE
-- ============================================
create table if not exists public.tenders (
  id              uuid primary key default uuid_generate_v4(),
  tender_id       text unique not null,         -- portal TENDERID
  tender_number   text not null,
  description     text not null,
  category        text,
  department      text,
  province        text,
  status          text not null,                -- 'active'|'awarded'|'closed'|'cancelled'
  date_advertised timestamptz,
  closing_date    timestamptz,
  advertised_amount bigint,                     -- stored in cents
  awarded_amount  bigint,                       -- stored in cents
  awarded_to      text,
  ocid            text,                         -- OCDS ocid if available
  ocds_data       jsonb,                        -- full OCDS release JSON
  raw_portal_data jsonb,                        -- raw portal API response row
  full_text       text,                         -- concat of all parsed document text for FTS
  ai_summary      text,                         -- GPT-4o summary
  ai_keywords     text[],
  ai_requirements text[],                       -- extracted requirements list
  ai_compliance   text[],                       -- compliance documents likely needed
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists tenders_status_idx on public.tenders(status);
create index if not exists tenders_closing_date_idx on public.tenders(closing_date);
create index if not exists tenders_category_idx on public.tenders(category);
create index if not exists tenders_province_idx on public.tenders(province);
create index if not exists tenders_full_text_idx on public.tenders using gin(to_tsvector('english', coalesce(full_text,'')));
create index if not exists tenders_description_trgm_idx on public.tenders using gin(description gin_trgm_ops);

-- ============================================
-- TENDER DOCUMENTS TABLE
-- ============================================
create table if not exists public.tender_documents (
  id              uuid primary key default uuid_generate_v4(),
  tender_id       text not null references public.tenders(tender_id) on delete cascade,
  file_name       text not null,
  file_size       bigint,
  file_type       text,                         -- 'pdf'|'docx'|'xlsx'|'zip'
  source_url      text,
  storage_path    text,                         -- path in Supabase Storage
  download_status text default 'pending',       -- 'pending'|'downloaded'|'failed'|'skipped'
  parse_status    text default 'pending',       -- 'pending'|'parsed'|'failed'
  parsed_text     text,
  parsed_at       timestamptz,
  downloaded_at   timestamptz,
  created_at      timestamptz default now()
);

create index if not exists tender_documents_tender_id_idx on public.tender_documents(tender_id);
create index if not exists tender_documents_download_status_idx on public.tender_documents(download_status);
create index if not exists tender_documents_parse_status_idx on public.tender_documents(parse_status);
-- Avoid duplicate document rows for the same source file on a tender.
create unique index if not exists tender_documents_unique_idx on public.tender_documents(tender_id, file_name, source_url);

-- ============================================
-- WIKI ARTICLES TABLE
-- ============================================
create table if not exists public.wiki_articles (
  id              uuid primary key default uuid_generate_v4(),
  slug            text unique not null,
  title           text not null,
  category        text not null,               -- 'form'|'process'|'glossary'|'guide'
  content         text not null,               -- markdown
  summary         text,
  form_code       text,                        -- e.g. 'SBD 1', 'SBD 4', 'MBD 7.2'
  related_forms   text[],
  tags            text[],
  view_count      int default 0,
  ai_generated    boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists wiki_articles_category_idx on public.wiki_articles(category);
create index if not exists wiki_articles_tags_idx on public.wiki_articles using gin(tags);

-- ============================================
-- INGESTION LOG TABLE
-- ============================================
create table if not exists public.ingestion_log (
  id              uuid primary key default uuid_generate_v4(),
  run_type        text not null,               -- 'full'|'incremental'|'documents'|'ocds'
  status          text not null,               -- 'running'|'completed'|'failed'
  tenders_fetched int default 0,
  tenders_new     int default 0,
  tenders_updated int default 0,
  docs_queued     int default 0,
  docs_downloaded int default 0,
  docs_failed     int default 0,
  error_message   text,
  started_at      timestamptz default now(),
  completed_at    timestamptz
);

create index if not exists ingestion_log_started_at_idx on public.ingestion_log(started_at desc);

-- ============================================
-- SAVED SEARCHES TABLE (for registered users)
-- ============================================
create table if not exists public.saved_searches (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade,
  name            text not null,
  filters         jsonb not null,
  email_alerts    boolean default false,
  created_at      timestamptz default now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
alter table public.tenders enable row level security;
alter table public.tender_documents enable row level security;
alter table public.wiki_articles enable row level security;
alter table public.ingestion_log enable row level security;
alter table public.saved_searches enable row level security;

-- Public read on tenders, wiki, documents
drop policy if exists "Public read tenders" on public.tenders;
create policy "Public read tenders" on public.tenders for select using (true);
drop policy if exists "Public read wiki" on public.wiki_articles;
create policy "Public read wiki" on public.wiki_articles for select using (true);
drop policy if exists "Public read documents" on public.tender_documents;
create policy "Public read documents" on public.tender_documents for select using (true);

-- Service role full access
drop policy if exists "Service role all tenders" on public.tenders;
create policy "Service role all tenders" on public.tenders using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "Service role all docs" on public.tender_documents;
create policy "Service role all docs" on public.tender_documents using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "Service role all wiki" on public.wiki_articles;
create policy "Service role all wiki" on public.wiki_articles using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "Service role all logs" on public.ingestion_log;
create policy "Service role all logs" on public.ingestion_log using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Saved searches only own rows
drop policy if exists "Own saved searches" on public.saved_searches;
create policy "Own saved searches" on public.saved_searches using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenders_updated_at on public.tenders;
create trigger tenders_updated_at before update on public.tenders
  for each row execute function public.handle_updated_at();
drop trigger if exists wiki_updated_at on public.wiki_articles;
create trigger wiki_updated_at before update on public.wiki_articles
  for each row execute function public.handle_updated_at();
