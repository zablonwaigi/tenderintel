import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RequestHelpButton } from "./RequestHelpButton";
import type { Readiness } from "@/lib/company/profile";
import type { ServiceRequestKind } from "@/types/company";

export function ReadinessMeter({ readiness }: { readiness: Readiness }) {
  const { percent, statusLabel, items } = readiness;
  const barColor = percent === 100 ? "bg-sa-green" : percent >= 60 ? "bg-sa-gold" : "bg-sa-red";
  const badgeVariant = percent === 100 ? "green" : percent >= 60 ? "gold" : "red";

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Tender readiness</h2>
          <Badge variant={badgeVariant}>{statusLabel}</Badge>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${percent}%` }} />
          </div>
          <span className="text-sm font-semibold text-gray-700">{percent}%</span>
        </div>

        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.code} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-gray-700">
                {item.held ? (
                  <CheckCircle2 className="h-4 w-4 text-sa-green" />
                ) : (
                  <Circle className="h-4 w-4 text-gray-300" />
                )}
                {item.label}
              </span>
              {!item.held && (
                <RequestHelpButton
                  kind={item.serviceKind as ServiceRequestKind}
                  label="Get help"
                  redirect="/workspace?requested=1"
                  variant="outline"
                  size="sm"
                />
              )}
            </li>
          ))}
        </ul>

        {percent < 100 && (
          <p className="mt-4 text-xs text-gray-500">
            GrowYourBiz can sort out any missing item for you — tap “Get help” and our team
            will reach out.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
