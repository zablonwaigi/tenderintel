// ============================================
// Deterministic, explainable tender-match scoring (Blueprint §3).
//
// No AI on the hot path: pure functions over the company profile + the tender's
// (already-extracted) fields. Every factor returns its own points + a plain-
// English reason so the UI can explain *why* a tender matched — that explanation
// is the product, not the number.
//
// Score /100 = Industry 25 + Location 15 + Compliance 20 + Capacity 15
//            + Deadline 10 + DocumentReadiness 15
// ============================================

export interface CompanyProfileInput {
  provinces: string[];
  industries: string[];
  servicesOffered: string | null;
  yearsExperience: number | null;
  turnoverBand: string | null; // '0-1m'|'1-5m'|'5-20m'|'20m+'
  csdRegistered: boolean;
  taxCompliant: boolean;
  bbbeeLevel: number | null;
  coidaRegistered: boolean;
  cidbGrade: string | null;
  nhbrcRegistered: boolean;
  psiraRegistered: boolean;
  hasCapabilityStatement: boolean;
}

export interface TenderInput {
  category: string | null;
  province: string | null;
  description: string | null;
  keywords: string[] | null;
  requirements: string[] | null;
  compliance: string[] | null; // ai_compliance: documents likely needed
  closingDate: string | null;
  advertisedAmount: number | null; // cents
}

export interface FactorScore {
  key: string;
  label: string;
  points: number;
  max: number;
  reason: string;
}

export type MatchBand = "strong" | "possible" | "weak";
export type RecommendedAction =
  | "bid"
  | "shortlist"
  | "needs_docs"
  | "find_partner"
  | "skip";

export interface MatchResult {
  score: number; // 0..100
  band: MatchBand;
  factors: FactorScore[];
  reasons: string[]; // positive highlights
  risks: string[]; // what could block the bid
  missingCompliance: string[]; // registration codes the tender needs but company lacks
  daysToClose: number | null;
  recommendedAction: RecommendedAction;
}

const STOPWORDS = new Set([
  "and", "the", "for", "of", "to", "in", "a", "an", "or", "with", "services",
  "service", "supply", "supplies", "general", "works", "work", "provision",
  "appointment", "panel", "various", "etc",
]);

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

// ---- Compliance requirement detection -------------------------------------
// Map of registration code -> regex that signals the tender needs it, scanned
// over the tender's compliance/requirements/description text.
const COMPLIANCE_SIGNALS: { code: string; label: string; re: RegExp }[] = [
  { code: "csd", label: "CSD registration", re: /\bcsd\b|central supplier database/i },
  { code: "tax", label: "SARS tax compliance", re: /tax clearance|tax compliance|\btcs\b|sars/i },
  { code: "bbbee", label: "B-BBEE certificate", re: /b-?bbee|bee certificate|broad-based/i },
  { code: "coida", label: "COIDA / Letter of Good Standing", re: /coida|letter of good standing|workmen|compensation fund/i },
  { code: "cidb", label: "CIDB grading", re: /\bcidb\b|construction industry development/i },
  { code: "nhbrc", label: "NHBRC registration", re: /\bnhbrc\b|home builders/i },
  { code: "psira", label: "PSIRA registration", re: /\bpsira\b|security industry regulat/i },
];

function companyHas(code: string, c: CompanyProfileInput): boolean {
  switch (code) {
    case "csd": return c.csdRegistered;
    case "tax": return c.taxCompliant;
    case "bbbee": return c.bbbeeLevel != null;
    case "coida": return c.coidaRegistered;
    case "cidb": return !!c.cidbGrade;
    case "nhbrc": return c.nhbrcRegistered;
    case "psira": return c.psiraRegistered;
    default: return false;
  }
}

const TURNOVER_RANK: Record<string, number> = { "0-1m": 1, "1-5m": 2, "5-20m": 3, "20m+": 4 };

/** Days from now to the closing date; negative = already closed; null = unknown. */
export function daysUntil(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - now.getTime()) / 86_400_000);
}

// ---- Individual factors ----------------------------------------------------

function industryFit(c: CompanyProfileInput, t: TenderInput): FactorScore {
  const max = 25;
  const haystack = tokenise(
    [t.category, t.description, ...(t.keywords ?? [])].filter(Boolean).join(" "),
  );
  const needleSource = [...c.industries, c.servicesOffered ?? ""].join(" ");
  const needles = tokenise(needleSource);

  if (needles.size === 0) {
    return { key: "industry", label: "Industry fit", points: Math.round(max * 0.4), max,
      reason: "No industries selected yet — add your services to sharpen matching." };
  }
  // Direct category-label match is the strongest signal.
  const catLower = (t.category ?? "").toLowerCase();
  const directCategory = c.industries.some((ind) => {
    const indTokens = tokenise(ind);
    return [...indTokens].some((tok) => catLower.includes(tok));
  });

  let overlap = 0;
  for (const n of needles) if (haystack.has(n)) overlap += 1;
  const frac = overlap / Math.min(needles.size, 6); // cap denominator so a few hits suffice

  let points = Math.min(max, Math.round(frac * max));
  if (directCategory) points = Math.max(points, Math.round(max * 0.8));

  const reason = points >= max * 0.7
    ? "Strong match to what your business does."
    : points >= max * 0.4
      ? "Partial match to your industry — review the scope."
      : "Weak industry match — this may be outside your core services.";
  return { key: "industry", label: "Industry fit", points, max, reason };
}

function locationFit(c: CompanyProfileInput, t: TenderInput): FactorScore {
  const max = 15;
  const tp = (t.province ?? "").trim().toLowerCase();
  const serves = c.provinces.map((p) => p.toLowerCase());
  const national = serves.includes("national");

  if (!tp) {
    return { key: "location", label: "Location fit", points: Math.round(max * 0.6), max,
      reason: "Tender location not specified." };
  }
  if (national || serves.includes(tp)) {
    return { key: "location", label: "Location fit", points: max, max,
      reason: `In a province you operate in (${t.province}).` };
  }
  if (serves.length === 0) {
    return { key: "location", label: "Location fit", points: Math.round(max * 0.5), max,
      reason: "Add your operating provinces to improve location matching." };
  }
  return { key: "location", label: "Location fit", points: Math.round(max * 0.2), max,
    reason: `Outside your operating area (${t.province}).` };
}

function complianceFit(c: CompanyProfileInput, t: TenderInput): {
  factor: FactorScore;
  missing: { code: string; label: string }[];
} {
  const max = 20;
  const text = [
    ...(t.compliance ?? []),
    ...(t.requirements ?? []),
    t.description ?? "",
  ].join(" \n ");

  const required = COMPLIANCE_SIGNALS.filter((s) => s.re.test(text));
  if (required.length === 0) {
    return {
      factor: { key: "compliance", label: "Compliance fit", points: max, max,
        reason: "No special registrations flagged for this tender." },
      missing: [],
    };
  }
  const missing = required.filter((s) => !companyHas(s.code, c)).map((s) => ({ code: s.code, label: s.label }));
  const met = required.length - missing.length;
  const points = Math.round((met / required.length) * max);
  const reason = missing.length === 0
    ? "You hold every registration this tender requires."
    : `Missing ${missing.length} of ${required.length} required: ${missing.map((m) => m.label).join(", ")}.`;
  return { factor: { key: "compliance", label: "Compliance fit", points, max, reason }, missing };
}

function capacityFit(c: CompanyProfileInput, t: TenderInput): FactorScore {
  const max = 15;
  const rand = c.turnoverBand ? TURNOVER_RANK[c.turnoverBand] ?? 0 : 0;
  // Value signal: convert cents -> rand thresholds (rough bands).
  const value = t.advertisedAmount != null ? t.advertisedAmount / 100 : null;

  if (value == null) {
    // No value advertised — neutral, lean on experience.
    const expBonus = (c.yearsExperience ?? 0) >= 2 ? 0.7 : 0.5;
    return { key: "capacity", label: "Capacity fit", points: Math.round(max * expBonus), max,
      reason: "Tender value not advertised — judged on your experience." };
  }
  // Map tender value to a required turnover rank.
  let neededRank = 1;
  if (value > 20_000_000) neededRank = 4;
  else if (value > 5_000_000) neededRank = 3;
  else if (value > 1_000_000) neededRank = 2;

  if (rand === 0) {
    return { key: "capacity", label: "Capacity fit", points: Math.round(max * 0.5), max,
      reason: "Add your turnover band to assess capacity fit." };
  }
  if (rand >= neededRank) {
    return { key: "capacity", label: "Capacity fit", points: max, max,
      reason: "Your turnover comfortably covers this tender's likely size." };
  }
  const gap = neededRank - rand;
  const points = Math.max(0, Math.round(max * (gap === 1 ? 0.5 : 0.2)));
  return { key: "capacity", label: "Capacity fit", points, max,
    reason: gap === 1
      ? "This tender may stretch your capacity — consider a partner."
      : "This tender looks larger than your current capacity — partnering is advisable." };
}

function deadlineFit(daysToClose: number | null): FactorScore {
  const max = 10;
  if (daysToClose == null) {
    return { key: "deadline", label: "Deadline fit", points: Math.round(max * 0.5), max,
      reason: "Closing date unknown — verify on eTenders." };
  }
  if (daysToClose < 0) {
    return { key: "deadline", label: "Deadline fit", points: 0, max, reason: "This tender has closed." };
  }
  if (daysToClose >= 14) return { key: "deadline", label: "Deadline fit", points: max, max, reason: `${daysToClose} days to prepare — comfortable.` };
  if (daysToClose >= 7) return { key: "deadline", label: "Deadline fit", points: 7, max, reason: `${daysToClose} days left — workable if you start now.` };
  if (daysToClose >= 3) return { key: "deadline", label: "Deadline fit", points: 5, max, reason: `Only ${daysToClose} days left — tight.` };
  if (daysToClose >= 1) return { key: "deadline", label: "Deadline fit", points: 3, max, reason: `Closing in ${daysToClose} day(s) — very tight.` };
  return { key: "deadline", label: "Deadline fit", points: 1, max, reason: "Closing today — likely too late to prepare a quality bid." };
}

// Document readiness uses the core reusable compliance pack as a proxy for the
// vault (until the Document Vault module lands): CSD, tax, B-BBEE, COIDA and a
// capability statement are the documents nearly every bid needs.
function documentReadiness(c: CompanyProfileInput): FactorScore {
  const max = 15;
  const core = [c.csdRegistered, c.taxCompliant, c.bbbeeLevel != null, c.coidaRegistered, c.hasCapabilityStatement];
  const have = core.filter(Boolean).length;
  const points = Math.round((have / core.length) * max);
  return { key: "documents", label: "Document readiness", points, max,
    reason: `You have ${have} of ${core.length} core bid documents ready.` };
}

// ---- Public entry point ----------------------------------------------------

export function scoreMatch(
  company: CompanyProfileInput,
  tender: TenderInput,
  now: Date = new Date(),
): MatchResult {
  const daysToClose = daysUntil(tender.closingDate, now);

  const industry = industryFit(company, tender);
  const location = locationFit(company, tender);
  const { factor: compliance, missing } = complianceFit(company, tender);
  const capacity = capacityFit(company, tender);
  const deadline = deadlineFit(daysToClose);
  const documents = documentReadiness(company);

  const factors = [industry, location, compliance, capacity, deadline, documents];
  const score = factors.reduce((s, f) => s + f.points, 0);

  const band: MatchBand = score >= 70 ? "strong" : score >= 40 ? "possible" : "weak";

  const reasons = factors
    .filter((f) => f.points >= f.max * 0.7)
    .map((f) => f.reason);
  const risks = factors
    .filter((f) => f.points < f.max * 0.5)
    .map((f) => f.reason);

  const recommendedAction = decideAction({ score, band, missing, daysToClose, capacity, industry });

  return {
    score,
    band,
    factors,
    reasons,
    risks,
    missingCompliance: missing.map((m) => m.code),
    daysToClose,
    recommendedAction,
  };
}

function decideAction(args: {
  score: number;
  band: MatchBand;
  missing: { code: string; label: string }[];
  daysToClose: number | null;
  capacity: FactorScore;
  industry: FactorScore;
}): RecommendedAction {
  const { score, missing, daysToClose, capacity, industry } = args;
  if (daysToClose != null && daysToClose < 0) return "skip";
  if (industry.points < industry.max * 0.4) return "skip";
  if (capacity.points <= capacity.max * 0.3) return "find_partner";
  if (missing.length > 0 && score >= 55) return "needs_docs";
  if (score >= 70) return "bid";
  if (score >= 45) return "shortlist";
  return "skip";
}

export const ACTION_LABELS: Record<RecommendedAction, string> = {
  bid: "Bid",
  shortlist: "Shortlist",
  needs_docs: "Get documents",
  find_partner: "Find a partner",
  skip: "Skip",
};
