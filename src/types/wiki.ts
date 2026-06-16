export type WikiCategory = "form" | "process" | "glossary" | "guide";

export interface WikiArticle {
  id: string;
  slug: string;
  title: string;
  category: WikiCategory | string;
  content: string; // markdown
  summary: string | null;
  form_code: string | null;
  related_forms: string[] | null;
  tags: string[] | null;
  view_count: number;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

// Listing variant without the heavy markdown body.
export type WikiArticleListItem = Omit<WikiArticle, "content">;
