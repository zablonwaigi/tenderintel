import { createServiceClient } from "@/lib/supabase/server";
import { PortalIngester } from "./portalIngester";
import { OcdsIngester } from "./ocdsIngester";
import { DocumentDownloader } from "./documentDownloader";

export type PipelineMode =
  | "full"
  | "incremental"
  | "awarded"
  | "closed"
  | "documents"
  | "ocds"
  | "ocds-full";

export const PIPELINE_MODES: PipelineMode[] = [
  "full",
  "incremental",
  "awarded",
  "closed",
  "documents",
  "ocds",
  "ocds-full",
];

// Effectively "no cap" for full runs.
const UNLIMITED_DOCS = 1_000_000;

/**
 * Create an ingestion_log row and return its id.
 */
export async function startRun(mode: PipelineMode): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ingestion_log")
    .insert({ run_type: mode, status: "running" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create ingestion log: ${error?.message}`);
  return data.id as string;
}

async function finishRun(
  runId: string,
  status: "completed" | "failed",
  stats: Partial<{
    tenders_fetched: number;
    tenders_new: number;
    tenders_updated: number;
    docs_queued: number;
    docs_downloaded: number;
    docs_failed: number;
    ocds_errors: number;
    error_message: string;
  }>
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("ingestion_log")
    .update({ ...stats, status, completed_at: new Date().toISOString() })
    .eq("id", runId);
}

/**
 * Execute a pipeline run. Intended to be invoked without awaiting from the
 * API route (fire-and-forget) so the HTTP request returns immediately.
 *
 * Modes:
 *  - full        portal statuses 1,2,4 + full OCDS history + all pending docs
 *  - incremental active tenders + recent OCDS (30d) + 500 docs (daily)
 *  - awarded     portal statusId=2 only (weekly)
 *  - closed      portal statusId=4 only (weekly)
 *  - documents   pending document downloads only (1000 cap)
 *  - ocds        recent OCDS (30 days) only
 *  - ocds-full   full OCDS history from 2010
 */
export async function executeRun(runId: string, mode: PipelineMode): Promise<void> {
  const stats = {
    tenders_fetched: 0,
    tenders_new: 0,
    tenders_updated: 0,
    docs_queued: 0,
    docs_downloaded: 0,
    docs_failed: 0,
    ocds_errors: 0,
  };

  const ingestPortal = async (statusIds: number[]) => {
    const portal = new PortalIngester();
    for (const statusId of statusIds) {
      const r = await portal.ingestAll({ statusId });
      stats.tenders_fetched += r.fetched;
      stats.tenders_updated += r.updated;
      stats.docs_queued += r.documentsQueued;
    }
  };

  const downloadDocs = async (limit: number) => {
    const downloader = new DocumentDownloader();
    const r = await downloader.downloadPending(limit);
    stats.docs_downloaded += r.downloaded;
    stats.docs_failed += r.failed;
  };

  const ingestOcdsRecent = async (days: number) => {
    const ocds = new OcdsIngester();
    const r = await ocds.ingestRecent(days);
    stats.tenders_fetched += r.fetched;
    stats.tenders_updated += r.upserted;
    stats.ocds_errors += r.errors;
  };

  const ingestOcdsFull = async () => {
    const ocds = new OcdsIngester();
    const r = await ocds.ingestFullHistory();
    stats.tenders_fetched += r.fetched;
    stats.tenders_updated += r.upserted;
    stats.ocds_errors += r.errors;
  };

  try {
    switch (mode) {
      case "full":
        await ingestPortal([1, 2, 4]);
        await ingestOcdsFull();
        await downloadDocs(UNLIMITED_DOCS);
        break;
      case "incremental":
        await ingestPortal([1]);
        await ingestOcdsRecent(30);
        await downloadDocs(500);
        break;
      case "awarded":
        await ingestPortal([2]);
        break;
      case "closed":
        await ingestPortal([4]);
        break;
      case "documents":
        await downloadDocs(1000);
        break;
      case "ocds":
        await ingestOcdsRecent(30);
        break;
      case "ocds-full":
        await ingestOcdsFull();
        break;
    }

    await finishRun(runId, "completed", stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRun(runId, "failed", { ...stats, error_message: message });
    console.error(`Pipeline run ${runId} (${mode}) failed:`, err);
  }
}
