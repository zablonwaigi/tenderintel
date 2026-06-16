import { createServiceClient } from "@/lib/supabase/server";
import type { TenderListItem, TenderSearchResult } from "@/types/tender";

const LIST_COLUMNS =
  "id, tender_id, tender_number, description, category, department, province, status, date_advertised, closing_date, advertised_amount, awarded_amount, awarded_to, ai_summary";

export interface TenderQueryParams {
  q?: string;
  status?: string;
  category?: string;
  province?: string;
  page?: number;
  limit?: number;
}

/**
 * Search/filter tenders. Used by both the API route and server components.
 */
export async function queryTenders(params: TenderQueryParams): Promise<TenderSearchResult> {
  const supabase = createServiceClient();

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("tenders")
    .select(LIST_COLUMNS, { count: "exact" });

  if (params.q) {
    // Match against description OR accumulated document text.
    const term = params.q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(`description.ilike.%${term}%,full_text.ilike.%${term}%`);
    }
  }
  if (params.status) query = query.eq("status", params.status);
  if (params.category) query = query.eq("category", params.category);
  if (params.province) query = query.eq("province", params.province);

  query = query
    .order("closing_date", { ascending: false, nullsFirst: false })
    .range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(`queryTenders failed: ${error.message}`);

  return {
    data: (data ?? []) as TenderListItem[],
    count: count ?? 0,
    page,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
  };
}

/**
 * Distinct category list for filters (bounded).
 */
export async function getCategories(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tenders")
    .select("category")
    .not("category", "is", null)
    .limit(2000);
  if (error) return [];
  const set = new Set<string>();
  for (const row of data ?? []) {
    const c = (row as { category: string | null }).category;
    if (c) set.add(c);
  }
  return Array.from(set).sort();
}

export interface PlatformStats {
  totalTenders: number;
  activeTenders: number;
  documentsDownloaded: number;
  documentsPending: number;
  documentsParsed: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const supabase = createServiceClient();

  const counts = await Promise.all([
    supabase.from("tenders").select("*", { count: "exact", head: true }),
    supabase.from("tenders").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("tender_documents")
      .select("*", { count: "exact", head: true })
      .eq("download_status", "downloaded"),
    supabase
      .from("tender_documents")
      .select("*", { count: "exact", head: true })
      .eq("download_status", "pending"),
    supabase
      .from("tender_documents")
      .select("*", { count: "exact", head: true })
      .eq("parse_status", "parsed"),
  ]);

  return {
    totalTenders: counts[0].count ?? 0,
    activeTenders: counts[1].count ?? 0,
    documentsDownloaded: counts[2].count ?? 0,
    documentsPending: counts[3].count ?? 0,
    documentsParsed: counts[4].count ?? 0,
  };
}
