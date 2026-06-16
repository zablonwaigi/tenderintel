-- ============================================
-- TenderIntel sync enhancements
-- Adds award timestamp, OCDS error tracking, and indexes that speed up
-- enrichment lookups and the document download/parse workers.
-- ============================================

-- Award timestamp (populated from OCDS awards[].date; portal data has none).
alter table public.tenders
  add column if not exists award_date timestamptz;

-- Track partial OCDS failures per ingestion run.
alter table public.ingestion_log
  add column if not exists ocds_errors int default 0;

-- OCDS enrichment matches existing tenders by tender_number — index it.
create index if not exists tenders_tender_number_idx on public.tenders(tender_number);

-- OCDS releases are looked up / joined by ocid.
create index if not exists tenders_ocid_idx on public.tenders(ocid);

-- Common browse/sort path: filter by status, order by closing date.
create index if not exists tenders_status_closing_idx
  on public.tenders(status, closing_date desc);

-- Department filtering / grouping.
create index if not exists tenders_department_idx on public.tenders(department);

-- Award date sorting for awarded views.
create index if not exists tenders_award_date_idx on public.tenders(award_date);

-- Partial indexes so the download/parse workers find pending rows instantly
-- without scanning the whole (large) documents table.
create index if not exists tender_documents_pending_download_idx
  on public.tender_documents(created_at)
  where download_status = 'pending';

create index if not exists tender_documents_pending_parse_idx
  on public.tender_documents(created_at)
  where download_status = 'downloaded' and parse_status = 'pending';
