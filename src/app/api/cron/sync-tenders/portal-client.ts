/**
 * eTenders portal tender-list client.
 *
 * The portal exposes a DataTables-style endpoint that, unlike the OCDS feed,
 * carries the FULL catalogue across all statuses (advertised / awarded / closed
 * / cancelled — ~156k records). It must be called as a GET with query-string
 * params (POST now returns 405) and `status` is an integer:
 *   1 = advertised (active) | 2 = awarded | 3 = closed | 4 = cancelled
 *
 * The endpoint requires a minimal set of DataTables `columns[..]` definitions
 * and an `order[0][column]` that references one of them, or the .NET model
 * binder throws. We send columns 0-4 and order by closing date desc.
 */

export const PORTAL_BASE = "https://www.etenders.gov.za";
export const PORTAL_ENDPOINT = "/Home/PaginatedTenderOpportunities";

export const PORTAL_STATUS_MAP: Record<number, string> = {
  1: "active",
  2: "awarded",
  3: "closed",
  4: "cancelled",
};
export const PORTAL_STATUS_SEQUENCE = [1, 2, 3, 4] as const;

export interface PortalNamed {
  name?: string;
}

export interface PortalSupportDocument {
  supportDocumentID?: string;
  fileName?: string;
  extension?: string;
  active?: boolean;
}

export interface PortalRecord {
  id?: number | string;
  tender_No?: string;
  description?: string;
  category?: string;
  categories?: PortalNamed;
  type?: string;
  organ_of_State?: string;
  status?: string;
  closing_Date?: string;
  date_Published?: string;
  province?: string;
  provinces?: PortalNamed;
  department?: string;
  departments?: PortalNamed;
  supportDocument?: PortalSupportDocument[];
  awards?: unknown;
  bidders?: unknown;
  ocid?: string | null;
  releaseId?: string | null;
  [key: string]: unknown;
}

export interface PortalPage {
  recordsTotal: number;
  recordsFiltered: number;
  data: PortalRecord[];
}

/** Build the DataTables query string the portal endpoint requires. */
function buildPortalQuery(status: number, start: number, length: number): string {
  const p = new URLSearchParams();
  p.set("draw", "1");
  p.set("start", String(start));
  p.set("length", String(length));
  p.set("status", String(status));

  // The endpoint needs at least columns 0-4 defined; order references column 2.
  const cols = ["tender_No", "description", "closing_Date", "category", "province"];
  cols.forEach((data, i) => {
    p.set(`columns[${i}][data]`, data);
    p.set(`columns[${i}][name]`, "");
    p.set(`columns[${i}][searchable]`, "true");
    p.set(`columns[${i}][orderable]`, "true");
    p.set(`columns[${i}][search][value]`, "");
    p.set(`columns[${i}][search][regex]`, "false");
  });
  p.set("order[0][column]", "2");
  p.set("order[0][dir]", "desc");
  p.set("search[value]", "");
  p.set("search[regex]", "false");
  return p.toString();
}

/**
 * Fetch one page of portal tenders for a status.
 * @param status 1=advertised 2=awarded 3=closed 4=cancelled
 * @param start  row offset
 * @param length page size (<=500 recommended)
 */
export async function fetchPortalPage(
  status: number,
  start: number,
  length = 500,
): Promise<PortalPage> {
  const url = `${PORTAL_BASE}${PORTAL_ENDPOINT}?${buildPortalQuery(status, start, length)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Referer: `${PORTAL_BASE}/Home/opportunities?id=1`,
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Portal API ${res.status}`);

  const text = await res.text();
  const json = JSON.parse(text) as Partial<PortalPage>;
  return {
    recordsTotal: json.recordsTotal ?? 0,
    recordsFiltered: json.recordsFiltered ?? 0,
    data: Array.isArray(json.data) ? json.data : [],
  };
}

/** Parse portal dates: ISO strings or .NET `/Date(ms)/`. Returns null if invalid. */
export function parsePortalDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const net = /\/Date\((\d+)\)\//.exec(value);
  if (net) return new Date(parseInt(net[1], 10));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Map a portal record to a `tenders` row. Uses `ocid` as the key when present
 * so portal data MERGES with the OCDS-sourced row for the same process;
 * otherwise falls back to a stable `portal-<id>` key.
 */
export function mapPortalRecord(row: PortalRecord, statusId: number) {
  const ocid = row.ocid || null;
  const tenderNo = row.tender_No || String(row.id ?? "");
  return {
    tender_id: ocid || `portal-${row.id ?? tenderNo}`,
    tender_number: tenderNo || `portal-${row.id ?? ""}`,
    description: row.description || "(no description)",
    category: row.category || row.categories?.name || null,
    department: row.department || row.departments?.name || row.organ_of_State || null,
    province: row.province || row.provinces?.name || null,
    status: PORTAL_STATUS_MAP[statusId] ?? "active",
    date_advertised: parsePortalDate(row.date_Published),
    closing_date: parsePortalDate(row.closing_Date),
    ocid,
    raw_portal_data: row as Record<string, unknown>,
    sync_source: "portal",
    updated_at: new Date(),
  };
}
