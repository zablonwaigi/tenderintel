import Link from "next/link";
import {
  Building2,
  MapPin,
  CalendarClock,
  CalendarCheck,
  Tag,
  Download,
  FileText,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, statusVariant } from "@/components/ui/Badge";
import {
  formatDate,
  formatCurrency,
  formatFileSize,
  daysUntil,
} from "@/lib/utils";
import type { TenderWithDocuments } from "@/types/tender";

// Map likely compliance docs to wiki slugs for cross-linking.
const COMPLIANCE_LINKS: { match: RegExp; slug: string; label: string }[] = [
  { match: /b-?bbee|bee/i, slug: "bbbee-guide", label: "B-BBEE Guide" },
  { match: /csd|central supplier/i, slug: "csd-registration", label: "CSD Registration" },
  { match: /tax|sars/i, slug: "tax-clearance", label: "Tax Clearance / SARS PIN" },
  { match: /sbd ?1|invitation/i, slug: "sbd-1", label: "SBD 1" },
  { match: /sbd ?4|interest/i, slug: "sbd-4", label: "SBD 4" },
  { match: /preference|points/i, slug: "mbd-6-2", label: "MBD 6.2" },
];

function relatedWiki(compliance: string[] | null): { slug: string; label: string }[] {
  const out = new Map<string, string>();
  for (const item of compliance ?? []) {
    for (const link of COMPLIANCE_LINKS) {
      if (link.match.test(item)) out.set(link.slug, link.label);
    }
  }
  // Always surface the universal starting points.
  out.set("how-tenders-work", "How Tenders Work");
  out.set("evaluation-criteria", "Evaluation Criteria");
  return Array.from(out, ([slug, label]) => ({ slug, label }));
}

export function TenderDetail({ tender }: { tender: TenderWithDocuments }) {
  const days = daysUntil(tender.closing_date);
  const wikiLinks = relatedWiki(tender.ai_compliance);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardBody>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(tender.status)}>{tender.status}</Badge>
              {tender.category && <Badge variant="outline">{tender.category}</Badge>}
              <span className="font-mono text-xs text-gray-500">{tender.tender_number}</span>
            </div>

            <h1 className="text-xl font-bold leading-snug text-gray-900">
              {tender.description}
            </h1>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Info icon={<Building2 />} label="Department" value={tender.department} />
              <Info icon={<MapPin />} label="Province" value={tender.province} />
              <Info icon={<CalendarCheck />} label="Advertised" value={formatDate(tender.date_advertised)} />
              <Info
                icon={<CalendarClock />}
                label="Closing"
                value={
                  <>
                    {formatDate(tender.closing_date)}
                    {days !== null && days >= 0 && (
                      <span className="ml-1 text-sa-red">({days}d left)</span>
                    )}
                  </>
                }
              />
              {tender.advertised_amount != null && (
                <Info icon={<Tag />} label="Advertised amount" value={formatCurrency(tender.advertised_amount)} />
              )}
              {tender.status === "awarded" && (
                <>
                  <Info icon={<Tag />} label="Awarded amount" value={formatCurrency(tender.awarded_amount)} />
                  <Info icon={<Building2 />} label="Awarded to" value={tender.awarded_to} />
                </>
              )}
            </dl>
          </CardBody>
        </Card>

        {tender.ai_summary && (
          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <Sparkles className="h-4 w-4 text-sa-gold" /> AI Summary
              </h2>
            </CardHeader>
            <CardBody>
              <p className="text-sm leading-relaxed text-gray-700">{tender.ai_summary}</p>

              {tender.ai_keywords && tender.ai_keywords.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {tender.ai_keywords.map((k) => (
                    <Badge key={k} variant="default">{k}</Badge>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {tender.ai_requirements && tender.ai_requirements.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <CheckCircle2 className="h-4 w-4 text-sa-green" /> Key Requirements
              </h2>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2">
                {tender.ai_requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sa-green" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <FileText className="h-4 w-4 text-gray-500" /> Documents ({tender.documents.length})
            </h2>
          </CardHeader>
          <CardBody>
            {tender.documents.length === 0 ? (
              <p className="text-sm text-gray-500">No documents recorded for this tender.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {tender.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold uppercase text-gray-600">
                        {(doc.file_type ?? "?").slice(0, 4)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">{doc.file_name}</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(doc.file_size)} · {doc.download_status}
                        </p>
                      </div>
                    </div>
                    {doc.download_status === "downloaded" ? (
                      <a
                        href={`/api/documents/${doc.id}/download`}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Download className="h-4 w-4" /> Download
                      </a>
                    ) : doc.source_url ? (
                      <a
                        href={doc.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Download className="h-4 w-4" /> Source
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">unavailable</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6">
        {tender.ai_compliance && tender.ai_compliance.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <ShieldCheck className="h-4 w-4 text-sa-green" /> Likely Compliance Docs
              </h2>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2 text-sm text-gray-700">
                {tender.ai_compliance.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-gray-900">What forms will I need?</h2>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {wikiLinks.map((link) => (
                <li key={link.slug}>
                  <Link
                    href={`/wiki/${link.slug}`}
                    className="text-sm font-medium text-sa-green hover:underline"
                  >
                    {link.label} →
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-gray-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div>
        <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
        <dd className="text-sm font-medium text-gray-800">{value || "—"}</dd>
      </div>
    </div>
  );
}
