import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { startRun, executeRun, PipelineMode } from "@/lib/pipeline/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VALID_MODES: PipelineMode[] = [
    "full",
    "incremental",
    "awarded",
    "closed",
    "documents",
    "ocds",
    "ocds-full",
  ];

/**
 * Unified sync endpoint used by Coolify Scheduled Tasks.
 *
 * Query parameters:
 *   mode  - one of: full | incremental | awarded | closed | documents | ocds | ocds-full
 *           Defaults to "incremental" when not specified.
 *
 * Examples:
 *   GET /api/cron/sync-tenders                       -> incremental (daily default)
 *   GET /api/cron/sync-tenders?mode=full             -> full sync all statuses + OCDS history
 *   GET /api/cron/sync-tenders?mode=awarded          -> awarded tenders only (weekly)
 *   GET /api/cron/sync-tenders?mode=closed           -> closed tenders only (weekly)
 *   GET /api/cron/sync-tenders?mode=ocds-full        -> full OCDS history back to 2010
 *   GET /api/cron/sync-tenders?mode=documents        -> download pending documents only
 *
 * Auth: Bearer token matching CRON_SECRET env var.
 */
export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  const modeParam = req.nextUrl.searchParams.get("mode") ?? "incremental";
    const mode = VALID_MODES.includes(modeParam as PipelineMode)
      ? (modeParam as PipelineMode)
          : "incremental";

  if (!VALID_MODES.includes(modeParam as PipelineMode) && modeParam !== "incremental") {
        return NextResponse.json(
          { error: `Invalid mode "${modeParam}". Valid modes: ${VALID_MODES.join(", ")}` },
          { status: 400 }
              );
  }

  const runId = await startRun(mode);

  // Fire-and-forget: execute the pipeline asynchronously so the HTTP request
  // returns immediately (Coolify scheduled task timeout is generous but the
  // full sync can take many minutes).
  void executeRun(runId, mode);

  return NextResponse.json({ status: "started", mode, runId });
}
