import { createServiceClient } from "@/lib/supabase/server";
import type { WikiArticle, WikiArticleListItem } from "@/types/wiki";

const LIST_COLUMNS =
  "id, slug, title, category, summary, form_code, related_forms, tags, view_count, ai_generated, created_at, updated_at";

export async function listWikiArticles(): Promise<WikiArticleListItem[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("wiki_articles")
    .select(LIST_COLUMNS)
    .order("title");
  if (error) throw new Error(`listWikiArticles failed: ${error.message}`);
  return (data ?? []) as WikiArticleListItem[];
}

export async function getWikiArticle(slug: string): Promise<WikiArticle | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("wiki_articles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getWikiArticle failed: ${error.message}`);
  if (!data) return null;

  // Best-effort view counter (ignore failures).
  void supabase
    .from("wiki_articles")
    .update({ view_count: (data.view_count ?? 0) + 1 })
    .eq("slug", slug)
    .then(() => undefined);

  return data as WikiArticle;
}

/**
 * Count tenders whose AI compliance list references this form/topic.
 */
export async function countTendersForForm(formCode: string | null, title: string): Promise<number> {
  if (!formCode) return 0;
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("tenders")
    .select("*", { count: "exact", head: true })
    .or(`ai_compliance.cs.{${formCode}},ai_keywords.cs.{${formCode}}`);
  return count ?? 0;
}
