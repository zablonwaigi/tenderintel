import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { WIKI_ARTICLES } from "./articles";

export interface SeedResult {
  upserted: number;
}

/**
 * Upsert the pre-built wiki articles into the database. Idempotent —
 * safe to run repeatedly; existing rows are updated by slug.
 */
export async function seedWiki(supabase?: SupabaseClient): Promise<SeedResult> {
  const db = supabase ?? createServiceClient();

  const rows = WIKI_ARTICLES.map((a) => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    content: a.content,
    summary: a.summary,
    form_code: a.form_code ?? null,
    related_forms: a.related_forms ?? null,
    tags: a.tags,
    ai_generated: false,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db.from("wiki_articles").upsert(rows, { onConflict: "slug" });
  if (error) throw new Error(`Failed to seed wiki: ${error.message}`);

  return { upserted: rows.length };
}
