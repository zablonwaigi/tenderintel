import { createServiceClient } from "@/lib/supabase/server";
import { PortalIngester } from "./portalIngester";
import { OcdsIngester } from "./ocdsIngester";
import { DocumentDownloader } from "./documentDownloader";

export type PipelineMode = "full" | "incremental" | "documents" | "ocds";

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
 */
export async function executeRun(runId: string, mode: PipelineMode): Promise<void> {
  const stats = {
    tenders_fetched: 0,
    tenders_new: 0,
    tenders_updated: 0,
    docs_queued: 0,
    docs_downloaded: 0,
    docs_failed: 0,
  };

  try {
    if (mode === "full") {
      const portal = new PortalIngester();
      for (const statusId of [1, 2, 4]) {
        const r = await portal.ingestAll({ statusId });
        stats.tenders_fetched += r.fetched;
        stats.tenders_updated += r.updated;
        stats.docs_queued += r.documentsQueued;
      }
      const ocds = new OcdsIngester();
      await ocds.ingestFullHistory();
    } else if (mode === "incremental") {
      const portal = new PortalIngester();
      const r = await portal.ingestAll({ statusId: 1 });
      stats.tenders_fetched += r.fetched;
      stats.tenders_updated += r.updated;
      stats.docs_queued += r.documentsQueued;
    } else if (mode === "ocds") {
      const ocds = new OcdsIngester();
      const r = await ocds.ingestRecent(30);
      stats.tenders_fetched += r.fetched;
      stats.tenders_updated += r.upserted;
    } else if (mode === "documents") {
      const downloader = new DocumentDownloader();
      const r = await downloader.downloadPending(500);
      stats.docs_downloaded += r.downloaded;
      stats.docs_failed += r.failed;
    }

    await finishRun(runId, "completed", stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRun(runId, "failed", { ...stats, error_message: message });
    console.error(`Pipeline run ${runId} (${mode}) failed:`, err);
  }
}
