import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { runBackfill, writeCursor } from "../sync-tenders/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Dedicated one-time historical backfill endpoint.
 *
 *   GET /api/cron/sync-backfill?from=2015-01-01&to=2026-06-01
 *
 * Delegates to the shared robust backfill engine: it resumes mid-window on
 * truncation, cheaply skips the data-less early years, and processes the first
 * data-bearing window per call. Progress lives in `ocds_sync_cursor` under the
 * `backfill-init` mode. Returns `{ done, nextFrom, processed }` so a caller can
 * chain invocations until `done` is true.
 *
 * Pass ?reset=true to restart the range from `from`.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>.
 */

const CURSOR_MODE = "backfill-init";
const DEFAULT_FROM = "2015-01-01";
const WINDOW_MONTHS = 3;
const MAX_PAGES = 20;

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const startTime = new Date();

  const rangeStart = parseDate(
    req.nextUrl.searchParams.get("from"),
    new Date(`${DEFAULT_FROM}T00:00:00Z`),
  );
  const rangeEnd = parseDate(req.nextUrl.searchParams.get("to"), new Date());

  try {
    if (req.nextUrl.searchParams.get("reset") === "true") {
      await writeCursor(supabase, CURSOR_MODE, {
        last_synced_date: rangeStart.toISOString(),
        last_page_number: 0,
        status: "idle",
      });
    }

    const r = await runBackfill(supabase, {
      cursorMode: CURSOR_MODE,
      windowMonths: WINDOW_MONTHS,
      maxPages: MAX_PAGES,
      rangeStart,
      rangeEnd,
    });

    await supabase.from("ingestion_log").insert({
      run_type: "full",
      status: "success",
      tenders_fetched: r.fetched,
      tenders_new: r.newCount,
      tenders_updated: r.updatedCount,
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      done: r.done,
      nextFrom: r.nextFrom,
      processed: r.fetched,
      new: r.newCount,
      updated: r.updatedCount,
      windowFrom: r.windowFrom,
      windowTo: r.windowTo,
      windowsSkipped: r.windowsSkipped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-backfill] failed:", err);
    await writeCursor(supabase, CURSOR_MODE, { status: "failed" }).catch(() => {});
    await supabase
      .from("ingestion_log")
      .insert({
        run_type: "full",
        status: "failed",
        error_message: message,
        started_at: startTime.toISOString(),
        completed_at: new Date().toISOString(),
      })
      .then(undefined, () => {});

    return NextResponse.json({ done: false, error: message }, { status: 500 });
  }
}
