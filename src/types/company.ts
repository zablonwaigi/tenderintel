export interface Company {
  id: string;
  user_id: string;
  name: string;
  registration_number: string | null;
  provinces: string[];
  service_areas: string[];
  industries: string[];
  services_offered: string | null;
  years_experience: number | null;
  annual_turnover_band: string | null;
  team_size: string | null;
  plan: string;
  csd_registered: boolean;
  tax_compliant: boolean;
  bbbee_level: number | null;
  coida_registered: boolean;
  cidb_grade: string | null;
  nhbrc_registered: boolean;
  psira_registered: boolean;
  has_capability_statement: boolean;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export type ServiceRequestKind =
  | "csd"
  | "tax"
  | "bbbee"
  | "coida"
  | "capability"
  | "bid_pack"
  | "general";

export interface ServiceRequest {
  id: string;
  user_id: string;
  company_id: string | null;
  kind: ServiceRequestKind;
  tender_id: string | null;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}
