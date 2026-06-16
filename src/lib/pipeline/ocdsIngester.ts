import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { parseAmountToCents } from "@/lib/utils";

const OCDS_BASE = "https://ocds-api.etenders.gov.za";
const PAGE_SIZE = 500;

// Statuses treated as "cancelled" / terminal in the OCDS feed.
// These are inserted as new rows where the portal API does not expose them.
const CANCELLED_STATUSES = new Set(["cancelled", "unsuccessful", "withdrawn"]);

// Statuses that correspond to active / awarded tenders the portal already has.
// For these we enrich existing rows with OCDS data rather than inserting duplicates.
const ENRICHMENT_STATUSES = new Set(["active", "awarded", "complete", "planning"]);

interface OcdsAward {
    id?: string;
    status?: string;
    value?: { amount?: number; currency?: string };
    suppliers?: { name?: string; identifier?: { id?: string; legalName?: string } }[];
    date?: string;
}

interface OcdsTender {
    id?: string;
    title?: string;
    description?: string;
    status?: string;
    value?: { amount?: number; currency?: string };
    procurementMethod?: string;
    procurementMethodDetails?: string;
    mainProcurementCategory?: string;
    tenderPeriod?: { startDate?: string; endDate?: string };
    awardPeriod?: { startDate?: string; endDate?: string };
    numberOfTenderers?: number;
    items?: unknown[];
}

interface OcdsRelease {
    ocid?: string;
    id?: string;
    date?: string;
    tag?: string[];
    initiationType?: string;
    tender?: OcdsTender;
    awards?: OcdsAward[];
    buyer?: { name?: string; identifier?: { id?: string } };
    planning?: { budget?: { amount?: { amount?: number; currency?: string } } };
    [key: string]: unknown;
}

interface OcdsResponse {
    releases?: OcdsRelease[];
    uri?: string;
    publishedDate?: string;
    publisher?: unknown;
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

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Derive the best tender status from the OCDS release.
 * Considers both tender.status and the presence/state of awards.
 */
function deriveStatus(release: OcdsRelease): string {
    const s = (release.tender?.status ?? "").toLowerCase();
    if (CANCELLED_STATUSES.has(s)) return "cancelled";
    if (s === "awarded" || s === "complete") return "awarded";
    if (s === "active") return "active";
    if (s === "planning") return "active"; // treat planning as active
  // Fall back to checking tags
  const tags = release.tag ?? [];
    if (tags.includes("award") || tags.includes("awardUpdate")) return "awarded";
    if (tags.includes("tenderCancellation") || tags.includes("awardCancellation")) return "cancelled";
    return s || "active";
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

      const url = `${OCDS_BASE}/api/OCDSReleases?${qs.toString()}`;
        let lastError: unknown;

      for (let attempt = 0; attempt < 3; attempt++) {
              try {
                        const res = await fetch(url, {
                                    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
                        });

                if (!res.ok) {
                            throw new Error(`OCDS API ${res.status} ${res.statusText} for ${qs.toString()}`);
                }

                const json = (await res.json()) as OcdsResponse;
                        return Array.isArray(json.releases) ? json.releases : [];
              } catch (err) {
                        lastError = err;
                        if (attempt < 2) await sleep(2000 * (attempt + 1));
              }
      }

      console.error(`[ocdsIngester] Failed to fetch page after 3 attempts: ${url}`, lastError);
        return []; // Return empty rather than throw to keep the window moving
  }

  /**
     * Process and upsert a single OCDS release.
     * Returns true if successfully upserted.
     */
  private async processRelease(release: OcdsRelease): Promise<boolean> {
        const tender = release.tender;
        if (!tender?.id) return false;

      const status = deriveStatus(release);
        const award = release.awards?.find((a) => (a.status ?? "").toLowerCase() === "active")
          ?? release.awards?.[0];
        const supplierName = award?.suppliers?.[0]?.name
          ?? award?.suppliers?.[0]?.identifier?.legalName
          ?? null;

      if (CANCELLED_STATUSES.has(status)) {
              // Insert cancelled tenders — these are NOT exposed by the portal API.
          const row = {
                    tender_id: `ocds-${tender.id}`,
                    tender_number: tender.id,
                    description: tender.description ?? tender.title ?? "(no description)",
                    category: tender.mainProcurementCategory ?? tender.procurementMethodDetails ?? tender.procurementMethod ?? null,
                    department: release.buyer?.name ?? null,
                    province: null,
                    status: "cancelled",
                    date_advertised: tender.tenderPeriod?.startDate ?? release.date ?? null,
                    closing_date: tender.tenderPeriod?.endDate ?? null,
                    advertised_amount: parseAmountToCents(
                                tender.value?.amount ?? release.planning?.budget?.amount?.amount
                              ),
                    awarded_amount: parseAmountToCents(award?.value?.amount),
                    awarded_to: supplierName,
                    ocid: release.ocid ?? null,
                    ocds_data: release as Record<string, unknown>,
                    updated_at: new Date().toISOString(),
          };

          const { error } = await this.supabase
                .from("tenders")
                .upsert(row, { onConflict: "tender_id" });

          if (error) {
                    console.error(`[ocdsIngester] Failed to upsert cancelled tender ${tender.id}:`, error.message);
                    return false;
          }
              return true;
      } else {
              // Enrich an existing portal tender that matches by tender number.
          // First try to match by exact tender_number, then by ocid prefix.
          const updatePayload: Record<string, unknown> = {
                    ocid: release.ocid ?? null,
                    ocds_data: release as Record<string, unknown>,
                    updated_at: new Date().toISOString(),
          };
              if (supplierName) updatePayload.awarded_to = supplierName;
              if (award?.value?.amount) {
                        updatePayload.awarded_amount = parseAmountToCents(award.value.amount);
              }
              if (ENRICHMENT_STATUSES.has(status) && status === "awarded") {
                        updatePayload.status = "awarded";
              }

          const { error } = await this.supabase
                .from("tenders")
                .update(updatePayload)
                .eq("tender_number", tender.id);

          if (error) {
                    console.warn(`[ocdsIngester] Could not enrich tender ${tender.id}:`, error.message);
          }
              // Even if enrichment fails (no matching row), it's not a fatal error.
          return true;
      }
  }

  /**
     * Ingest one date window. Both dateFrom and dateTo are required by the API.
     * Paginates until all releases in the window are processed.
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
                    const ok = await this.processRelease(release);
                    if (ok) result.upserted += 1;
                    else result.errors += 1;
          }

          if (releases.length < PAGE_SIZE) break;
              pageNumber += 1;
              // Brief pause between pages to be respectful of the public API.
          await sleep(300);
      }

      return result;
  }

  /**
     * Walk from startDate to today in monthly windows.
     * The OCDS API requires date ranges and returns up to PAGE_SIZE per page.
     * Default start date is 2010-01-01 (covers full historical data).
     */
  async ingestFullHistory(
        onProgress?: (window: string, result: OcdsIngestResult) => void,
        fromDate = "2010-01-01"
      ): Promise<OcdsIngestResult> {
        const total: OcdsIngestResult = { fetched: 0, upserted: 0, errors: 0 };
        let windowStart = new Date(`${fromDate}T00:00:00Z`);
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
          } catch (err) {
                    console.error(`[ocdsIngester] Window ${fmt(windowStart)}..${fmt(windowEnd)} failed:`, err);
                    total.errors += 1;
          }

          windowStart = windowEnd;
              // Brief pause between windows to avoid rate-limiting.
          await sleep(500);
      }

      return total;
  }

  /**
     * Ingest the last N days (default 30) — used by the daily incremental cron.
     */
  async ingestRecent(days = 30): Promise<OcdsIngestResult> {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - days);
        return this.ingestDateRange(from, to);
  }

  /**
     * Fetch a single release by OCID (for detail enrichment).
     */
  async fetchByOcid(ocid: string): Promise<OcdsRelease | null> {
        try {
                const res = await fetch(`${OCDS_BASE}/api/OCDSReleases/release/${encodeURIComponent(ocid)}`, {
                          headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
                });
                if (!res.ok) return null;
                const json = await res.json();
                // API returns either a single release or wrapped in releases array
          if (json.releases && Array.isArray(json.releases)) return json.releases[0] ?? null;
                return json as OcdsRelease;
        } catch {
                return null;
        }
  }
}
