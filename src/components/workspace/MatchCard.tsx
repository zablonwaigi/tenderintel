import Link from "next/link";
import { MapPin, CalendarClock, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RequestHelpButton } from "./RequestHelpButton";
import { formatDate, truncate } from "@/lib/utils";
import { ACTION_LABELS } from "@/lib/matching/score";
import type { ScoredTender } from "@/lib/matching/matches";

const BAND_STYLES: Record<string, { badge: "green" | "gold" | "gray"; ring: string }> = {
  strong: { badge: "green", ring: "ring-sa-green/30" },
  possible: { badge: "gold", ring: "ring-sa-gold/40" },
  weak: { badge: "gray", ring: "ring-gray-200" },
};

export function MatchCard({ scored }: { scored: ScoredTender }) {
  const { tender, match } = scored;
  const style = BAND_STYLES[match.band] ?? BAND_STYLES.weak;
  const days = match.daysToClose;
  const closingSoon = days != null && days >= 0 && days <= 7;

  return (
    <Card className={`h-full ring-1 ${style.ring}`}>
      <CardBody className="flex h-full flex-col">
        {/* Header: score + action */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-gray-500">{tender.tender_number}</span>
          <Badge variant={style.badge}>{match.score}% match</Badge>
        </div>

        <Link
          href={`/tenders/${encodeURIComponent(tender.tender_id)}`}
          className="group"
        >
          <h3 className="text-sm font-semibold leading-snug text-gray-900 group-hover:text-sa-green">
            {truncate(tender.ai_summary || tender.description, 150)}
          </h3>
        </Link>

        <div className="mt-3 space-y-1.5 text-xs text-gray-600">
          {tender.province && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gray-400" />
              <span>{tender.province}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-gray-400" />
            <span>Closes {formatDate(tender.closing_date)}</span>
            {closingSoon && (
              <span className="font-semibold text-sa-red">· {days} day{days === 1 ? "" : "s"} left</span>
            )}
          </div>
        </div>

        {/* Why it matched */}
        {match.reasons.length > 0 && (
          <ul className="mt-3 space-y-1">
            {match.reasons.slice(0, 2).map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sa-green" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
        {match.risks.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {match.risks.slice(0, 2).map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sa-gold" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Footer: recommended action + CTAs */}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          <Badge variant="outline">Suggested: {ACTION_LABELS[match.recommendedAction]}</Badge>
          {match.missingCompliance.length > 0 ? (
            <RequestHelpButton
              kind="bid_pack"
              label="Get missing documents"
              tenderId={tender.tender_id}
              message={`Tender ${tender.tender_number}: needs ${match.missingCompliance.join(", ")}`}
              redirect="/workspace?requested=1"
              variant="secondary"
            />
          ) : (
            <RequestHelpButton
              kind="bid_pack"
              label="Ask GrowYourBiz to prepare"
              tenderId={tender.tender_id}
              message={`Tender ${tender.tender_number}: bid pack request`}
              redirect="/workspace?requested=1"
              variant="outline"
            />
          )}
          <Link
            href={`/tenders/${encodeURIComponent(tender.tender_id)}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-sa-green hover:underline"
          >
            View tender <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
