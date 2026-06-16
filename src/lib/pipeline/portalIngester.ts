import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { parseAmountToCents, fileTypeFromName } from "@/lib/utils";
import type { TenderStatus } from "@/types/tender";

const PORTAL_BASE = "https://www.etenders.gov.za";
const PAGINATED_ENDPOINT = "/Home/PaginatedTenderOpportunities";
const PAGE_SIZE = 1000;

const STATUS_MAP: Record<number, TenderStatus> = {
  1: "active",
  2: "awarded",
  4: "closed",
};

interface PortalDocument {
  FileName?: string;
  fileName?: string;
  FileSize?: number | string;
  fileSize?: number | string;
  // The portal returns either a full URL or an Id we build a URL from.
  url?: string;
  URL?: string;
  Id?: string | number;
  id?: string | number;
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
  // Portal often returns ".NET" style /Date(1234567890000)/ or ISO strings.
  const netMatch = /\/Date\((\d+)\)\//.exec(value);
  if (netMatch) {
    return new Date(parseInt(netMatch[1], 10)).toISOString();
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
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
      throw new Error(`Portal API returned ${res.status} ${res.statusText} for start=${start}`);
    }

    const json = (await res.json()) as { data?: PortalRecord[] };
    return Array.isArray(json.data) ? json.data : [];
  }

  /**
   * Ingest all tenders for a given portal status, paginating until exhausted.
   * SKIPS statusId=3 (cancelled) which has a server-side duplicate key bug.
   */
  async ingestAll(options: IngestOptions): Promise<IngestResult> {
    const { statusId, onProgress, maxPages } = options;

    if (statusId === 3) {
      // Cancelled tenders come from the OCDS API instead.
      return { inserted: 0, updated: 0, documentsQueued: 0, fetched: 0 };
    }

    const status = STATUS_MAP[statusId];
    if (!status) {
      throw new Error(`Unsupported statusId: ${statusId}`);
    }

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

      start += PAGE_SIZE;
      page += 1;
      if (maxPages && page >= maxPages) break;
      if (records.length < PAGE_SIZE) break;
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
        awarded_to: status === "awarded" ? rec.SUCCESSFULBIDDERNAME ?? null : null,
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
          file_size: doc.FileSize ?? doc.fileSize ? Number(doc.FileSize ?? doc.fileSize) : null,
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
      // We can't cheaply distinguish insert vs update via upsert; approximate
      // by treating all as upserted. Detailed counts come from the DB if needed.
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
