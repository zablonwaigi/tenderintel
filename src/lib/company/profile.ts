import type { User } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { createServerAuthClient } from "@/lib/supabase/serverClient";
import type { Company } from "@/types/company";
import type { CompanyProfileInput } from "@/lib/matching/score";

/** Current authenticated user from the session cookie, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createServerAuthClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Ensure a profiles row exists for this user (lazy create on first visit). */
export async function ensureProfile(user: User): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("profiles")
    .upsert(
      { id: user.id, full_name: user.user_metadata?.full_name ?? null },
      { onConflict: "id", ignoreDuplicates: true },
    );
}

/** The user's company profile, or null if they haven't created one yet. */
export async function getCompany(userId: string): Promise<Company | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`getCompany failed: ${error.message}`);
  return (data as Company | null) ?? null;
}

export interface CompanyInput {
  name: string;
  registration_number: string | null;
  provinces: string[];
  industries: string[];
  services_offered: string | null;
  years_experience: number | null;
  annual_turnover_band: string | null;
  team_size: string | null;
  csd_registered: boolean;
  tax_compliant: boolean;
  bbbee_level: number | null;
  coida_registered: boolean;
  cidb_grade: string | null;
  nhbrc_registered: boolean;
  psira_registered: boolean;
  has_capability_statement: boolean;
}

/** Create or update the user's single company profile (server-side, service role). */
export async function upsertCompany(userId: string, input: CompanyInput): Promise<Company> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("companies")
    .upsert(
      { user_id: userId, ...input, onboarding_complete: true },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(`upsertCompany failed: ${error.message}`);
  return data as Company;
}

/** Map a stored company row to the matching engine's input shape. */
export function toProfileInput(c: Company): CompanyProfileInput {
  return {
    provinces: c.provinces ?? [],
    industries: c.industries ?? [],
    servicesOffered: c.services_offered,
    yearsExperience: c.years_experience,
    turnoverBand: c.annual_turnover_band,
    csdRegistered: c.csd_registered,
    taxCompliant: c.tax_compliant,
    bbbeeLevel: c.bbbee_level,
    coidaRegistered: c.coida_registered,
    cidbGrade: c.cidb_grade,
    nhbrcRegistered: c.nhbrc_registered,
    psiraRegistered: c.psira_registered,
    hasCapabilityStatement: c.has_capability_statement,
  };
}

// ---- Readiness score (Blueprint Module 2) ---------------------------------

export type ReadinessStatus =
  | "tender_ready"
  | "documents_missing"
  | "registrations_missing"
  | "needs_assistance";

export interface ReadinessItem {
  code: string;
  label: string;
  held: boolean;
  serviceKind: string; // maps to a service_request kind
}

export interface Readiness {
  percent: number;
  status: ReadinessStatus;
  statusLabel: string;
  items: ReadinessItem[];
  missing: ReadinessItem[];
}

export function computeReadiness(c: Company): Readiness {
  const items: ReadinessItem[] = [
    { code: "csd", label: "CSD registration", held: c.csd_registered, serviceKind: "csd" },
    { code: "tax", label: "SARS Tax Compliance (TCS)", held: c.tax_compliant, serviceKind: "tax" },
    { code: "bbbee", label: "B-BBEE certificate / affidavit", held: c.bbbee_level != null, serviceKind: "bbbee" },
    { code: "coida", label: "COIDA / Letter of Good Standing", held: c.coida_registered, serviceKind: "coida" },
    { code: "capability", label: "Company / capability statement", held: c.has_capability_statement, serviceKind: "capability" },
  ];
  const held = items.filter((i) => i.held).length;
  const percent = Math.round((held / items.length) * 100);
  const missing = items.filter((i) => !i.held);

  let status: ReadinessStatus;
  let statusLabel: string;
  if (percent === 100) {
    status = "tender_ready";
    statusLabel = "Tender-ready";
  } else if (percent >= 60) {
    status = "documents_missing";
    statusLabel = "Almost there — a few documents missing";
  } else if (percent >= 40) {
    status = "registrations_missing";
    statusLabel = "Key registrations missing";
  } else {
    status = "needs_assistance";
    statusLabel = "Needs GrowYourBiz assistance";
  }
  return { percent, status, statusLabel, items, missing };
}
