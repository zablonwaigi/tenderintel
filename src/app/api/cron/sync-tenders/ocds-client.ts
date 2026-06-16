/**
 * OCDS (Open Contracting Data Standard) API client for the South African
 * eTenders feed: https://ocds-api.etenders.gov.za/api/OCDSReleases
 *
 * The endpoint is public (no auth) but quirky:
 *   - It responds with `text/plain` even when the body is JSON, so callers
 *     must read the body as text and JSON.parse() it themselves.
 *   - It paginates via PageNumber / PageSize and exposes a `links.next` hint.
 *
 * This module only knows how to fetch and type OCDS releases. Mapping to the
 * `tenders` table and persistence live in the route handlers.
 */

export const OCDS_BASE = "https://ocds-api.etenders.gov.za";
export const PAGE_SIZE = 500;

// ── OCDS type definitions (only the fields the pipeline consumes) ───────────

export interface Value {
  amount?: number;
  currency?: string;
}

export interface Period {
  startDate?: string;
  endDate?: string;
  maxExtentDate?: string;
  durationInDays?: number;
}

export interface Document {
  id?: string;
  documentType?: string;
  title?: string;
  description?: string;
  url?: string;
  datePublished?: string;
  dateModified?: string;
  format?: string;
  language?: string;
}

export interface Item {
  id?: string;
  description?: string;
  classification?: { scheme?: string; id?: string; description?: string };
  deliveryLocation?: { description?: string; address?: Record<string, unknown> };
  deliveryAddress?: { region?: string; locality?: string; description?: string };
  quantity?: number;
  unit?: Record<string, unknown>;
}

export interface Party {
  id?: string;
  name?: string;
  identifier?: { scheme?: string; id?: string; legalName?: string };
  address?: Record<string, unknown>;
  contactPoint?: { name?: string; email?: string; telephone?: string };
  roles?: string[];
}

export interface Tender {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  category?: string;
  mainProcurementCategory?: string;
  additionalProcurementCategories?: string[];
  procurementMethod?: string;
  procurementMethodDetails?: string;
  value?: Value;
  minValue?: Value;
  province?: string;
  tenderPeriod?: Period;
  enquiryPeriod?: Period;
  awardPeriod?: Period;
  contractPeriod?: Period;
  numberOfTenderers?: number;
  tenderers?: Party[];
  items?: Item[];
  documents?: Document[];
}

export interface Award {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  date?: string;
  value?: Value;
  suppliers?: Party[];
  items?: Item[];
  contractPeriod?: Period;
  documents?: Document[];
}

export interface Contract {
  id?: string;
  awardID?: string;
  title?: string;
  description?: string;
  status?: string;
  period?: Period;
  value?: Value;
  dateSigned?: string;
  documents?: Document[];
}

export interface Release {
  ocid?: string;
  id?: string;
  date?: string;
  tag?: string[];
  initiationType?: string;
  language?: string;
  description?: string;
  buyer?: Party;
  parties?: Party[];
  tender?: Tender;
  awards?: Award[];
  contracts?: Contract[];
  planning?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ReleasePackage {
  uri?: string;
  version?: string;
  publishedDate?: string;
  publisher?: { name?: string; uri?: string };
  releases: Release[];
  links?: { next?: string; prev?: string };
  [key: string]: unknown;
}

/**
 * Fetch one page of OCDS releases.
 *
 * @param pageNumber 1-based page index.
 * @param dateFrom   Optional ISO-ish date string (YYYY-MM-DD) lower bound.
 * @param dateTo     Optional ISO-ish date string (YYYY-MM-DD) upper bound.
 *
 * Reads the body as text (the API mislabels JSON as text/plain) and parses it.
 * Throws on non-2xx so callers can record the failure in ingestion_log.
 */
export async function fetchOCDSPage(
  pageNumber: number,
  dateFrom?: string,
  dateTo?: string,
): Promise<ReleasePackage> {
  const params = new URLSearchParams({
    PageNumber: String(pageNumber),
    PageSize: String(PAGE_SIZE),
  });
  // The eTenders OCDS API requires BOTH dateFrom and dateTo — omitting either
  // returns 400 "dateFrom and dateTo fields are required." Default to a wide
  // window so a bare call still succeeds.
  const today = new Date().toISOString().split("T")[0]; // 'YYYY-MM-DD'
  params.set("dateFrom", dateFrom || "2020-01-01");
  params.set("dateTo", dateTo || today);

  const res = await fetch(`${OCDS_BASE}/api/OCDSReleases?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) throw new Error(`OCDS API ${res.status}`);

  const text = await res.text();
  const pkg = JSON.parse(text) as ReleasePackage;
  if (!Array.isArray(pkg.releases)) pkg.releases = [];
  return pkg;
}

/** Format a Date as YYYY-MM-DD for the OCDS dateFrom/dateTo params. */
export function toOCDSDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Return a new Date advanced by `months` calendar months. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
