import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { startRun } from "@/lib/pipeline/runner";
import { PortalIngester } from "@/lib/pipeline/portalIngester";
import { DocumentDownloader } from "@/lib/pipeline/documentDownloader";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily sync entrypoint for Coolify Scheduled Tasks.
 * Runs an incremental portal sync (active tenders) followed by a batch
 * of document downloads for newly queued files. Fire-and-forget so the
 * HTTP request returns immediately.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = await startRun("incremental");

  void (async () => {
    const supabase = createServiceClient();
    const stats = {
      tenders_fetched: 0,
      tenders_updated: 0,
      docs_queued: 0,
      docs_downloaded: 0,
      docs_failed: 0,
    };
    try {
      const portal = new PortalIngester();
      const ingest = await portal.ingestAll({ statusId: 1 });
      stats.tenders_fetched = ingest.fetched;
      stats.tenders_updated = ingest.updated;
      stats.docs_queued = ingest.documentsQueued;

      const downloader = new DocumentDownloader();
      const dl = await downloader.downloadPending(500);
      stats.docs_downloaded = dl.downloaded;
      stats.docs_failed = dl.failed;

      await supabase
        .from("ingestion_log")
        .update({ ...stats, status: "completed", completed_at: new Date().toISOString() })
        .eq("id", runId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("cron sync-tenders failed:", err);
      await supabase
        .from("ingestion_log")
        .update({ ...stats, status: "failed", error_message: message, completed_at: new Date().toISOString() })
        .eq("id", runId);
    }
  })();

  return NextResponse.json({ status: "started", runId });
}
