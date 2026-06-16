import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { parseAmountToCents } from "@/lib/utils";

const OCDS_BASE = "https://ocds-api.etenders.gov.za";
const PAGE_SIZE = 500;

interface OcdsAward {
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
}

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export class OcdsIngester {
  private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase ?? createServiceClient();
  }

  private async fetchPage(from: Date, to: Date, pageNumber: number): Promise<OcdsRelease[]> {
    const qs = new URLSearchParams({
      dateFrom: fmt(from),
      dateTo: fmt(to),
      PageNumber: String(pageNumber),
      PageSize: String(PAGE_SIZE),
    });

    const res = await fetch(`${OCDS_BASE}/api/OCDSReleases?${qs.toString()}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`OCDS API returned ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as OcdsResponse;
    return Array.isArray(json.releases) ? json.releases : [];
  }

  /**
   * Ingest one date window (max ~1 month). Both dateFrom and dateTo are
   * required by the API. Cancelled tenders are inserted; others enrich
   * existing rows with OCDS data where a matching tender number exists.
   */
  async ingestDateRange(from: Date, to: Date): Promise<OcdsIngestResult> {
    const result: OcdsIngestResult = { fetched: 0, upserted: 0 };
    let pageNumber = 1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const releases = await this.fetchPage(from, to, pageNumber);
      if (releases.length === 0) break;
      result.fetched += releases.length;

      for (const release of releases) {
        const tender = release.tender;
        if (!tender?.id) continue;

        const status = (tender.status ?? "").toLowerCase();
        const isCancelled = status === "cancelled" || status === "unsuccessful";

        const award = release.awards?.[0];
        const supplier = award?.suppliers?.[0]?.name ?? null;

        if (isCancelled) {
          // Insert cancelled tenders that the portal API does not expose.
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
            ocid: release.ocid ?? null,
            ocds_data: release as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          };
          const { error } = await this.supabase
            .from("tenders")
            .upsert(row, { onConflict: "tender_id" });
          if (!error) result.upserted += 1;
        } else {
          // Enrich an existing portal tender that matches by tender number.
          const { error } = await this.supabase
            .from("tenders")
            .update({
              ocid: release.ocid ?? null,
              ocds_data: release as Record<string, unknown>,
              awarded_to: supplier ?? undefined,
            })
            .eq("tender_number", tender.id);
          if (!error) result.upserted += 1;
        }
      }

      if (releases.length < PAGE_SIZE) break;
      pageNumber += 1;
    }

    return result;
  }

  /**
   * Walk from 2010-01-01 to today in 1-month windows.
   */
  async ingestFullHistory(
    onProgress?: (window: string, result: OcdsIngestResult) => void
  ): Promise<OcdsIngestResult> {
    const total: OcdsIngestResult = { fetched: 0, upserted: 0 };
    let windowStart = new Date("2010-01-01T00:00:00Z");
    const end = new Date();

    while (windowStart < end) {
      let windowEnd = addMonths(windowStart, 1);
      if (windowEnd > end) windowEnd = end;

      const res = await this.ingestDateRange(windowStart, windowEnd);
      total.fetched += res.fetched;
      total.upserted += res.upserted;
      if (onProgress) onProgress(`${fmt(windowStart)}..${fmt(windowEnd)}`, res);

      windowStart = windowEnd;
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
