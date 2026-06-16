-- ============================================
-- TenderIntel sync enhancements migration
-- Adds error tracking and pipeline mode support
-- ============================================

-- Add ocds_errors tracking to ingestion_log
alter table public.ingestion_log
  add column if not exists ocds_errors int default 0;

-- Add run_type values to accommodate new pipeline modes.
-- (run_type is a text column — no enum changes needed, just documenting here)
-- Valid values: 'full' | 'incremental' | 'awarded' | 'closed' | 'documents' | 'ocds' | 'ocds-full'

-- Ensure tenders table has award_date for portal awarded data
alter table public.tenders
  add column if not exists award_date timestamptz;

-- Add index on tender_number for fast OCDS enrichment lookups
create index if not exists tenders_tender_number_idx on public.tenders(tender_number);

-- Add index on ocid for fast OCDS release lookups
create index if not exists tenders_ocid_idx on public.tenders(ocid);

-- Add compound status+closing_date index for common dashboard queries
create index if not exists tenders_status_closing_idx on public.tenders(status, closing_date);

-- Add department index for filtering
create index if not exists tenders_department_idx on public.tenders(department);

-- Ensure documents table has parse_status index
create index if not exists tender_documents_parse_status_idx
  on public.tender_documents(parse_status)
  where parse_status = 'pending';

-- Performance: partial index for pending downloads
create index if not exists tender_documents_pending_download_idx
  on public.tender_documents(download_status)
  where download_status = 'pending';

comment on column public.ingestion_log.run_type is
  'Pipeline mode: full | incremental | awarded | closed | documents | ocds | ocds-full';

comment on table public.tenders is
  'South African Government tenders from eTenders portal (etenders.gov.za) and OCDS API. Status values: active | awarded | closed | cancelled.';

comment on column public.tenders.tender_id is
  'Portal TENDERID for portal-sourced records; "ocds-{tender.id}" for OCDS-only (cancelled) records.';

comment on column public.tenders.status is
  'active=open for bids (statusId=1), awarded=successful bid (statusId=2), closed=expired/no award (statusId=4), cancelled=withdrawn (OCDS only).';
