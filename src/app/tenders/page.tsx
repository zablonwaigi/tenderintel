import Link from "next/link";
import { TenderSearch } from "@/components/tenders/TenderSearch";
import { TenderFilters } from "@/components/tenders/TenderFilters";
import { TenderCard } from "@/components/tenders/TenderCard";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardBody } from "@/components/ui/Card";
import { queryTenders, getCategories } from "@/lib/tenders/query";
import type { TenderSearchResult } from "@/types/tender";

export const dynamic = "force-dynamic";

export const metadata = { title: "Browse Tenders" };

interface PageProps {
  searchParams: {
    q?: string;
    status?: string;
    category?: string;
    province?: string;
    page?: string;
  };
}

export default async function TendersPage({ searchParams }: PageProps) {
  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;

  let result: TenderSearchResult = { data: [], count: 0, page: 1, totalPages: 1 };
  let categories: string[] = [];
  let error: string | null = null;

  try {
    [result, categories] = await Promise.all([
      queryTenders({
        q: searchParams.q,
        status: searchParams.status,
        category: searchParams.category,
        province: searchParams.province,
        page,
        limit: 20,
      }),
      getCategories(),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load tenders";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Browse Tenders</h1>
      <p className="mt-1 text-sm text-gray-600">
        {result.count.toLocaleString("en-ZA")} tenders found
      </p>

      <div className="mt-6">
        <TenderSearch />
      </div>

      <div className="mt-6 flex flex-col gap-6 md:flex-row">
        <Sidebar>
          <TenderFilters categories={categories} />
        </Sidebar>

        <div className="flex-1">
          {error ? (
            <Card>
              <CardBody>
                <p className="text-sm text-sa-red">Error: {error}</p>
              </CardBody>
            </Card>
          ) : result.data.length === 0 ? (
            <Card>
              <CardBody>
                <p className="text-sm text-gray-500">
                  No tenders match your search. Try removing some filters.
                </p>
              </CardBody>
            </Card>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result.data.map((t) => (
                  <TenderCard key={t.tender_id} tender={t} />
                ))}
              </div>
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                searchParams={searchParams}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: PageProps["searchParams"];
}) {
  if (totalPages <= 1) return null;

  const build = (p: number) => {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (searchParams.status) params.set("status", searchParams.status);
    if (searchParams.category) params.set("category", searchParams.category);
    if (searchParams.province) params.set("province", searchParams.province);
    params.set("page", String(p));
    return `/tenders?${params.toString()}`;
  };

  return (
    <div className="mt-8 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link
          href={build(page - 1)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Previous
        </Link>
      )}
      <span className="px-4 py-2 text-sm text-gray-600">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={build(page + 1)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Next
        </Link>
      )}
    </div>
  );
}
