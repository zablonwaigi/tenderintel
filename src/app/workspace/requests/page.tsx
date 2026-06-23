import Link from "next/link";
import { redirect } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/company/profile";
import { listServiceRequests, KIND_LABELS } from "@/lib/company/serviceRequests";
import { formatDate } from "@/lib/utils";
import type { ServiceRequestKind } from "@/types/company";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Requests" };

const STATUS_VARIANT: Record<string, "gold" | "blue" | "green" | "gray"> = {
  new: "gold",
  contacted: "blue",
  in_progress: "blue",
  done: "green",
  closed: "gray",
};

export default async function RequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signup?redirect=/workspace/requests");
  const requests = await listServiceRequests(user.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">My GrowYourBiz requests</h1>
      <p className="mt-1 text-sm text-gray-600">
        Help you&apos;ve asked for — compliance documents, capability statements and bid packs.
      </p>

      {requests.length === 0 ? (
        <Card className="mt-6">
          <CardBody className="text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-sa-green/10 text-sa-green">
              <LifeBuoy className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm text-gray-600">
              No requests yet. When you spot a tender you want to pursue, ask GrowYourBiz to
              help with the documents or the full bid pack from your matches.
            </p>
            <Link href="/workspace" className="mt-4 inline-block">
              <Button variant="primary">Go to my matches</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardBody className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-gray-900">
                    {KIND_LABELS[r.kind as ServiceRequestKind] ?? r.kind}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500">
                    {r.tender_id ? `Tender ${r.tender_id} · ` : ""}Requested {formatDate(r.created_at)}
                  </div>
                  {r.message && <p className="mt-1 text-sm text-gray-600">{r.message}</p>}
                </div>
                <Badge variant={STATUS_VARIANT[r.status] ?? "gray"}>{r.status.replace("_", " ")}</Badge>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
