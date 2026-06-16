import Link from "next/link";
import { CalendarClock, Building2, MapPin, FileText } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge, statusVariant } from "@/components/ui/Badge";
import { formatDate, daysUntil, truncate, formatCurrency } from "@/lib/utils";
import type { TenderListItem } from "@/types/tender";

export function TenderCard({ tender }: { tender: TenderListItem }) {
  const days = daysUntil(tender.closing_date);
  const closingSoon = days !== null && days >= 0 && days <= 7;

  return (
    <Link href={`/tenders/${encodeURIComponent(tender.tender_id)}`} className="group block">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardBody className="flex h-full flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-gray-500">{tender.tender_number}</span>
            <Badge variant={statusVariant(tender.status)}>{tender.status}</Badge>
          </div>

          <h3 className="text-sm font-semibold leading-snug text-gray-900 group-hover:text-sa-green">
            {truncate(tender.description, 140)}
          </h3>

          <div className="mt-3 space-y-1.5 text-xs text-gray-600">
            {tender.department && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                <span className="truncate">{tender.department}</span>
              </div>
            )}
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
                <span className="font-semibold text-sa-red">
                  · {days} day{days === 1 ? "" : "s"} left
                </span>
              )}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between pt-4">
            <div className="flex flex-wrap gap-1.5">
              {tender.category && <Badge variant="outline">{tender.category}</Badge>}
            </div>
            {typeof tender.document_count === "number" && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <FileText className="h-3.5 w-3.5" />
                {tender.document_count}
              </span>
            )}
          </div>

          {tender.status === "awarded" && tender.awarded_amount != null && (
            <div className="mt-2 text-xs text-gray-600">
              Awarded: <span className="font-semibold">{formatCurrency(tender.awarded_amount)}</span>
              {tender.awarded_to ? ` · ${truncate(tender.awarded_to, 40)}` : ""}
            </div>
          )}
        </CardBody>
      </Card>
    </Link>
  );
}
