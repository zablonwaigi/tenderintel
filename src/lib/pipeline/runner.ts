import { createServiceClient } from "@/lib/supabase/server";
import { OcdsIngester } from "./ocdsIngester";
import { DocumentDownloader } from "./documentDownloader";

// NOTE (Phase 0 / task 0.9 — demote portal scraping, decision RB1):
// The legacy PortalIngester POSTed to /Home/PaginatedTenderOpportunities, which
// now returns HTTP 405 (the endpoint only accepts GET with DataTables params).
// It is no longer invoked here. The OCDS API is the ingestion spine, and the
// full portal catalogue is handled by the GET-based portal-client used by the
// `sync-tenders?mode=portal` cron. These dashboard/pipeline modes now run the
// OCDS + document paths only, so nothing loops on the dead 405 endpoint.

export type PipelineMode =
    | "full"        // all portal statuses + full OCDS history back to 2010 + all documents
  | "incremental" // active (statusId=1) + recent OCDS (30 days) + pending documents
  | "awarded"     // awarded (statusId=2) only — useful for scheduled weekly sync
  | "closed"      // closed (statusId=4) only — useful for scheduled weekly sync
  | "documents"   // pending document downloads only
  | "ocds"        // recent OCDS data only (30 days)
  | "ocds-full";  // full OCDS history back to 2010

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
                // Portal scraping demoted (RB1/0.9): OCDS full history + downloads only.
          console.log("[runner] Starting full OCDS history ingest...");
                const ocds = new OcdsIngester();
                const ocdsResult = await ocds.ingestFullHistory((window, res) => {
                          console.log(`[runner] OCDS window ${window}: fetched=${res.fetched} upserted=${res.upserted}`);
                });
                stats.tenders_fetched += ocdsResult.fetched;
                stats.tenders_updated += ocdsResult.upserted;

          console.log("[runner] Starting document downloads (full)...");
                const downloader = new DocumentDownloader();
                const dl = await downloader.downloadPending(10000);
                stats.docs_downloaded += dl.downloaded;
                stats.docs_failed += dl.failed;
                console.log(`[runner] Documents: downloaded=${dl.downloaded} failed=${dl.failed}`);

        } else if (mode === "incremental") {
                // Recent OCDS + pending documents (portal active sync demoted, RB1/0.9).
          const ocds = new OcdsIngester();
                const ocdsResult = await ocds.ingestRecent(30);
                stats.tenders_fetched += ocdsResult.fetched;
                stats.tenders_updated += ocdsResult.upserted;

          const downloader = new DocumentDownloader();
                const dl = await downloader.downloadPending(500);
                stats.docs_downloaded += dl.downloaded;
                stats.docs_failed += dl.failed;

        } else if (mode === "awarded" || mode === "closed") {
                // Awarded/closed tenders now come from OCDS release tags via the
                // `sync-tenders` cron, not portal scraping (RB1/0.9). No-op here so a
                // legacy dashboard/pipeline trigger doesn't hit the dead 405 endpoint.
          console.warn(
                  `[runner] mode='${mode}' is deprecated; awarded/closed are ingested ` +
                  `from OCDS by the sync-tenders cron. Skipping legacy portal scrape.`,
                );

        } else if (mode === "ocds") {
                // ── Recent OCDS only (last 30 days) ──────────────────────────────────
          const ocds = new OcdsIngester();
                const r = await ocds.ingestRecent(30);
                stats.tenders_fetched += r.fetched;
                stats.tenders_updated += r.upserted;

        } else if (mode === "ocds-full") {
                // ── Full OCDS history back to 2010 ────────────────────────────────────
          const ocds = new OcdsIngester();
                const r = await ocds.ingestFullHistory((window, res) => {
                          console.log(`[runner] OCDS window ${window}: fetched=${res.fetched} upserted=${res.upserted}`);
                });
                stats.tenders_fetched += r.fetched;
                stats.tenders_updated += r.upserted;

        } else if (mode === "documents") {
                // ── Pending document downloads only ──────────────────────────────────
          const downloader = new DocumentDownloader();
                const r = await downloader.downloadPending(1000);
                stats.docs_downloaded += r.downloaded;
                stats.docs_failed += r.failed;
        }

      await finishRun(runId, "completed", stats);
        console.log(`[runner] Run ${runId} (${mode}) completed:`, stats);
  } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await finishRun(runId, "failed", { ...stats, error_message: message });
        console.error(`[runner] Pipeline run ${runId} (${mode}) failed:`, err);
  }
}
