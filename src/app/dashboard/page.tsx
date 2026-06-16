import { revalidatePath } from "next/cache";
import { FileText, Download, Sparkles, Database, Clock } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PipelineStatus, type IngestionRun } from "@/components/pipeline/PipelineStatus";
import { getPlatformStats } from "@/lib/tenders/query";
import { createServiceClient } from "@/lib/supabase/server";
import { startRun, executeRun } from "@/lib/pipeline/runner";
import { DocumentParser } from "@/lib/pipeline/documentParser";
import { AiAnalyser } from "@/lib/pipeline/aiAnalyser";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin Dashboard" };

async function runIncremental() {
  "use server";
  const runId = await startRun("incremental");
  void executeRun(runId, "incremental");
  revalidatePath("/dashboard");
}

async function downloadDocuments() {
  "use server";
  const runId = await startRun("documents");
  void executeRun(runId, "documents");
  revalidatePath("/dashboard");
}

async function parseDocuments() {
  "use server";
  void new DocumentParser().parsePending(100);
  revalidatePath("/dashboard");
}

async function analyseTenders() {
  "use server";
  void new AiAnalyser().analyseAllPending(50);
  revalidatePath("/dashboard");
}

export default async function DashboardPage() {
  const supabase = createServiceClient();

  let stats = {
    totalTenders: 0,
    activeTenders: 0,
    documentsDownloaded: 0,
    documentsPending: 0,
    documentsParsed: 0,
  };
  let runs: IngestionRun[] = [];

  try {
    stats = await getPlatformStats();
    const { data } = await supabase
      .from("ingestion_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);
    runs = (data ?? []) as IngestionRun[];
  } catch {
    // DB unreachable — show empty dashboard.
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-gray-600">
        Pipeline control and ingestion status. Internal use.
      </p>

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<Database />} label="Total Tenders" value={stats.totalTenders} />
        <StatCard icon={<Clock />} label="Active Tenders" value={stats.activeTenders} />
        <StatCard icon={<Download />} label="Docs Downloaded" value={stats.documentsDownloaded} />
        <StatCard icon={<FileText />} label="Docs Pending" value={stats.documentsPending} />
        <StatCard icon={<Sparkles />} label="Docs Parsed" value={stats.documentsParsed} />
      </div>

      {/* Actions */}
      <Card className="mt-6">
        <CardBody>
          <h2 className="mb-4 text-base font-semibold text-gray-900">Pipeline Actions</h2>
          <div className="flex flex-wrap gap-3">
            <form action={runIncremental}>
              <Button type="submit" variant="primary">
                <Clock className="h-4 w-4" /> Run Incremental Sync
              </Button>
            </form>
            <form action={downloadDocuments}>
              <Button type="submit" variant="secondary">
                <Download className="h-4 w-4" /> Download Pending Documents
              </Button>
            </form>
            <form action={parseDocuments}>
              <Button type="submit" variant="outline">
                <FileText className="h-4 w-4" /> Parse Downloaded Documents
              </Button>
            </form>
            <form action={analyseTenders}>
              <Button type="submit" variant="outline">
                <Sparkles className="h-4 w-4" /> Analyse Pending Tenders
              </Button>
            </form>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Actions run in the background. Refresh the page after a moment to see
            progress in the runs table below.
          </p>
        </CardBody>
      </Card>

      <div className="mt-6">
        <PipelineStatus runs={runs} />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sa-green/10 text-sa-green [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
        <div>
          <div className="text-xl font-bold text-gray-900">
            {value.toLocaleString("en-ZA")}
          </div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      </CardBody>
    </Card>
  );
}
