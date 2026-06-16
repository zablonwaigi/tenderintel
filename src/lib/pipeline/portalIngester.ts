import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { parseAmountToCents, fileTypeFromName } from "@/lib/utils";
import type { TenderStatus } from "@/types/tender";

const PORTAL_BASE = "https://www.etenders.gov.za";
const PAGINATED_ENDPOINT = "/Home/PaginatedTenderOpportunities";
const PAGE_SIZE = 1000;

/**
 * Portal StatusId -> TenderStatus mapping.
 * Known values from eTenders portal:
 *   1 = Active / Open for bids
 *   2 = Awarded
 *   3 = Cancelled  — portal has a server-side duplicate-key bug; skipped here,
 *                    cancelled tenders come from the OCDS API instead.
 *   4 = Closed / Expired (closed without award)
 *
 * Any unknown statusId is mapped to "closed" as a safe fallback.
 */
const STATUS_MAP: Record<number, TenderStatus> = {
    1: "active",
    2: "awarded",
    3: "cancelled", // kept in map but ingestAll() skips it due to portal bug
    4: "closed",
};

function statusFromId(statusId: number): TenderStatus {
    return STATUS_MAP[statusId] ?? "closed";
}

interface PortalDocument {
    FileName?: string;
    fileName?: string;
    FileSize?: number | string;
    fileSize?: number | string;
    url?: string;
    URL?: string;
    Id?: string | number;
    id?: string | number;
    Description?: string;
    description?: string;
}

interface PortalRecord {
    TENDERID?: string | number;
    TENDERNUMBER?: string;
    TENDERDESCRIPTION?: string;
    CATEGORY?: string;
    DEPARTMENT?: string;
    PROVINCE?: string;
    DATEADVERTISED?: string;
    CLOSINGDATE?: string;
    AWARDDATE?: string;
    ADVERTISED_BID_AMOUNT?: string | number;
    SUCCESSFULBIDAMOUNT?: string | number;
    SUCCESSFULBIDDERNAME?: string;
    Documents?: PortalDocument[];
    documents?: PortalDocument[];
    [key: string]: unknown;
}

export interface IngestResult {
    inserted: number;
    updated: number;
    documentsQueued: number;
    fetched: number;
}

export interface IngestOptions {
    statusId: number;
    onProgress?: (count: number) => void;
    maxPages?: number;
}

function pickDocUrl(doc: PortalDocument): string | null {
    const direct = doc.url || doc.URL;
    if (direct) {
          return direct.startsWith("http") ? direct : `${PORTAL_BASE}${direct}`;
    }
    const id = doc.Id ?? doc.id;
    const name = doc.FileName ?? doc.fileName;
    if (id !== undefined && id !== null) {
          const qs = new URLSearchParams({ Id: String(id) });
          if (name) qs.set("fileName", String(name));
          return `${PORTAL_BASE}/Home/GetFile?${qs.toString()}`;
    }
    return null;
}

function parsePortalDate(value: string | undefined): string | null {
    if (!value) return null;
    // Portal often returns .NET-style /Date(1234567890000)/ or ISO strings.
  const netMatch = /\/Date\((\d+)\)\//.exec(value);
    if (netMatch) {
          return new Date(parseInt(netMatch[1], 10)).toISOString();
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PortalIngester {
    private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
        this.supabase = supabase ?? createServiceClient();
  }

  private async fetchPage(statusId: number, start: number): Promise<PortalRecord[]> {
        const body = new URLSearchParams({
                draw: "1",
                start: String(start),
                length: String(PAGE_SIZE),
                StatusId: String(statusId),
                CategoryId: "0",
                ProvinceId: "0",
                searchPhrase: "",
        });

      let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
                try {
                          const res = await fetch(`${PORTAL_BASE}${PAGINATED_ENDPOINT}`, {
                                      method: "POST",
                                      headers: {
                                                    "Content-Type": "application/x-www-form-urlencoded",
                                                    "X-Requested-With": "XMLHttpRequest",
                                                    "User-Agent": "Mozilla/5.0",
                                                    Accept: "application/json, text/javascript, */*; q=0.01",
                                      },
                                      body: body.toString(),
                          });

                  if (!res.ok) {
                              throw new Error(`Portal API ${res.status} ${res.statusText} for statusId=${statusId} start=${start}`);
                  }

                  const json = (await res.json()) as { data?: PortalRecord[] };
                          return Array.isArray(json.data) ? json.data : [];
                } catch (err) {
                          lastError = err;
                          if (attempt < 2) await sleep(2000 * (attempt + 1));
                }
        }
        throw new Error(`Portal fetch failed after 3 attempts: ${lastError}`);
  }

  /**
     * Ingest all tenders for a given portal status, paginating until exhausted.
     *
     * NOTE: statusId=3 (cancelled) is intentionally skipped here because the
     * portal API has a server-side duplicate-key bug for that status. Cancelled
     * tenders are ingested via OcdsIngester instead.
     */
  async ingestAll(options: IngestOptions): Promise<IngestResult> {
        const { statusId, onProgress, maxPages } = options;

      if (statusId === 3) {
              console.log("[portalIngester] Skipping statusId=3 (cancelled) — handled by OCDS ingester");
              return { inserted: 0, updated: 0, documentsQueued: 0, fetched: 0 };
      }

      const status = statusFromId(statusId);

      let start = 0;
        let page = 0;
        const result: IngestResult = { inserted: 0, updated: 0, documentsQueued: 0, fetched: 0 };

      // eslint-disable-next-line no-constant-condition
      while (true) {
              const records = await this.fetchPage(statusId, start);
              if (records.length === 0) break;

          const batch = await this.upsertBatch(records, status);
              result.inserted += batch.inserted;
              result.updated += batch.updated;
              result.documentsQueued += batch.documentsQueued;
              result.fetched += records.length;

          if (onProgress) onProgress(result.fetched);

          console.log(`[portalIngester] statusId=${statusId} page=${page + 1} start=${start} records=${records.length} total=${result.fetched}`);

          start += PAGE_SIZE;
              page += 1;
              if (maxPages && page >= maxPages) break;
              if (records.length < PAGE_SIZE) break;

          // Brief pause between pages to be respectful of the public portal.
          await sleep(300);
      }

      return result;
  }

  async ingestStatus(statusId: number): Promise<IngestResult> {
        return this.ingestAll({ statusId });
  }

  private async upsertBatch(
        records: PortalRecord[],
        status: TenderStatus
      ): Promise<IngestResult> {
        const result: IngestResult = { inserted: 0, updated: 0, documentsQueued: 0, fetched: records.length };

      const tenderRows = [];
        const docRows: Record<string, unknown>[] = [];

      for (const rec of records) {
              const tenderId = rec.TENDERID != null ? String(rec.TENDERID) : null;
              if (!tenderId) continue;

          tenderRows.push({
                    tender_id: tenderId,
                    tender_number: rec.TENDERNUMBER ?? tenderId,
                    description: rec.TENDERDESCRIPTION ?? "(no description)",
                    category: rec.CATEGORY ?? null,
                    department: rec.DEPARTMENT ?? null,
                    province: rec.PROVINCE ?? null,
                    status,
                    date_advertised: parsePortalDate(rec.DATEADVERTISED),
                    closing_date: parsePortalDate(rec.CLOSINGDATE),
                    advertised_amount: parseAmountToCents(rec.ADVERTISED_BID_AMOUNT),
                    awarded_amount: status === "awarded" ? parseAmountToCents(rec.SUCCESSFULBIDAMOUNT) : null,
                    awarded_to: status === "awarded" ? (rec.SUCCESSFULBIDDERNAME ?? null) : null,
                    raw_portal_data: rec as Record<string, unknown>,
                    updated_at: new Date().toISOString(),
          });

          const docs = rec.Documents ?? rec.documents ?? [];
              for (const doc of docs) {
                        const fileName = doc.FileName ?? doc.fileName;
                        const sourceUrl = pickDocUrl(doc);
                        if (!fileName || !sourceUrl) continue;
                        docRows.push({
                                    tender_id: tenderId,
                                    file_name: fileName,
                                    file_size: (doc.FileSize ?? doc.fileSize) ? Number(doc.FileSize ?? doc.fileSize) : null,
                                    file_type: fileTypeFromName(String(fileName)),
                                    source_url: sourceUrl,
                                    download_status: "pending",
                                    parse_status: "pending",
                        });
              }
      }

      if (tenderRows.length > 0) {
              const { error } = await this.supabase
                .from("tenders")
                .upsert(tenderRows, { onConflict: "tender_id" });
              if (error) {
                        throw new Error(`Failed to upsert tenders: ${error.message}`);
              }
              result.updated += tenderRows.length;
      }

      if (docRows.length > 0) {
              const { error } = await this.supabase
                .from("tender_documents")
                .upsert(docRows, { onConflict: "tender_id,file_name,source_url", ignoreDuplicates: true });
              if (error) {
                        throw new Error(`Failed to upsert documents: ${error.message}`);
              }
              result.documentsQueued += docRows.length;
      }

      return result;
  }
}
