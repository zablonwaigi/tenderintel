import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchOCDSPage, toOCDSDate, addMonths, PAGE_SIZE } from "../sync-tenders/ocds-client";
import { upsertReleases, readCursor, writeCursor } from "../sync-tenders/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Dedicated one-time historical backfill endpoint.
 *
 *   GET /api/cron/sync-backfill?from=2015-01-01&to=2026-06-01
 *
 * Processes exactly ONE 3-month window per invocation (staying well under the
 * 300s task timeout), persists progress in `ocds_sync_cursor` under the
 * `backfill-init` mode, and returns where the next call should resume so a
 * caller can chain invocations until `done` is true.
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

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const rangeStart = parseDate(fromParam, new Date(`${DEFAULT_FROM}T00:00:00Z`));
  const rangeEnd = parseDate(toParam, new Date());

  try {
    // Resume from the cursor if we've already started; otherwise begin at `from`.
    const cursor = await readCursor(supabase, CURSOR_MODE);
    let windowStart = cursor?.last_synced_date
      ? new Date(cursor.last_synced_date)
      : rangeStart;
    // A changed `from` that pre-dates our progress should not rewind us, but a
    // fresh range that starts later than the cursor should be honoured.
    if (windowStart < rangeStart) windowStart = rangeStart;

    if (windowStart >= rangeEnd) {
      await writeCursor(supabase, CURSOR_MODE, { status: "completed" });
      return NextResponse.json({
        done: true,
        nextFrom: toOCDSDate(rangeEnd),
        processed: 0,
      });
    }

    let windowEnd = addMonths(windowStart, WINDOW_MONTHS);
    if (windowEnd > rangeEnd) windowEnd = rangeEnd;

    await writeCursor(supabase, CURSOR_MODE, { status: "running" });

    const dateFrom = toOCDSDate(windowStart);
    const dateTo = toOCDSDate(windowEnd);

    let processed = 0;
    let newCount = 0;
    let updatedCount = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const pkg = await fetchOCDSPage(page, dateFrom, dateTo);
      const releases = pkg.releases;
      if (releases.length === 0) break;

      const r = await upsertReleases(supabase, releases);
      processed += releases.length;
      newCount += r.newCount;
      updatedCount += r.updatedCount;

      if (!pkg.links?.next) break;
      if (releases.length < PAGE_SIZE) break;
    }

    const done = windowEnd >= rangeEnd;
    await writeCursor(supabase, CURSOR_MODE, {
      last_synced_date: windowEnd.toISOString(),
      total_records: (cursor?.total_records ?? 0) + processed,
      status: done ? "completed" : "idle",
    });

    await supabase.from("ingestion_log").insert({
      run_type: "full",
      status: "success",
      tenders_fetched: processed,
      tenders_new: newCount,
      tenders_updated: updatedCount,
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      done,
      nextFrom: toOCDSDate(windowEnd),
      processed,
      new: newCount,
      updated: updatedCount,
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
