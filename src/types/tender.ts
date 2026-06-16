export type TenderStatus = "active" | "awarded" | "closed" | "cancelled";

export interface Tender {
  id: string;
  tender_id: string;
  tender_number: string;
  description: string;
  category: string | null;
  department: string | null;
  province: string | null;
  status: TenderStatus;
  date_advertised: string | null;
  closing_date: string | null;
  advertised_amount: number | null; // cents
  awarded_amount: number | null; // cents
  awarded_to: string | null;
  ocid: string | null;
  ocds_data: Record<string, unknown> | null;
  raw_portal_data: Record<string, unknown> | null;
  full_text: string | null;
  ai_summary: string | null;
  ai_keywords: string[] | null;
  ai_requirements: string[] | null;
  ai_compliance: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface TenderWithDocuments extends Tender {
  documents: import("./document").TenderDocument[];
  document_count?: number;
}

export interface TenderSearchResult {
  data: TenderListItem[];
  count: number;
  page: number;
  totalPages: number;
}

// Lighter row used in list/search views (no heavy text fields).
export interface TenderListItem {
  id: string;
  tender_id: string;
  tender_number: string;
  description: string;
  category: string | null;
  department: string | null;
  province: string | null;
  status: TenderStatus;
  date_advertised: string | null;
  closing_date: string | null;
  advertised_amount: number | null;
  awarded_amount: number | null;
  awarded_to: string | null;
  ai_summary: string | null;
  document_count?: number;
}
