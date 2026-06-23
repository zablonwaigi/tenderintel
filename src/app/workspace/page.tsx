import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, ArrowRight, Clock, Star, FileWarning, ListChecks } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ReadinessMeter } from "@/components/workspace/ReadinessMeter";
import { MatchCard } from "@/components/workspace/MatchCard";
import { getCurrentUser, getCompany, computeReadiness } from "@/lib/company/profile";
import { getMatchesForCompany, type ScoredTender } from "@/lib/matching/matches";

export const dynamic = "force-dynamic";

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: { requested?: string; saved?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signup?redirect=/workspace");

  const company = await getCompany(user.id);

  // Onboarding gate.
  if (!company || !company.onboarding_complete) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-sa-green/10 text-sa-green">
          <Sparkles className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Let&apos;s find tenders that fit you</h1>
        <p className="mt-2 text-gray-600">
          Tell us what your business does, where you operate, and what compliance you
          already have. We&apos;ll match you to live government tenders and show you exactly
          what you qualify for.
        </p>
        <Link href="/workspace/profile" className="mt-6 inline-block">
          <Button variant="primary" size="lg">
            Build my company profile <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  const readiness = computeReadiness(company);

  let buckets;
  let loadError = false;
  try {
    buckets = await getMatchesForCompany(company);
  } catch {
    loadError = true;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Matches</h1>
          <p className="mt-1 text-sm text-gray-600">
            {company.name} · matched against live tenders by industry, location,
            compliance, capacity and deadline.
          </p>
        </div>
        <Link
          href="/tenders"
          className="inline-flex items-center gap-1 text-sm font-medium text-sa-green hover:underline"
        >
          Browse all tenders <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {searchParams.saved && (
        <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">
          Profile saved — your matches are updated below.
        </p>
      )}
      {searchParams.requested && (
        <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">
          Request sent to GrowYourBiz. We&apos;ll be in touch. See it under{" "}
          <Link href="/workspace/requests" className="font-medium underline">My Requests</Link>.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ReadinessMeter readiness={readiness} />
        </div>
        <div className="lg:col-span-2">
          {loadError ? (
            <Card><CardBody><p className="text-sm text-gray-500">
              Matches are temporarily unavailable. Please refresh in a moment.
            </p></CardBody></Card>
          ) : (
            <SummaryStrip buckets={buckets!} />
          )}
        </div>
      </div>

      {!loadError && buckets && (
        <>
          <Lane
            icon={<Clock className="h-5 w-5" />}
            title="Closing soon"
            subtitle="Relevant tenders closing within 7 days — act now"
            items={buckets.closingSoon}
            emptyText="Nothing relevant closing in the next week."
          />
          <Lane
            icon={<Star className="h-5 w-5" />}
            title="Strong matches"
            subtitle="Best fit for your business right now"
            items={buckets.strong}
            emptyText="No strong matches yet. Add more detail to your profile to surface more."
          />
          <Lane
            icon={<FileWarning className="h-5 w-5" />}
            title="Missing-document opportunities"
            subtitle="Good fits you could win once a few documents are sorted"
            items={buckets.missingDocs}
            emptyText="No document-gap opportunities right now."
          />
          <Lane
            icon={<ListChecks className="h-5 w-5" />}
            title="Possible matches"
            subtitle="Worth a look — partial fit"
            items={buckets.possible}
            emptyText="No possible matches in the current pool."
          />
        </>
      )}
    </div>
  );
}

function SummaryStrip({ buckets }: { buckets: NonNullable<Awaited<ReturnType<typeof getMatchesForCompany>>> }) {
  const cells = [
    { label: "Strong matches", value: buckets.strong.length },
    { label: "Possible matches", value: buckets.possible.length },
    { label: "Closing this week", value: buckets.closingSoon.length },
    { label: "Need documents", value: buckets.missingDocs.length },
  ];
  return (
    <Card className="h-full">
      <CardBody>
        <h2 className="text-base font-semibold text-gray-900">Your tender picture</h2>
        <p className="mt-1 text-xs text-gray-500">
          From {buckets.totalScored.toLocaleString("en-ZA")} live tenders scored against your profile.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cells.map((c) => (
            <div key={c.label} className="rounded-lg bg-gray-50 p-3 text-center">
              <div className="text-2xl font-extrabold text-sa-green">{c.value}</div>
              <div className="mt-0.5 text-xs text-gray-600">{c.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Match scores are decision-support only. Always verify each tender&apos;s
          requirements against the official eTenders documents before bidding.
        </p>
      </CardBody>
    </Card>
  );
}

function Lane({
  icon, title, subtitle, items, emptyText,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  items: ScoredTender[];
  emptyText: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sa-green/10 text-sa-green">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        {items.length > 0 && (
          <span className="ml-auto text-sm font-semibold text-gray-400">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <Card><CardBody><p className="text-sm text-gray-500">{emptyText}</p></CardBody></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <MatchCard key={s.tender.tender_id} scored={s} />
          ))}
        </div>
      )}
    </section>
  );
}
