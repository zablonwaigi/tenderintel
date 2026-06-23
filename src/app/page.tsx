import Link from "next/link";
import { Target, ClipboardCheck, CalendarClock, Handshake, ArrowRight } from "lucide-react";
import { TenderSearch } from "@/components/tenders/TenderSearch";
import { TenderCard } from "@/components/tenders/TenderCard";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getPlatformStats, queryTenders } from "@/lib/tenders/query";
import type { TenderListItem } from "@/types/tender";
import type { PlatformStats } from "@/lib/tenders/query";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: <Target className="h-6 w-6" />,
    title: "Match",
    desc: "We score live tenders against your company profile — industry, province, compliance, capacity and deadline.",
  },
  {
    icon: <ClipboardCheck className="h-6 w-6" />,
    title: "Understand",
    desc: "Each tender is summarised in plain English: what they want, what you need, and whether you qualify.",
  },
  {
    icon: <CalendarClock className="h-6 w-6" />,
    title: "Track",
    desc: "See what's closing this week and never miss a briefing, site visit or submission deadline.",
  },
  {
    icon: <Handshake className="h-6 w-6" />,
    title: "Prepare",
    desc: "Spot missing documents before you waste time — and get GrowYourBiz to prepare your bid pack.",
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
            TenderIntel by GrowYourBiz · for South African SMMEs
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">
            Find tenders that fit your business
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">
            Stop scrolling through thousands of tenders. Match your company profile to live
            government tenders, understand the requirements in plain English, track deadlines,
            and prepare your bid pack with GrowYourBiz.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <Button variant="secondary" size="lg">
                Get my matches — free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/tenders">
              <Button variant="outline" size="lg" className="bg-white/10 text-white border-white/30 hover:bg-white/20">
                Browse all tenders
              </Button>
            </Link>
          </div>
          <div className="mx-auto mt-8 max-w-2xl">
            <TenderSearch placeholder="Or search now, e.g. 'security services', 'IT', 'construction'…" />
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
        <p className="mx-auto max-w-5xl px-4 pb-4 text-center text-xs text-gray-400">
          Updated {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}.
          Tender data is sourced from the National Treasury eTenders portal and OCDS API and may not be a
          complete record of all procurement. Always verify on the official eTenders portal.
        </p>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold text-gray-900">
          From tender search to tender action
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-gray-600">
          A practical workspace that turns thousands of tenders into the handful your business
          can actually pursue.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((f, i) => (
            <Card key={f.title} className="h-full">
              <CardBody>
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-sa-green/10 text-sa-green">
                  {f.icon}
                </span>
                <h3 className="mt-4 font-semibold text-gray-900">
                  {i + 1}. {f.title}
                </h3>
                <p className="mt-1.5 text-sm text-gray-600">{f.desc}</p>
              </CardBody>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/signup">
            <Button variant="primary" size="lg">
              Build my company profile <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
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
