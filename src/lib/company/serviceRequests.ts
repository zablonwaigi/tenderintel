import { createServiceClient } from "@/lib/supabase/server";
import type { ServiceRequest, ServiceRequestKind } from "@/types/company";

export interface NewServiceRequest {
  userId: string;
  companyId: string | null;
  kind: ServiceRequestKind;
  tenderId?: string | null;
  message?: string | null;
}

const VALID_KINDS: ServiceRequestKind[] = [
  "csd", "tax", "bbbee", "coida", "capability", "bid_pack", "general",
];

export function isValidKind(kind: string): kind is ServiceRequestKind {
  return (VALID_KINDS as string[]).includes(kind);
}

/** Create a GrowYourBiz service request (the lead-capture row). */
export async function createServiceRequest(req: NewServiceRequest): Promise<ServiceRequest> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      user_id: req.userId,
      company_id: req.companyId,
      kind: req.kind,
      tender_id: req.tenderId ?? null,
      message: req.message ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createServiceRequest failed: ${error.message}`);
  return data as ServiceRequest;
}

export async function listServiceRequests(userId: string): Promise<ServiceRequest[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listServiceRequests failed: ${error.message}`);
  return (data ?? []) as ServiceRequest[];
}

export const KIND_LABELS: Record<ServiceRequestKind, string> = {
  csd: "CSD registration / update",
  tax: "SARS Tax Compliance (TCS)",
  bbbee: "B-BBEE affidavit / certificate",
  coida: "COIDA / Letter of Good Standing",
  capability: "Capability statement",
  bid_pack: "Full bid pack preparation",
  general: "General assistance",
};
