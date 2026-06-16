import Link from "next/link";
import { Rocket, Scale, ClipboardCheck, ArrowRight } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export const metadata = { title: "Learning Hub" };

const TRACKS = [
  {
    icon: <Rocket className="h-6 w-6" />,
    title: "Getting Started",
    desc: "New to government tenders? Start here to understand the basics and get registered.",
    links: [
      { slug: "how-tenders-work", label: "How South African Tenders Work" },
      { slug: "csd-registration", label: "Register on the CSD" },
      { slug: "tax-clearance", label: "Get Your SARS Tax Compliance PIN" },
      { slug: "bbbee-guide", label: "Understand Your B-BBEE Level" },
    ],
  },
  {
    icon: <Scale className="h-6 w-6" />,
    title: "Understanding Evaluation",
    desc: "Learn exactly how bids are scored so you can target your effort where it counts.",
    links: [
      { slug: "evaluation-criteria", label: "Tender Evaluation Criteria" },
      { slug: "mbd-6-2", label: "Claiming B-BBEE Preference Points" },
      { slug: "bbbee-guide", label: "B-BBEE Certificate Guide" },
    ],
  },
  {
    icon: <ClipboardCheck className="h-6 w-6" />,
    title: "Preparing Your Bid",
    desc: "Master the SBD/MBD forms and compliance documents that make or break a submission.",
    links: [
      { slug: "sbd-1", label: "SBD 1 — Invitation to Bid" },
      { slug: "sbd-4", label: "SBD 4 — Declaration of Interest" },
      { slug: "sbd-6-1", label: "SBD 6.1 — Independent Bid Determination" },
      { slug: "sbd-8", label: "SBD 8 — Past SCM Practices" },
      { slug: "sbd-9", label: "SBD 9 — Certificate (Sworn)" },
      { slug: "sbd-7-2", label: "SBD 7.2 — Contract Form" },
    ],
  },
];

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Learning Hub</h1>
        <p className="mx-auto mt-2 max-w-2xl text-gray-600">
          A guided path from absolute beginner to bid-ready. Follow each track in
          order, or jump to the topic you need.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {TRACKS.map((track) => (
          <Card key={track.title} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sa-green/10 text-sa-green">
                  {track.icon}
                </span>
                <h2 className="text-lg font-bold text-gray-900">{track.title}</h2>
              </div>
            </CardHeader>
            <CardBody className="flex flex-1 flex-col">
              <p className="text-sm text-gray-600">{track.desc}</p>
              <ul className="mt-4 space-y-2">
                {track.links.map((l) => (
                  <li key={l.slug}>
                    <Link
                      href={`/wiki/${l.slug}`}
                      className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-sa-green/40 hover:text-sa-green"
                    >
                      {l.label}
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
