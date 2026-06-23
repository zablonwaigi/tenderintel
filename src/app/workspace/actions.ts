"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, getCompany, upsertCompany, type CompanyInput } from "@/lib/company/profile";
import { createServiceRequest, isValidKind } from "@/lib/company/serviceRequests";

// Every action re-verifies the session itself. The audit flagged unprotected
// Server Actions on the staff dashboard; we do NOT rely on middleware alone.
async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/signup?redirect=/workspace");
  return user;
}

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}
function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true";
}
function int(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s == null) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export async function saveCompany(formData: FormData): Promise<void> {
  const user = await requireUser();

  const name = str(formData, "name");
  if (!name) {
    // Name is the only hard requirement; bounce back to the form.
    redirect("/workspace/profile?error=name");
  }

  const input: CompanyInput = {
    name: name!,
    registration_number: str(formData, "registration_number"),
    provinces: formData.getAll("provinces").map(String).filter(Boolean),
    industries: formData.getAll("industries").map(String).filter(Boolean),
    services_offered: str(formData, "services_offered"),
    years_experience: int(formData, "years_experience"),
    annual_turnover_band: str(formData, "annual_turnover_band"),
    team_size: str(formData, "team_size"),
    csd_registered: bool(formData, "csd_registered"),
    tax_compliant: bool(formData, "tax_compliant"),
    bbbee_level: int(formData, "bbbee_level"),
    coida_registered: bool(formData, "coida_registered"),
    cidb_grade: str(formData, "cidb_grade"),
    nhbrc_registered: bool(formData, "nhbrc_registered"),
    psira_registered: bool(formData, "psira_registered"),
    has_capability_statement: bool(formData, "has_capability_statement"),
  };

  await upsertCompany(user.id, input);
  revalidatePath("/workspace");
  revalidatePath("/workspace/profile");
  redirect("/workspace?saved=1");
}

export async function requestHelp(formData: FormData): Promise<void> {
  const user = await requireUser();
  const kind = str(formData, "kind") ?? "general";
  if (!isValidKind(kind)) redirect("/workspace?error=kind");

  const company = await getCompany(user.id);
  await createServiceRequest({
    userId: user.id,
    companyId: company?.id ?? null,
    kind,
    tenderId: str(formData, "tender_id"),
    message: str(formData, "message"),
  });

  revalidatePath("/workspace/requests");
  const back = str(formData, "redirect") ?? "/workspace/requests?requested=1";
  redirect(back);
}
