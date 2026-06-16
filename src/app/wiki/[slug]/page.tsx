import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { WikiArticle } from "@/components/wiki/WikiArticle";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { getWikiArticle, listWikiArticles, countTendersForForm } from "@/lib/wiki/query";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps) {
  try {
    const article = await getWikiArticle(params.slug);
    if (article) return { title: article.title, description: article.summary ?? undefined };
  } catch {
    // ignore
  }
  return { title: "Wiki" };
}

export default async function WikiArticlePage({ params }: PageProps) {
  const article = await getWikiArticle(params.slug).catch(() => null);
  if (!article) notFound();

  const [all, tenderCount] = await Promise.all([
    listWikiArticles().catch(() => []),
    countTendersForForm(article.form_code, article.title).catch(() => 0),
  ]);

  const related = all
    .filter((a) => a.slug !== article.slug && a.category === article.category)
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/wiki"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-sa-green"
      >
        <ArrowLeft className="h-4 w-4" /> Back to wiki
      </Link>

      <h1 className="mb-5 text-3xl font-bold text-gray-900">{article.title}</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WikiArticle article={article} />
        </div>

        <div className="space-y-6">
          {article.form_code && tenderCount > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-900">
                  Tenders that required this form
                </h2>
              </CardHeader>
              <CardBody>
                <p className="text-2xl font-extrabold text-sa-green">
                  {tenderCount.toLocaleString("en-ZA")}
                </p>
                <Link
                  href={`/tenders?q=${encodeURIComponent(article.form_code)}`}
                  className="mt-1 inline-block text-sm text-sa-green hover:underline"
                >
                  View related tenders →
                </Link>
              </CardBody>
            </Card>
          )}

          {related.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-900">Related Articles</h2>
              </CardHeader>
              <CardBody>
                <ul className="space-y-2">
                  {related.map((a) => (
                    <li key={a.slug}>
                      <Link
                        href={`/wiki/${a.slug}`}
                        className="text-sm font-medium text-sa-green hover:underline"
                      >
                        {a.title} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
