import { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are an expert in South African government procurement. Analyse this tender and extract:

1. A clear 2-3 sentence summary of what is being procured
2. Key requirements (list of 5-10 specific things bidders must have/provide)
3. Keywords (5-10 tags describing the tender)
4. Compliance documents likely needed (e.g. BBBEE certificate, tax clearance, CSD registration)

Return JSON: { summary: string, requirements: string[], keywords: string[], compliance: string[] }`;

const MODEL = "gpt-4o";
const MAX_INPUT_CHARS = 24_000;

export interface AnalyseResult {
  analysed: number;
  failed: number;
  processed: number;
}

interface AnalysisJson {
  summary?: string;
  requirements?: string[];
  keywords?: string[];
  compliance?: string[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AiAnalyser {
  private supabase: SupabaseClient;
  private openai: OpenAI;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase ?? createServiceClient();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async analyseTender(tenderId: string): Promise<boolean> {
    const { data: tender, error } = await this.supabase
      .from("tenders")
      .select("tender_id, tender_number, description, category, department, province, full_text")
      .eq("tender_id", tenderId)
      .single();

    if (error || !tender) {
      console.error(`analyseTender: tender ${tenderId} not found`, error);
      return false;
    }

    const context = [
      `Tender Number: ${tender.tender_number}`,
      `Description: ${tender.description}`,
      tender.category ? `Category: ${tender.category}` : "",
      tender.department ? `Department: ${tender.department}` : "",
      tender.province ? `Province: ${tender.province}` : "",
      "",
      "Document text:",
      (tender.full_text ?? "").slice(0, MAX_INPUT_CHARS),
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const completion = await this.openai.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: context },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as AnalysisJson;

      await this.supabase
        .from("tenders")
        .update({
          ai_summary: parsed.summary ?? null,
          ai_requirements: parsed.requirements ?? null,
          ai_keywords: parsed.keywords ?? null,
          ai_compliance: parsed.compliance ?? null,
        })
        .eq("tender_id", tenderId);

      return true;
    } catch (err) {
      console.error(`analyseTender failed for ${tenderId}:`, err);
      return false;
    }
  }

  /**
   * Analyse up to `limit` tenders that have parsed text but no AI summary.
   * Rate limited to ~3 requests/second.
   */
  async analyseAllPending(limit = 50): Promise<AnalyseResult> {
    const { data, error } = await this.supabase
      .from("tenders")
      .select("tender_id")
      .is("ai_summary", null)
      .not("full_text", "is", null)
      .limit(limit);

    if (error) throw new Error(`Failed to query tenders for analysis: ${error.message}`);

    const rows = (data ?? []) as { tender_id: string }[];
    const result: AnalyseResult = { analysed: 0, failed: 0, processed: rows.length };

    for (const row of rows) {
      const ok = await this.analyseTender(row.tender_id);
      if (ok) result.analysed += 1;
      else result.failed += 1;
      await sleep(350); // ~3 req/s
    }

    return result;
  }
}
