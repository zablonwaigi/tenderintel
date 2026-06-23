import { createServiceClient } from "@/lib/supabase/server";
import { scoreMatch, type MatchResult, type TenderInput } from "@/lib/matching/score";
import { toProfileInput } from "@/lib/company/profile";
import type { Company } from "@/types/company";
import type { TenderListItem } from "@/types/tender";

const CANDIDATE_COLUMNS =
  "id, tender_id, tender_number, description, category, department, province, status, date_advertised, closing_date, advertised_amount, awarded_amount, awarded_to, ai_summary, ai_keywords, ai_requirements, ai_compliance";

// Bound the candidate pool we score in-process. Scoring is cheap; this keeps the
// page fast and predictable. Caching into a tender_matches table is a documented
// later optimisation (Blueprint §2.1).
const CANDIDATE_LIMIT = 500;

interface CandidateRow extends TenderListItem {
  ai_keywords: string[] | null;
  ai_requirements: string[] | null;
  ai_compliance: string[] | null;
}

export interface ScoredTender {
  tender: TenderListItem;
  match: MatchResult;
}

export interface MatchBuckets {
  strong: ScoredTender[];
  possible: ScoredTender[];
  closingSoon: ScoredTender[];
  missingDocs: ScoredTender[];
  totalScored: number;
}

const PER_BUCKET = 30;

function toTenderInput(row: CandidateRow): TenderInput {
  return {
    category: row.category,
    province: row.province,
    description: row.description,
    keywords: row.ai_keywords,
    requirements: row.ai_requirements,
    compliance: row.ai_compliance,
    closingDate: row.closing_date,
    advertisedAmount: row.advertised_amount,
  };
}

/**
 * Score live tenders against a company profile and split into the lanes the
 * "My Matches" page renders. Pure ranking happens in-process over a bounded
 * candidate set of soonest-closing active tenders.
 */
export async function getMatchesForCompany(company: Company): Promise<MatchBuckets> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("tenders")
    .select(CANDIDATE_COLUMNS)
    .eq("status", "active")
    .or(`closing_date.is.null,closing_date.gte.${nowIso}`)
    .order("closing_date", { ascending: true, nullsFirst: false })
    .limit(CANDIDATE_LIMIT);

  if (error) throw new Error(`getMatchesForCompany failed: ${error.message}`);

  const profile = toProfileInput(company);
  const now = new Date();
  const scored: ScoredTender[] = (data ?? []).map((row) => {
    const r = row as CandidateRow;
    return { tender: r as TenderListItem, match: scoreMatch(profile, toTenderInput(r), now) };
  });

  // Rank by score desc for the main lanes.
  scored.sort((a, b) => b.match.score - a.match.score);

  const strong = scored.filter((s) => s.match.band === "strong").slice(0, PER_BUCKET);
  const possible = scored.filter((s) => s.match.band === "possible").slice(0, PER_BUCKET);

  // Closing soon: relevant (>= possible) AND closing within 7 days, soonest first.
  const closingSoon = scored
    .filter((s) => s.match.band !== "weak" && s.match.daysToClose != null && s.match.daysToClose >= 0 && s.match.daysToClose <= 7)
    .sort((a, b) => (a.match.daysToClose ?? 99) - (b.match.daysToClose ?? 99))
    .slice(0, PER_BUCKET);

  // Missing-document opportunities: a good fit blocked only by compliance docs —
  // the highest-value GrowYourBiz escalation lane.
  const missingDocs = scored
    .filter((s) => s.match.score >= 50 && s.match.missingCompliance.length > 0)
    .slice(0, PER_BUCKET);

  return { strong, possible, closingSoon, missingDocs, totalScored: scored.length };
}
