import { WikiCard } from "@/components/wiki/WikiCard";
import { Card, CardBody } from "@/components/ui/Card";
import { listWikiArticles } from "@/lib/wiki/query";
import type { WikiArticleListItem } from "@/types/wiki";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tender Wiki" };

const CATEGORY_ORDER = ["form", "guide", "process", "glossary"];
const CATEGORY_LABELS: Record<string, string> = {
  form: "SBD / MBD Forms",
  guide: "Compliance Guides",
  process: "How It Works",
  glossary: "Glossary",
};

export default async function WikiIndexPage() {
  let articles: WikiArticleListItem[] = [];
  let error: string | null = null;
  try {
    articles = await listWikiArticles();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load wiki";
  }

  const grouped = new Map<string, WikiArticleListItem[]>();
  for (const a of articles) {
    const list = grouped.get(a.category) ?? [];
    list.push(a);
    grouped.set(a.category, list);
  }

  const mostViewed = [...articles].sort((a, b) => b.view_count - a.view_count).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Tender Wiki</h1>
        <p className="mx-auto mt-2 max-w-2xl text-gray-600">
          Plain-English explanations of the SBD/MBD forms, compliance documents
          and processes you need to bid for South African government tenders.
        </p>
      </div>

      {error && (
        <Card className="mt-8">
          <CardBody>
            <p className="text-sm text-sa-red">Error: {error}</p>
          </CardBody>
        </Card>
      )}

      {articles.length === 0 && !error && (
        <Card className="mt-8">
          <CardBody>
            <p className="text-sm text-gray-500">
              No articles loaded yet. Seed the wiki via the dashboard or the
              <code className="mx-1 rounded bg-gray-100 px-1">/api/admin/seed-wiki</code>
              endpoint.
            </p>
          </CardBody>
        </Card>
      )}

      {mostViewed.some((a) => a.view_count > 0) && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-gray-900">Most Viewed</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {mostViewed.map((a) => (
              <WikiCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}

      {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((category) => (
        <section key={category} className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-gray-900">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(grouped.get(category) ?? []).map((a) => (
              <WikiCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
