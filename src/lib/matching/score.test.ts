import { describe, it, expect } from "vitest";
import { scoreMatch, daysUntil, type CompanyProfileInput, type TenderInput } from "./score";

const NOW = new Date("2026-06-23T00:00:00Z");

const READY_COMPANY: CompanyProfileInput = {
  provinces: ["Gauteng"],
  industries: ["Cleaning & Hygiene"],
  servicesOffered: "Commercial cleaning and hygiene services",
  yearsExperience: 5,
  turnoverBand: "1-5m",
  csdRegistered: true,
  taxCompliant: true,
  bbbeeLevel: 1,
  coidaRegistered: true,
  cidbGrade: null,
  nhbrcRegistered: false,
  psiraRegistered: false,
  hasCapabilityStatement: true,
};

function tenderClosingInDays(days: number, over: Partial<TenderInput> = {}): TenderInput {
  const closing = new Date(NOW.getTime() + days * 86_400_000).toISOString();
  return {
    category: "Cleaning Services",
    province: "Gauteng",
    description: "Provision of cleaning and hygiene services for government offices.",
    keywords: ["cleaning", "hygiene"],
    requirements: ["Valid tax clearance", "CSD registration", "B-BBEE certificate"],
    compliance: ["Tax compliance", "CSD", "B-BBEE"],
    closingDate: closing,
    advertisedAmount: 200_000_000, // R2m in cents
    ...over,
  };
}

describe("daysUntil", () => {
  it("computes future days", () => {
    expect(daysUntil(new Date(NOW.getTime() + 5 * 86_400_000).toISOString(), NOW)).toBe(5);
  });
  it("returns null for missing/invalid dates", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil("not-a-date", NOW)).toBeNull();
  });
});

describe("scoreMatch", () => {
  it("scores a well-matched, fully-compliant company as a strong bid", () => {
    const r = scoreMatch(READY_COMPANY, tenderClosingInDays(20), NOW);
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.band).toBe("strong");
    expect(r.missingCompliance).toHaveLength(0);
    expect(r.recommendedAction).toBe("bid");
  });

  it("flags missing compliance and recommends getting documents", () => {
    const company = { ...READY_COMPANY, taxCompliant: false, csdRegistered: false };
    const r = scoreMatch(company, tenderClosingInDays(20), NOW);
    expect(r.missingCompliance).toContain("tax");
    expect(r.missingCompliance).toContain("csd");
    expect(["needs_docs", "shortlist"]).toContain(r.recommendedAction);
  });

  it("recommends a partner when the tender dwarfs company capacity", () => {
    const small = { ...READY_COMPANY, turnoverBand: "0-1m" };
    const big = tenderClosingInDays(20, { advertisedAmount: 5_000_000_000 }); // R50m
    const r = scoreMatch(small, big, NOW);
    expect(r.recommendedAction).toBe("find_partner");
  });

  it("skips an already-closed tender", () => {
    const r = scoreMatch(READY_COMPANY, tenderClosingInDays(-2), NOW);
    expect(r.recommendedAction).toBe("skip");
    const deadline = r.factors.find((f) => f.key === "deadline");
    expect(deadline?.points).toBe(0);
  });

  it("skips tenders well outside the company's industry", () => {
    const offTopic = tenderClosingInDays(20, {
      category: "Construction of bridges",
      description: "Civil engineering works for road and bridge construction.",
      keywords: ["civil", "construction", "bridge"],
    });
    const r = scoreMatch(READY_COMPANY, offTopic, NOW);
    const industry = r.factors.find((f) => f.key === "industry");
    expect(industry!.points).toBeLessThan(industry!.max * 0.5);
  });

  it("always returns six factors summing to the total score", () => {
    const r = scoreMatch(READY_COMPANY, tenderClosingInDays(10), NOW);
    expect(r.factors).toHaveLength(6);
    expect(r.factors.reduce((s, f) => s + f.points, 0)).toBe(r.score);
  });
});
