import Link from "next/link";
import { FileSearch, GraduationCap, Download, Users, ArrowRight } from "lucide-react";
import { TenderSearch } from "@/components/tenders/TenderSearch";
import { TenderCard } from "@/components/tenders/TenderCard";
import { Card, CardBody } from "@/components/ui/Card";
import { getPlatformStats, queryTenders } from "@/lib/tenders/query";
import type { TenderListItem } from "@/types/tender";
import type { PlatformStats } from "@/lib/tenders/query";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    href: "/tenders",
    icon: <FileSearch className="h-6 w-6" />,
    title: "Browse Tenders",
    desc: "Search and filter 150,000+ government tenders by status, category and province.",
  },
  {
    href: "/learn",
    icon: <GraduationCap className="h-6 w-6" />,
    title: "Learn the Process",
    desc: "Step-by-step guides on how tenders work, evaluation criteria and preparing your bid.",
  },
  {
    href: "/tenders",
    icon: <Download className="h-6 w-6" />,
    title: "Download Documents",
    desc: "Access tender packs, specifications and SBD forms directly from each tender.",
  },
  {
    href: "/wiki",
    icon: <Users className="h-6 w-6" />,
    title: "SME Resources",
    desc: "Plain-English wiki of SBD/MBD forms, B-BBEE, CSD and tax compliance.",
  },
];

export default async function HomePage() {
  let stats: PlatformStats = {
    totalTenders: 0,
    activeTenders: 0,
    documentsDownloaded: 0,
    documentsPending: 0,
    documentsParsed: 0,
  };
  let latest: TenderListItem[] = [];

  try {
    stats = await getPlatformStats();
    const result = await queryTenders({ status: "active", limit: 6 });
    latest = result.data;
  } catch {
    // DB not yet reachable — render the page shell with zeros.
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sa-green to-sa-green/80 text-white">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <span className="inline-block rounded-full bg-sa-gold px-3 py-1 text-xs font-semibold text-black">
            South African Government Tender Intelligence
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">
            Find &amp; Win Government Tenders in South Africa
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">
            Search every tender, understand the forms, and prepare winning bids —
            all in one place built for South African SMEs.
          </p>
          <div className="mx-auto mt-8 max-w-2xl">
            <TenderSearch placeholder="Search for tenders, e.g. 'security services', 'IT', 'construction'…" />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 py-8 sm:grid-cols-4">
          <Stat value={stats.totalTenders} label="Tenders tracked" />
          <Stat value={stats.activeTenders} label="Active now" />
          <Stat value={stats.documentsDownloaded} label="Documents archived" />
          <Stat value={10} label="Provinces + National" />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold text-gray-900">
          Everything you need to bid with confidence
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Link key={f.title} href={f.href} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardBody>
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-sa-green/10 text-sa-green">
                    {f.icon}
                  </span>
                  <h3 className="mt-4 font-semibold text-gray-900 group-hover:text-sa-green">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-gray-600">{f.desc}</p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest active tenders */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Latest Active Tenders</h2>
          <Link
            href="/tenders?status=active"
            className="inline-flex items-center gap-1 text-sm font-medium text-sa-green hover:underline"
          >
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {latest.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-gray-500">
                No active tenders loaded yet. Run the ingestion pipeline from the
                <Link href="/dashboard" className="ml-1 text-sa-green hover:underline">
                  dashboard
                </Link>
                .
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((t) => (
              <TenderCard key={t.tender_id} tender={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-extrabold text-sa-green">
        {value.toLocaleString("en-ZA")}
      </div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </div>
  );
}
