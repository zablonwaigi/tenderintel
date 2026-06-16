import { createServiceClient } from "@/lib/supabase/server";
import type { TenderWithDocuments } from "@/types/tender";
import type { TenderDocument } from "@/types/document";

/**
 * Fetch a single tender with its documents (excluding heavy parsed_text).
 */
export async function getTenderWithDocuments(
  tenderId: string
): Promise<TenderWithDocuments | null> {
  const supabase = createServiceClient();

  const { data: tender, error } = await supabase
    .from("tenders")
    .select(
      "id, tender_id, tender_number, description, category, department, province, status, date_advertised, closing_date, advertised_amount, awarded_amount, awarded_to, ocid, ai_summary, ai_keywords, ai_requirements, ai_compliance, created_at, updated_at"
    )
    .eq("tender_id", tenderId)
    .maybeSingle();

  if (error) throw new Error(`getTender failed: ${error.message}`);
  if (!tender) return null;

  const { data: docs } = await supabase
    .from("tender_documents")
    .select(
      "id, tender_id, file_name, file_size, file_type, source_url, storage_path, download_status, parse_status, parsed_at, downloaded_at, created_at"
    )
    .eq("tender_id", tenderId)
    .order("file_name");

  return {
    ...(tender as unknown as TenderWithDocuments),
    documents: (docs ?? []) as TenderDocument[],
    full_text: null,
    ocds_data: null,
    raw_portal_data: null,
  };
}

/**
 * Related tenders: same category, excluding the current one.
 */
export async function getRelatedTenders(
  tenderId: string,
  category: string | null,
  limit = 4
) {
  if (!category) return [];
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("tenders")
    .select(
      "id, tender_id, tender_number, description, category, department, province, status, closing_date, awarded_amount, awarded_to, advertised_amount, date_advertised, ai_summary"
    )
    .eq("category", category)
    .neq("tender_id", tenderId)
    .order("date_advertised", { ascending: false, nullsFirst: false })
    .limit(limit);
  return data ?? [];
}
