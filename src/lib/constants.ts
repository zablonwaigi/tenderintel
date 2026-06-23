// Shared option lists for the SMME workspace. Kept in one place so the
// onboarding form, matching engine and filters stay in sync.

export const SA_PROVINCES = [
  "National",
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
] as const;

// Curated industry labels aligned to common eTenders categories. These strings
// are tokenised by the matching engine against each tender's category/keywords/
// description, so keep them descriptive.
export const INDUSTRY_CATEGORIES = [
  "Construction & Civil Works",
  "Cleaning & Hygiene",
  "Security Services",
  "Transport & Logistics",
  "ICT & Software",
  "Professional & Consulting Services",
  "Catering & Food",
  "Supplies & General Goods",
  "Electrical",
  "Plumbing",
  "Maintenance & Facilities",
  "Medical & Health",
  "Stationery & Office",
  "Training & Development",
  "Marketing & Events",
  "Agriculture",
] as const;

export const TURNOVER_BANDS = [
  { value: "0-1m", label: "Under R1 million" },
  { value: "1-5m", label: "R1m – R5m" },
  { value: "5-20m", label: "R5m – R20m" },
  { value: "20m+", label: "Over R20 million" },
] as const;

export const TEAM_SIZES = [
  { value: "1-5", label: "1 – 5 people" },
  { value: "6-20", label: "6 – 20 people" },
  { value: "21-50", label: "21 – 50 people" },
  { value: "50+", label: "More than 50" },
] as const;

// WhatsApp handover number for GrowYourBiz lead capture (E.164, no +).
export const GROWYOURBIZ_WHATSAPP = process.env.NEXT_PUBLIC_GYB_WHATSAPP || "27000000000";
