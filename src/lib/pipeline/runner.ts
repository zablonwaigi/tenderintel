import { createServiceClient } from "@/lib/supabase/server";
import { PortalIngester } from "./portalIngester";
import { OcdsIngester } from "./ocdsIngester";
import { DocumentDownloader } from "./documentDownloader";

// All portal status IDs: 1=active, 2=awarded, 4=closed
// statusId 3 (cancelled) is intentionally skipped — portal has a duplicate-key bug;
// cancelled tenders are covered by the OCDS API path instead.
const ALL_PORTAL_STATUSES = [1, 2, 4];

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
                // ── 1. Ingest ALL portal statuses: active, awarded, closed ──────────
          const portal = new PortalIngester();
                for (const statusId of ALL_PORTAL_STATUSES) {
                          console.log(`[runner] Starting portal ingest for statusId=${statusId}`);
                          const r = await portal.ingestAll({ statusId });
                          stats.tenders_fetched += r.fetched;
                          stats.tenders_updated += r.updated;
                          stats.docs_queued += r.documentsQueued;
                          console.log(`[runner] statusId=${statusId} done: fetched=${r.fetched} updated=${r.updated} docs=${r.documentsQueued}`);
                }

          // ── 2. Full OCDS history (2010 → today) for cancelled + enrichment ──
          console.log("[runner] Starting full OCDS history ingest...");
                const ocds = new OcdsIngester();
                const ocdsResult = await ocds.ingestFullHistory((window, res) => {
                          console.log(`[runner] OCDS window ${window}: fetched=${res.fetched} upserted=${res.upserted}`);
                });
                stats.tenders_fetched += ocdsResult.fetched;
                stats.tenders_updated += ocdsResult.upserted;

          // ── 3. Download ALL pending documents (no cap) ───────────────────────
          console.log("[runner] Starting document downloads (full)...");
                const downloader = new DocumentDownloader();
                const dl = await downloader.downloadPending(10000);
                stats.docs_downloaded += dl.downloaded;
                stats.docs_failed += dl.failed;
                console.log(`[runner] Documents: downloaded=${dl.downloaded} failed=${dl.failed}`);

        } else if (mode === "incremental") {
                // ── Daily: active tenders + recent OCDS + pending documents ─────────
          const portal = new PortalIngester();
                const r = await portal.ingestAll({ statusId: 1 }); // active only
          stats.tenders_fetched += r.fetched;
                stats.tenders_updated += r.updated;
                stats.docs_queued += r.documentsQueued;

          const ocds = new OcdsIngester();
                const ocdsResult = await ocds.ingestRecent(30);
                stats.tenders_fetched += ocdsResult.fetched;
                stats.tenders_updated += ocdsResult.upserted;

          const downloader = new DocumentDownloader();
                const dl = await downloader.downloadPending(500);
                stats.docs_downloaded += dl.downloaded;
                stats.docs_failed += dl.failed;

        } else if (mode === "awarded") {
                // ── Weekly: awarded tenders ──────────────────────────────────────────
          const portal = new PortalIngester();
                const r = await portal.ingestAll({ statusId: 2 });
                stats.tenders_fetched += r.fetched;
                stats.tenders_updated += r.updated;
                stats.docs_queued += r.documentsQueued;

        } else if (mode === "closed") {
                // ── Weekly: closed tenders ───────────────────────────────────────────
          const portal = new PortalIngester();
                const r = await portal.ingestAll({ statusId: 4 });
                stats.tenders_fetched += r.fetched;
                stats.tenders_updated += r.updated;
                stats.docs_queued += r.documentsQueued;

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
