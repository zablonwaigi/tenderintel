import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const supabase = createServiceClient();

  let query = supabase
    .from("wiki_articles")
    .select(
      "id, slug, title, category, summary, form_code, related_forms, tags, view_count, ai_generated, created_at, updated_at"
    )
    .order("title");

  const category = sp.get("category");
  const tag = sp.get("tag");
  const q = sp.get("q");

  if (category) query = query.eq("category", category);
  if (tag) query = query.contains("tags", [tag]);
  if (q) {
    const term = q.replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`title.ilike.%${term}%,summary.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
