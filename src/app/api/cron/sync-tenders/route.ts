import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { isAuthorized } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchOCDSPage,
  toOCDSDate,
  addMonths,
  PAGE_SIZE,
  type Release,
  type Document,
} from "./ocds-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Per-run safety caps so a single invocation stays under the 300s task timeout. */
const INCREMENTAL_MAX_PAGES = 10; // ~5000 records
const BACKFILL_MAX_PAGES = 20; // ~10000 records
const BACKFILL_WINDOW_MONTHS = 1;
const OCDS_FULL_WINDOW_MONTHS = 3;
const BACKFILL_EPOCH = "2015-01-01T00:00:00Z";
const CAUGHT_UP_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — incremental takes over

const VALID_MODES = [
  "incremental",
  "backfill",
  "awarded",
  "documents",
  "ocds-full",
] as const;
type SyncMode = (typeof VALID_MODES)[number];

// ── OCDS release → tenders row mapping ──────────────────────────────────────

export function mapReleaseToTender(release: Release) {
  const tender = release.tender || ({} as NonNullable<Release["tender"]>);
  const awards = release.awards || [];
  const contracts = release.contracts || [];
  const buyer = release.buyer || ({} as NonNullable<Release["buyer"]>);
  const firstAward = awards[0] || {};
  const firstSupplier = (firstAward.suppliers || [])[0] || {};
  const firstContract = contracts[0] || {};

  // Map OCDS tag[] to internal status
  const tags: string[] = release.tag || [];
  let status = "active";
  if (tags.includes("awardNotice") || tags.includes("award")) status = "awarded";
  else if (tags.includes("tenderCancellation") || tags.includes("planningUpdate"))
    status = "cancelled";
  else if (tags.includes("contractSigned") || tags.includes("contract"))
    status = "contract_signed";
  else if (tags.includes("tender")) status = "active";
  else if (tags.some((t) => t.includes("cancel"))) status = "cancelled";

  return {
    tender_id: release.ocid || release.id,
    tender_number: tender.id || tender.title || release.id,
    description: tender.title || release.description || "",
    category: tender.mainProcurementCategory || tender.category || null,
    department: buyer.name || null,
    province:
      tender.items?.[0]?.deliveryLocation?.description || tender.province || null,
    status,
    ocds_status: tender.status || null,
    ocds_tags: tags,
    date_advertised: tender.tenderPeriod?.startDate
      ? new Date(tender.tenderPeriod.startDate)
      : null,
    closing_date: tender.tenderPeriod?.endDate
      ? new Date(tender.tenderPeriod.endDate)
      : null,
    award_date: firstAward.date ? new Date(firstAward.date) : null,
    award_supplier_name: firstSupplier.name || null,
    award_supplier_id: firstSupplier.id || firstSupplier.identifier?.id || null,
    award_value: firstAward.value?.amount ?? null,
    award_currency: firstAward.value?.currency || "ZAR",
    contract_value: firstContract.value?.amount ?? null,
    contract_currency: firstContract.value?.currency || "ZAR",
    contract_start_date: firstContract.period?.startDate
      ? new Date(firstContract.period.startDate)
      : null,
    contract_end_date: firstContract.period?.endDate
      ? new Date(firstContract.period.endDate)
      : null,
    buyer_name: buyer.name || null,
    buyer_id: buyer.id || buyer.identifier?.id || null,
    ocid: release.ocid || null,
    ocds_data: release,
    last_ocds_sync: new Date(),
    sync_source: "ocds",
  };
}

/** True when a release represents an award notice (used by the `awarded` mode). */
export function isAwardedRelease(release: Release): boolean {
  const tags = release.tag || [];
  return tags.includes("awardNotice") || tags.includes("award");
}

// ── Cursor helpers ──────────────────────────────────────────────────────────

export interface SyncCursor {
  sync_mode: string;
  last_synced_date: string | null;
  last_page_number: number | null;
  total_records: number | null;
  status: string | null;
}

export async function readCursor(
  supabase: SupabaseClient,
  mode: string,
): Promise<SyncCursor | null> {
  const { data } = await supabase
    .from("ocds_sync_cursor")
    .select("sync_mode, last_synced_date, last_page_number, total_records, status")
    .eq("sync_mode", mode)
    .maybeSingle();
  return (data as SyncCursor) ?? null;
}

export async function writeCursor(
  supabase: SupabaseClient,
  mode: string,
  fields: Partial<{
    last_synced_date: string;
    last_page_number: number;
    total_records: number;
    status: string;
  }>,
): Promise<void> {
  await supabase
    .from("ocds_sync_cursor")
    .upsert(
      { sync_mode: mode, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "sync_mode" },
    );
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

export interface UpsertStats {
  fetched: number;
  newCount: number;
  updatedCount: number;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Upsert a batch of releases into `tenders` keyed on `ocid`.
 * Computes new-vs-updated by checking which ocids already exist first.
 */
export async function upsertReleases(
  supabase: SupabaseClient,
  releases: Release[],
): Promise<UpsertStats> {
  const fetched = releases.length;

  // De-dup within the batch (last release for an ocid wins) and drop ocid-less rows.
  const byOcid = new Map<string, ReturnType<typeof mapReleaseToTender>>();
  for (const release of releases) {
    const row = mapReleaseToTender(release);
    if (row.ocid) byOcid.set(row.ocid, row);
  }
  const rows = [...byOcid.values()];
  if (rows.length === 0) return { fetched, newCount: 0, updatedCount: 0 };

  const ocids = [...byOcid.keys()];
  const existing = new Set<string>();
  for (const part of chunk(ocids, 1000)) {
    const { data } = await supabase
      .from("tenders")
      .select("ocid")
      .in("ocid", part);
    for (const r of data ?? []) if (r.ocid) existing.add(r.ocid as string);
  }

  const newCount = rows.filter((r) => r.ocid && !existing.has(r.ocid)).length;
  const updatedCount = rows.length - newCount;

  for (const part of chunk(rows, 500)) {
    const { error } = await supabase
      .from("tenders")
      .upsert(part, { onConflict: "ocid", ignoreDuplicates: false });
    if (error) throw new Error(`tenders upsert failed: ${error.message}`);
  }

  return { fetched, newCount, updatedCount };
}

// ── Mode runners ────────────────────────────────────────────────────────────

export interface RunStats {
  fetched: number;
  newCount: number;
  updatedCount: number;
  pages: number;
}

/**
 * Incremental-style sync: page forward from the cursor's high-water mark using
 * `dateFrom` only. `awardedOnly` keeps just award-notice releases (awarded mode).
 */
async function runIncremental(
  supabase: SupabaseClient,
  cursorMode: string,
  maxPages: number,
  awardedOnly: boolean,
): Promise<RunStats> {
  const cursor = await readCursor(supabase, cursorMode);
  const dateFrom = cursor?.last_synced_date
    ? toOCDSDate(new Date(cursor.last_synced_date))
    : undefined;

  await writeCursor(supabase, cursorMode, { status: "running" });

  const stats: RunStats = { fetched: 0, newCount: 0, updatedCount: 0, pages: 0 };

  for (let page = 1; page <= maxPages; page++) {
    const pkg = await fetchOCDSPage(page, dateFrom);
    const releases = pkg.releases;
    if (releases.length === 0) break;
    stats.pages += 1;

    const toUpsert = awardedOnly ? releases.filter(isAwardedRelease) : releases;
    const r = await upsertReleases(supabase, toUpsert);
    stats.fetched += releases.length;
    stats.newCount += r.newCount;
    stats.updatedCount += r.updatedCount;

    if (!pkg.links?.next) break;
    if (releases.length < PAGE_SIZE) break;
  }

  await writeCursor(supabase, cursorMode, {
    last_synced_date: new Date().toISOString(),
    last_page_number: stats.pages,
    total_records: (cursor?.total_records ?? 0) + stats.fetched,
    status: "completed",
  });

  return stats;
}

/**
 * Windowed backfill: process a single [cursor, cursor + windowMonths] window per
 * invocation, then advance the cursor. Stops advancing once within 30 days of now.
 */
async function runBackfill(
  supabase: SupabaseClient,
  cursorMode: string,
  windowMonths: number,
  maxPages: number,
): Promise<RunStats & { done: boolean; windowFrom: string; windowTo: string }> {
  const cursor = await readCursor(supabase, cursorMode);
  const windowStart = cursor?.last_synced_date
    ? new Date(cursor.last_synced_date)
    : new Date(BACKFILL_EPOCH);

  const now = new Date();
  const caughtUpAt = new Date(now.getTime() - CAUGHT_UP_MS);
  const stats: RunStats = { fetched: 0, newCount: 0, updatedCount: 0, pages: 0 };

  // Already caught up — incremental owns the recent window from here.
  if (windowStart >= caughtUpAt) {
    await writeCursor(supabase, cursorMode, { status: "completed" });
    return {
      ...stats,
      done: true,
      windowFrom: toOCDSDate(windowStart),
      windowTo: toOCDSDate(windowStart),
    };
  }

  let windowEnd = addMonths(windowStart, windowMonths);
  if (windowEnd > now) windowEnd = now;

  await writeCursor(supabase, cursorMode, { status: "running" });

  const dateFrom = toOCDSDate(windowStart);
  const dateTo = toOCDSDate(windowEnd);

  for (let page = 1; page <= maxPages; page++) {
    const pkg = await fetchOCDSPage(page, dateFrom, dateTo);
    const releases = pkg.releases;
    if (releases.length === 0) break;
    stats.pages += 1;

    const r = await upsertReleases(supabase, releases);
    stats.fetched += releases.length;
    stats.newCount += r.newCount;
    stats.updatedCount += r.updatedCount;

    if (!pkg.links?.next) break;
    if (releases.length < PAGE_SIZE) break;
  }

  const done = windowEnd >= caughtUpAt;
  await writeCursor(supabase, cursorMode, {
    last_synced_date: windowEnd.toISOString(),
    last_page_number: stats.pages,
    total_records: (cursor?.total_records ?? 0) + stats.fetched,
    status: done ? "completed" : "idle",
  });

  return { ...stats, done, windowFrom: dateFrom, windowTo: dateTo };
}

// ── Documents mode ────────────────────────────────────────────────────────────

function fileTypeFromUrl(url: string, format?: string): string | null {
  if (format) return format.toLowerCase();
  const match = url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase() : null;
}

function fileNameFromDoc(doc: Document, fallback: string): string {
  if (doc.title) return doc.title;
  if (doc.id) return doc.id;
  try {
    const path = new URL(doc.url ?? "").pathname;
    const last = decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
    if (last) return last;
  } catch {
    /* not a parseable URL */
  }
  return fallback;
}

interface DocCandidate {
  tender_id: string;
  file_name: string;
  source_url: string;
  file_type: string | null;
  download_status: "pending";
}

/**
 * Scan recently-synced tenders for OCDS document URLs and queue any new ones
 * into `tender_documents` (ON CONFLICT (tender_id, source_url) DO NOTHING).
 * Returns the number of newly-queued documents.
 */
async function runDocuments(supabase: SupabaseClient): Promise<{ queued: number }> {
  const { data, error } = await supabase
    .from("tenders")
    .select("tender_id, ocds_data")
    .not("ocds_data", "is", null)
    .order("last_ocds_sync", { ascending: false, nullsFirst: false })
    .limit(2000);
  if (error) throw new Error(`tenders query failed: ${error.message}`);

  const candidates = new Map<string, DocCandidate>();
  for (const row of data ?? []) {
    const tenderId = row.tender_id as string;
    const ocds = (row.ocds_data ?? {}) as Release;
    const tenderDocs = ocds.tender?.documents ?? [];
    const awardDocs = ocds.awards?.[0]?.documents ?? [];

    for (const doc of [...tenderDocs, ...awardDocs]) {
      if (!doc?.url) continue;
      const key = `${tenderId} ${doc.url}`;
      if (candidates.has(key)) continue;
      candidates.set(key, {
        tender_id: tenderId,
        file_name: fileNameFromDoc(doc, doc.url),
        source_url: doc.url,
        file_type: fileTypeFromUrl(doc.url, doc.format),
        download_status: "pending",
      });
    }
  }

  const rows = [...candidates.values()];
  if (rows.length === 0) return { queued: 0 };

  // Determine which (tender_id, source_url) pairs already exist so we can report
  // an accurate count of *newly* queued documents.
  const existing = new Set<string>();
  const urls = rows.map((r) => r.source_url);
  for (const part of chunk(urls, 500)) {
    const { data: existingRows } = await supabase
      .from("tender_documents")
      .select("tender_id, source_url")
      .in("source_url", part);
    for (const r of existingRows ?? []) {
      existing.add(`${r.tender_id} ${r.source_url}`);
    }
  }

  const newRows = rows.filter(
    (r) => !existing.has(`${r.tender_id} ${r.source_url}`),
  );

  for (const part of chunk(rows, 500)) {
    const { error: insertError } = await supabase
      .from("tender_documents")
      .upsert(part, { onConflict: "tender_id,source_url", ignoreDuplicates: true });
    if (insertError) {
      throw new Error(`tender_documents insert failed: ${insertError.message}`);
    }
  }

  return { queued: newRows.length };
}

// ── Route handler ───────────────────────────────────────────────────────────

/**
 * Unified OCDS sync endpoint used by Coolify scheduled tasks.
 *
 *   GET /api/cron/sync-tenders?mode=incremental   daily 06:00 — recent releases
 *   GET /api/cron/sync-tenders?mode=awarded        Mon 07:00 — award notices only
 *   GET /api/cron/sync-tenders?mode=backfill       monthly — one historical window
 *   GET /api/cron/sync-tenders?mode=ocds-full      monthly 02:00 — reset + restart backfill
 *   GET /api/cron/sync-tenders?mode=documents      every 4h — queue document downloads
 *
 * Auth: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const modeParam = req.nextUrl.searchParams.get("mode") ?? "incremental";
  if (!VALID_MODES.includes(modeParam as SyncMode)) {
    return NextResponse.json(
      { error: `Invalid mode "${modeParam}". Valid modes: ${VALID_MODES.join(", ")}` },
      { status: 400 },
    );
  }
  const mode = modeParam as SyncMode;

  const supabase = createServiceClient();
  const startTime = new Date();

  let stats: RunStats = { fetched: 0, newCount: 0, updatedCount: 0, pages: 0 };
  let queued = 0;
  let extra: Record<string, unknown> = {};
  let error: Error | null = null;

  try {
    switch (mode) {
      case "incremental":
        stats = await runIncremental(supabase, "incremental", INCREMENTAL_MAX_PAGES, false);
        break;
      case "awarded":
        stats = await runIncremental(supabase, "awarded", INCREMENTAL_MAX_PAGES, true);
        break;
      case "backfill": {
        const r = await runBackfill(supabase, "backfill", BACKFILL_WINDOW_MONTHS, BACKFILL_MAX_PAGES);
        stats = r;
        extra = { done: r.done, windowFrom: r.windowFrom, windowTo: r.windowTo };
        break;
      }
      case "ocds-full": {
        // Reset the backfill cursor to the epoch and restart with wider windows.
        await writeCursor(supabase, "backfill", { last_synced_date: BACKFILL_EPOCH, status: "idle" });
        const r = await runBackfill(supabase, "backfill", OCDS_FULL_WINDOW_MONTHS, BACKFILL_MAX_PAGES);
        stats = r;
        extra = { done: r.done, windowFrom: r.windowFrom, windowTo: r.windowTo };
        break;
      }
      case "documents": {
        const r = await runDocuments(supabase);
        queued = r.queued;
        break;
      }
    }
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
    console.error(`[sync-tenders] mode=${mode} failed:`, error);
    await writeCursor(supabase, mode === "ocds-full" ? "backfill" : mode, {
      status: "failed",
    }).catch(() => {});
  }

  // Always record the run.
  const runType =
    mode === "incremental" ? "incremental" : mode === "documents" ? "documents" : "full";
  try {
    await supabase.from("ingestion_log").insert({
      run_type: runType,
      status: error ? "failed" : "success",
      tenders_fetched: stats.fetched,
      tenders_new: stats.newCount,
      tenders_updated: stats.updatedCount,
      docs_queued: queued,
      error_message: error?.message || null,
      started_at: startTime.toISOString(),
      completed_at: new Date().toISOString(),
    });
  } catch (logErr) {
    console.error("[sync-tenders] failed to write ingestion_log:", logErr);
  }

  if (error) {
    return NextResponse.json(
      { success: false, mode, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    mode,
    fetched: stats.fetched,
    new: stats.newCount,
    updated: stats.updatedCount,
    pages: stats.pages,
    ...(mode === "documents" ? { queued } : {}),
    ...extra,
  });
}
