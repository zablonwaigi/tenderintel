import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { startRun, executeRun, PIPELINE_MODES, type PipelineMode } from "@/lib/pipeline/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Unified scheduled-task entrypoint for Coolify.
 * Select the work via the `mode` query param (defaults to `incremental`):
 *
 *   /api/cron/sync-tenders?mode=incremental   (daily — active + OCDS 30d + docs)
 *   /api/cron/sync-tenders?mode=awarded       (weekly — statusId=2)
 *   /api/cron/sync-tenders?mode=closed        (weekly — statusId=4)
 *   /api/cron/sync-tenders?mode=documents     (every few hours — pending downloads)
 *   /api/cron/sync-tenders?mode=ocds-full     (monthly — full OCDS history)
 *   /api/cron/sync-tenders?mode=full          (one-off backfill of everything)
 *
 * Fire-and-forget: the run executes in the background and progress is recorded
 * in the ingestion_log table.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = (req.nextUrl.searchParams.get("mode") ?? "incremental") as PipelineMode;
  if (!PIPELINE_MODES.includes(requested)) {
    return NextResponse.json(
      { error: `Invalid mode: ${requested}`, validModes: PIPELINE_MODES },
      { status: 400 }
    );
  }

  const runId = await startRun(requested);
  void executeRun(runId, requested);

  return NextResponse.json({ status: "started", mode: requested, runId });
}
