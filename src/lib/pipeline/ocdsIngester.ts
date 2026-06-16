import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { parseAmountToCents } from "@/lib/utils";

const OCDS_BASE = "https://ocds-api.etenders.gov.za";
const PAGE_SIZE = 500;
const MAX_RETRIES = 3;
const PAGE_PAUSE_MS = 300;
const WINDOW_PAUSE_MS = 500;

// OCDS tender statuses that represent a tender removed from competition.
// These are inserted as 'cancelled' since the portal API does not expose them.
const CANCELLED_STATUSES = new Set(["cancelled", "unsuccessful", "withdrawn"]);
// Statuses that should enrich an existing portal tender rather than insert.
const ENRICH_STATUSES = new Set(["active", "awarded", "complete", "planning"]);

interface OcdsAward {
  date?: string;
  value?: { amount?: number; currency?: string };
  suppliers?: { name?: string }[];
}

interface OcdsTender {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  value?: { amount?: number; currency?: string };
  procurementMethod?: string;
  tenderPeriod?: { endDate?: string };
}

interface OcdsRelease {
  ocid?: string;
  date?: string;
  tender?: OcdsTender;
  awards?: OcdsAward[];
  buyer?: { name?: string };
  [key: string]: unknown;
}

interface OcdsResponse {
  releases?: OcdsRelease[];
  [key: string]: unknown;
}

export interface OcdsIngestResult {
  fetched: number;
  upserted: number;
  errors: number;
}

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OcdsIngester {
  private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase ?? createServiceClient();
  }

  private async fetchJson<T>(url: string): Promise<T> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`OCDS API returned ${res.status} ${res.statusText}`);
        return (await res.json()) as T;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES - 1) await sleep(2000 * (attempt + 1));
      }
    }
    throw new Error(
      `OCDS API failed after ${MAX_RETRIES} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }

  private async fetchPage(from: Date, to: Date, pageNumber: number): Promise<OcdsRelease[]> {
    const qs = new URLSearchParams({
      dateFrom: fmt(from),
      dateTo: fmt(to),
      PageNumber: String(pageNumber),
      PageSize: String(PAGE_SIZE),
    });
    const json = await this.fetchJson<OcdsResponse>(`${OCDS_BASE}/api/OCDSReleases?${qs.toString()}`);
    return Array.isArray(json.releases) ? json.releases : [];
  }

  /**
   * Fetch a single OCDS release by its ocid.
   */
  async fetchByOcid(ocid: string): Promise<OcdsRelease | null> {
    try {
      const json = await this.fetchJson<OcdsRelease | OcdsResponse>(
        `${OCDS_BASE}/api/OCDSReleases/release/${encodeURIComponent(ocid)}`
      );
      // The endpoint may return a release directly or wrapped in { releases }.
      if ((json as OcdsResponse).releases) {
        return (json as OcdsResponse).releases?.[0] ?? null;
      }
      return json as OcdsRelease;
    } catch (err) {
      console.error(`fetchByOcid failed for ${ocid}:`, err);
      return null;
    }
  }

  private async processRelease(release: OcdsRelease): Promise<boolean> {
    const tender = release.tender;
    if (!tender?.id) return false;

    const status = (tender.status ?? "").toLowerCase();
    const award = release.awards?.[0];
    const supplier = award?.suppliers?.[0]?.name ?? null;

    if (CANCELLED_STATUSES.has(status)) {
      // Insert tenders that the portal API does not expose (cancelled/withdrawn/unsuccessful).
      const row = {
        tender_id: `ocds-${tender.id}`,
        tender_number: tender.id,
        description: tender.description ?? tender.title ?? "(no description)",
        category: tender.procurementMethod ?? null,
        department: release.buyer?.name ?? null,
        province: null,
        status: "cancelled",
        closing_date: tender.tenderPeriod?.endDate ?? null,
        advertised_amount: parseAmountToCents(tender.value?.amount),
        awarded_amount: parseAmountToCents(award?.value?.amount),
        awarded_to: supplier,
        award_date: award?.date ?? null,
        ocid: release.ocid ?? null,
        ocds_data: release as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      };
      const { error } = await this.supabase
        .from("tenders")
        .upsert(row, { onConflict: "tender_id" });
      if (error) throw new Error(error.message);
      return true;
    }

    if (ENRICH_STATUSES.has(status) || status === "") {
      // Enrich an existing portal tender that matches by tender number.
      const patch: Record<string, unknown> = {
        ocid: release.ocid ?? null,
        ocds_data: release as Record<string, unknown>,
      };
      if (supplier) patch.awarded_to = supplier;
      if (award?.date) patch.award_date = award.date;

      const { error } = await this.supabase
        .from("tenders")
        .update(patch)
        .eq("tender_number", tender.id);
      if (error) throw new Error(error.message);
      return true;
    }

    return false;
  }

  /**
   * Ingest one date window (max ~1 month). Both dateFrom and dateTo are
   * required by the API. Cancelled/withdrawn tenders are inserted; others
   * enrich existing rows with OCDS data where a matching tender number exists.
   */
  async ingestDateRange(from: Date, to: Date): Promise<OcdsIngestResult> {
    const result: OcdsIngestResult = { fetched: 0, upserted: 0, errors: 0 };
    let pageNumber = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const releases = await this.fetchPage(from, to, pageNumber);
      if (releases.length === 0) break;
      result.fetched += releases.length;

      for (const release of releases) {
        try {
          const changed = await this.processRelease(release);
          if (changed) result.upserted += 1;
        } catch (err) {
          result.errors += 1;
          console.error(`OCDS release ${release.ocid} failed:`, err);
        }
      }

      if (releases.length < PAGE_SIZE) break;
      pageNumber += 1;
      await sleep(PAGE_PAUSE_MS);
    }

    return result;
  }

  /**
   * Walk from 2010-01-01 to today in 1-month windows.
   */
  async ingestFullHistory(
    onProgress?: (window: string, result: OcdsIngestResult) => void
  ): Promise<OcdsIngestResult> {
    const total: OcdsIngestResult = { fetched: 0, upserted: 0, errors: 0 };
    let windowStart = new Date("2010-01-01T00:00:00Z");
    const end = new Date();

    while (windowStart < end) {
      let windowEnd = addMonths(windowStart, 1);
      if (windowEnd > end) windowEnd = end;

      try {
        const res = await this.ingestDateRange(windowStart, windowEnd);
        total.fetched += res.fetched;
        total.upserted += res.upserted;
        total.errors += res.errors;
        if (onProgress) onProgress(`${fmt(windowStart)}..${fmt(windowEnd)}`, res);
        console.log(
          `[ocds] ${fmt(windowStart)}..${fmt(windowEnd)} — fetched ${res.fetched}, upserted ${res.upserted}, errors ${res.errors}`
        );
      } catch (err) {
        total.errors += 1;
        console.error(`OCDS window ${fmt(windowStart)}..${fmt(windowEnd)} failed:`, err);
      }

      windowStart = windowEnd;
      await sleep(WINDOW_PAUSE_MS);
    }

    return total;
  }

  /**
   * Ingest just the last N days (default 30) — used by the daily cron.
   */
  async ingestRecent(days = 30): Promise<OcdsIngestResult> {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    return this.ingestDateRange(from, to);
  }
}
