import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/utils";

export interface IngestionRun {
  id: string;
  run_type: string;
  status: string;
  tenders_fetched: number;
  tenders_updated: number;
  docs_queued: number;
  docs_downloaded: number;
  docs_failed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

function runStatusVariant(status: string) {
  if (status === "completed") return "green" as const;
  if (status === "running") return "gold" as const;
  if (status === "failed") return "red" as const;
  return "gray" as const;
}

export function PipelineStatus({ runs }: { runs: IngestionRun[] }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-gray-900">Recent Pipeline Runs</h2>
      </CardHeader>
      <CardBody className="p-0">
        {runs.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">No pipeline runs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Fetched</th>
                  <th className="px-5 py-3 font-medium">Docs ↓/✗</th>
                  <th className="px-5 py-3 font-medium">Started</th>
                  <th className="px-5 py-3 font-medium">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {runs.map((run) => (
                  <tr key={run.id} className="text-gray-700">
                    <td className="px-5 py-3 font-medium capitalize">{run.run_type}</td>
                    <td className="px-5 py-3">
                      <Badge variant={runStatusVariant(run.status)}>{run.status}</Badge>
                    </td>
                    <td className="px-5 py-3">{run.tenders_fetched}</td>
                    <td className="px-5 py-3">
                      {run.docs_downloaded}/{run.docs_failed}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {formatDateTime(run.started_at)}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {run.completed_at ? formatDateTime(run.completed_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
