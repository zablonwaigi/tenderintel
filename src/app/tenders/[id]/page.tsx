import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TenderDetail } from "@/components/tenders/TenderDetail";
import { TenderCard } from "@/components/tenders/TenderCard";
import { getTenderWithDocuments, getRelatedTenders } from "@/lib/tenders/detail";
import type { TenderListItem } from "@/types/tender";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps) {
  try {
    const tender = await getTenderWithDocuments(decodeURIComponent(params.id));
    if (tender) {
      return { title: tender.tender_number, description: tender.description.slice(0, 150) };
    }
  } catch {
    // ignore
  }
  return { title: "Tender" };
}

export default async function TenderDetailPage({ params }: PageProps) {
  const tenderId = decodeURIComponent(params.id);

  const tender = await getTenderWithDocuments(tenderId).catch((err) => {
    // A real query/schema error (vs. a genuine not-found) should be visible in
    // logs rather than silently masked as a 404 — that masking is what hid the
    // missing ai_compliance column behind a blank 404 page.
    console.error(`[tenders/[id]] getTenderWithDocuments(${tenderId}) failed:`, err);
    return null;
  });
  if (!tender) notFound();

  const related = (await getRelatedTenders(tenderId, tender.category).catch(
    () => []
  )) as TenderListItem[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link
        href="/tenders"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-sa-green"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tenders
      </Link>

      <TenderDetail tender={tender} />

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-xl font-bold text-gray-900">Related Tenders</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((t) => (
              <TenderCard key={t.tender_id} tender={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
