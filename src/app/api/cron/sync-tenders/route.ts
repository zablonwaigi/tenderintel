import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { isAuthorized } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { DocumentDownloader } from "@/lib/pipeline/documentDownloader";
import {
  fetchOCDSPage,
  toOCDSDate,
  addMonths,
  PAGE_SIZE,
  type Release,
  type Document,
} from "./ocds-client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 300;

/** Per-run safety caps so a single invocation stays under the 300s task timeout. */
const INCREMENTAL_MAX_PAGES = 10; // ~5000 records
const BACKFILL_MAX_PAGES = 20; // ~10000 records
const BACKFILL_WINDOW_MONTHS = 3;
const OCDS_FULL_WINDOW_MONTHS = 3;
const BACKFILL_EPOCH = "2015-01-01T00:00:00Z";
const CAUGHT_UP_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — incremental takes over
// Default number of pending documents to fetch into storage per `download` run.
// Bounded to stay under the 300s task timeout; schedule the task frequently to
// drain the backlog and keep up with newly-queued documents.
const DOWNLOAD_BATCH = 200;

const VALID_MODES = [
  "incremental",
  "backfill",
  "awarded",
  "documents",
  "download",
  "ocds-full",
  "status",
] as const;
type SyncMode = (typeof VALID_MODES)[number];

// Legacy task commands may still hit removed modes. Map them to a sane modern
// equivalent so a stale Coolify task degrades gracefully instead of 400-ing.
const LEGACY_ALIASES: Record<string, SyncMode> = {
  closed: "incremental",
  ocds: "incremental",
  full: "backfill",
};

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

  // De-dup within the batch and drop ocid-less rows. An ocid can appear in
  // several releases (tender -> award -> contract); the API returns them
  // newest-first, so we must keep the LATEST-dated release per ocid rather than
  // whichever happens to come last in the array — otherwise an older "tender"
  // release overwrites a newer "award"/"contract" one and the status wrongly
  // reverts to "active".
  const byOcid = new Map<
    string,
    { row: ReturnType<typeof mapReleaseToTender>; date: number }
  >();
  for (const release of releases) {
    const row = mapReleaseToTender(release);
    if (!row.ocid) continue;
    const date = release.date ? Date.parse(release.date) : 0;
    const prev = byOcid.get(row.ocid);
    if (!prev || date >= prev.date) byOcid.set(row.ocid, { row, date });
  }
  const rows = [...byOcid.values()].map((v) => v.row);
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
  // OCDS requires both bounds: dateFrom = cursor high-water mark, dateTo = today.
  // Subtract a 2-day look-back so releases published just after a previous run
  // (or back-dated by the publisher) are never skipped between daily runs.
  // Re-fetched rows are idempotent upserts.
  const cursorDate = cursor?.last_synced_date
    ? new Date(cursor.last_synced_date)
    : new Date("2020-01-01T00:00:00Z");
  const dateFrom = toOCDSDate(new Date(cursorDate.getTime() - 2 * 24 * 60 * 60 * 1000));
  const dateTo = toOCDSDate(new Date());

  await writeCursor(supabase, cursorMode, { status: "running" });

  const stats: RunStats = { fetched: 0, newCount: 0, updatedCount: 0, pages: 0 };

  for (let page = 1; page <= maxPages; page++) {
    const pkg = await fetchOCDSPage(page, dateFrom, dateTo);
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

export interface BackfillOptions {
  cursorMode: string;
  windowMonths: number;
  maxPages: number;
  /** Hard lower bound; the cursor is never rewound earlier than this. */
  rangeStart?: Date;
  /** Hard upper bound. Defaults to (now - 30 days) so incremental owns recent. */
  rangeEnd?: Date;
}

export interface BackfillResult extends RunStats {
  done: boolean;
  windowFrom: string;
  windowTo: string;
  windowsSkipped: number;
  /** Date string the next invocation should resume from. */
  nextFrom: string;
}

// How many consecutive empty windows we skip within a single invocation before
// returning — lets the first run blow past the data-less early years (the
// eTenders OCDS feed has nothing before ~2017) without burning page budget.
const MAX_EMPTY_SKIPS = 48;

/**
 * Robust windowed backfill. Within one invocation it will:
 *   - resume mid-window via the cursor's last_page_number when a window was
 *     truncated by the page cap (guarantees completeness for dense windows);
 *   - cheaply skip empty windows (one page-1 probe each) up to MAX_EMPTY_SKIPS;
 *   - process the first data-bearing window up to maxPages, then return.
 * Progress is persisted to the cursor on every step so runs are resumable.
 */
export async function runBackfill(
  supabase: SupabaseClient,
  opts: BackfillOptions,
): Promise<BackfillResult> {
  const { cursorMode, windowMonths, maxPages } = opts;
  const now = new Date();
  const hardEnd = opts.rangeEnd ?? new Date(now.getTime() - CAUGHT_UP_MS);
  const floor = opts.rangeStart ?? new Date(BACKFILL_EPOCH);

  const cursor = await readCursor(supabase, cursorMode);
  let windowStart = cursor?.last_synced_date
    ? new Date(cursor.last_synced_date)
    : floor;
  if (windowStart < floor) windowStart = floor;
  let startPage = (cursor?.last_page_number ?? 0) + 1;

  const stats: RunStats = { fetched: 0, newCount: 0, updatedCount: 0, pages: 0 };
  let skips = 0;
  let windowFrom = toOCDSDate(windowStart);
  let windowTo = windowFrom;

  await writeCursor(supabase, cursorMode, { status: "running" });

  const persist = async (
    resumeDate: Date,
    page: number,
    status: string,
  ): Promise<void> => {
    await writeCursor(supabase, cursorMode, {
      last_synced_date: resumeDate.toISOString(),
      last_page_number: page,
      total_records: (cursor?.total_records ?? 0) + stats.fetched,
      status,
    });
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (windowStart >= hardEnd) {
      await persist(hardEnd, 0, "completed");
      return {
        ...stats,
        done: true,
        windowFrom,
        windowTo,
        windowsSkipped: skips,
        nextFrom: toOCDSDate(hardEnd),
      };
    }

    let windowEnd = addMonths(windowStart, windowMonths);
    if (windowEnd > hardEnd) windowEnd = hardEnd;
    windowFrom = toOCDSDate(windowStart);
    windowTo = toOCDSDate(windowEnd);

    let windowFetched = 0;
    let lastPage = startPage - 1;
    let drained = false;

    for (let n = 0; n < maxPages; n++) {
      const page = startPage + n;
      const pkg = await fetchOCDSPage(page, windowFrom, windowTo);
      const releases = pkg.releases;
      if (releases.length === 0) {
        drained = true;
        break;
      }
      const r = await upsertReleases(supabase, releases);
      stats.fetched += releases.length;
      stats.newCount += r.newCount;
      stats.updatedCount += r.updatedCount;
      stats.pages += 1;
      windowFetched += releases.length;
      lastPage = page;

      if (!pkg.links?.next || releases.length < PAGE_SIZE) {
        drained = true;
        break;
      }
    }

    if (!drained) {
      // Hit the page cap mid-window — resume this same window next invocation.
      await persist(windowStart, lastPage, "idle");
      return {
        ...stats,
        done: false,
        windowFrom,
        windowTo,
        windowsSkipped: skips,
        nextFrom: windowFrom,
      };
    }

    // Window fully drained — advance to the next window.
    windowStart = windowEnd;
    startPage = 1;

    if (windowFetched === 0) {
      // Empty window: skip cheaply, but bound the scan so we stay under 300s.
      skips += 1;
      if (skips < MAX_EMPTY_SKIPS && windowStart < hardEnd) {
        await persist(windowStart, 0, "running");
        continue;
      }
      const done = windowStart >= hardEnd;
      await persist(windowStart, 0, done ? "completed" : "idle");
      return {
        ...stats,
        done,
        windowFrom,
        windowTo,
        windowsSkipped: skips,
        nextFrom: toOCDSDate(windowStart),
      };
    }

    // Got data and drained the window — stop; the next run takes the next window.
    const done = windowStart >= hardEnd;
    await persist(windowStart, 0, done ? "completed" : "idle");
    return {
      ...stats,
      done,
      windowFrom,
      windowTo,
      windowsSkipped: skips,
      nextFrom: toOCDSDate(windowStart),
    };
  }
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
async function runDocuments(
  supabase: SupabaseClient,
): Promise<{ queued: number; scanned: number }> {
  const candidates = new Map<string, DocCandidate>();

  // Walk the ENTIRE tenders table (paged) so documents for every tender get
  // queued — not just the most-recent page. Ordered by the unique tender_id so
  // range pagination is stable. Already-queued rows are de-duped before insert,
  // so re-scanning on each run is cheap and idempotent.
  const BATCH = 1000;
  for (let offset = 0; ; offset += BATCH) {
    const { data, error } = await supabase
      .from("tenders")
      .select("tender_id, ocds_data")
      .not("ocds_data", "is", null)
      .order("tender_id", { ascending: true })
      .range(offset, offset + BATCH - 1);
    if (error) throw new Error(`tenders query failed: ${error.message}`);

    const batch = data ?? [];
    for (const row of batch) {
      const tenderId = row.tender_id as string;
      const ocds = (row.ocds_data ?? {}) as Release;
      const docs: Document[] = [
        ...(ocds.tender?.documents ?? []),
        ...(ocds.awards ?? []).flatMap((a) => a.documents ?? []),
        ...(ocds.contracts ?? []).flatMap((c) => c.documents ?? []),
      ];

      for (const doc of docs) {
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

    if (batch.length < BATCH) break;
  }

  const rows = [...candidates.values()];
  const scanned = rows.length;
  if (scanned === 0) return { queued: 0, scanned: 0 };

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

  if (newRows.length === 0) return { queued: 0, scanned };

  // Plain insert of the already-deduped new rows. We intentionally do NOT use
  // ON CONFLICT here: the only guaranteed unique index is (tender_id,
  // file_name, source_url), and newRows are pre-filtered to be absent by
  // (tender_id, source_url) — a superset — so they cannot collide.
  let inserted = 0;
  for (const part of chunk(newRows, 500)) {
    const { error: insertError } = await supabase
      .from("tender_documents")
      .insert(part);
    if (insertError) {
      // A duplicate from a concurrent run is non-fatal; anything else surfaces.
      if (!/duplicate key|unique constraint/i.test(insertError.message)) {
        throw new Error(`tender_documents insert failed: ${insertError.message}`);
      }
      continue;
    }
    inserted += part.length;
  }

  return { queued: inserted, scanned };
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

  const rawMode = req.nextUrl.searchParams.get("mode") ?? "incremental";
  const modeParam = LEGACY_ALIASES[rawMode] ?? rawMode;
  if (!VALID_MODES.includes(modeParam as SyncMode)) {
    return NextResponse.json(
      { error: `Invalid mode "${rawMode}". Valid modes: ${VALID_MODES.join(", ")}` },
      { status: 400 },
    );
  }
  const mode = modeParam as SyncMode;

  const supabase = createServiceClient();
  const startTime = new Date();

  // Lightweight diagnostics: row counts + status breakdown + cursor state.
  // Use this to confirm schema and watch sync progress (e.g. ?mode=status).
  if (mode === "status") {
    const STATUSES = ["active", "awarded", "cancelled", "contract_signed"];
    const headCount = (q: ReturnType<SupabaseClient["from"]>) =>
      q.select("*", { count: "exact", head: true });
    const [
      { count: tenders },
      { count: documents },
      { count: docsDownloaded },
      { count: docsPending },
      { data: cursors },
      statusCounts,
    ] = await Promise.all([
      headCount(supabase.from("tenders")),
      headCount(supabase.from("tender_documents")),
      headCount(supabase.from("tender_documents")).eq("download_status", "downloaded"),
      headCount(supabase.from("tender_documents")).eq("download_status", "pending"),
      supabase
        .from("ocds_sync_cursor")
        .select("sync_mode, last_synced_date, last_page_number, total_records, status")
        .order("sync_mode"),
      Promise.all(
        STATUSES.map(async (s) => {
          const { count } = await headCount(supabase.from("tenders")).eq("status", s);
          return [s, count ?? 0] as const;
        }),
      ),
    ]);
    return NextResponse.json({
      success: true,
      mode: "status",
      tenders: tenders ?? 0,
      by_status: Object.fromEntries(statusCounts),
      documents: documents ?? 0,
      docs_downloaded: docsDownloaded ?? 0,
      docs_pending: docsPending ?? 0,
      cursors: cursors ?? [],
      now: new Date().toISOString(),
    });
  }

  let stats: RunStats = { fetched: 0, newCount: 0, updatedCount: 0, pages: 0 };
  let queued = 0;
  let downloaded = 0;
  let failed = 0;
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
        const r = await runBackfill(supabase, {
          cursorMode: "backfill",
          windowMonths: BACKFILL_WINDOW_MONTHS,
          maxPages: BACKFILL_MAX_PAGES,
        });
        stats = r;
        extra = {
          done: r.done,
          windowFrom: r.windowFrom,
          windowTo: r.windowTo,
          windowsSkipped: r.windowsSkipped,
          nextFrom: r.nextFrom,
        };
        break;
      }
      case "ocds-full": {
        // Continues the same `backfill` cursor (so it progresses run-to-run).
        // Pass ?reset=true to restart history from the epoch.
        if (req.nextUrl.searchParams.get("reset") === "true") {
          await writeCursor(supabase, "backfill", {
            last_synced_date: BACKFILL_EPOCH,
            last_page_number: 0,
            status: "idle",
          });
        }
        const r = await runBackfill(supabase, {
          cursorMode: "backfill",
          windowMonths: OCDS_FULL_WINDOW_MONTHS,
          maxPages: BACKFILL_MAX_PAGES,
        });
        stats = r;
        extra = {
          done: r.done,
          windowFrom: r.windowFrom,
          windowTo: r.windowTo,
          windowsSkipped: r.windowsSkipped,
          nextFrom: r.nextFrom,
        };
        break;
      }
      case "documents": {
        await writeCursor(supabase, "documents", { status: "running" });
        const r = await runDocuments(supabase);
        queued = r.queued;
        extra = { scanned: r.scanned };
        await writeCursor(supabase, "documents", {
          last_synced_date: new Date().toISOString(),
          total_records: r.scanned,
          status: "completed",
        });
        break;
      }
      case "download": {
        await writeCursor(supabase, "download", { status: "running" });
        const limitParam = Number(req.nextUrl.searchParams.get("limit"));
        const limit =
          Number.isFinite(limitParam) && limitParam > 0
            ? Math.min(1000, Math.floor(limitParam))
            : DOWNLOAD_BATCH;
        const downloader = new DocumentDownloader(supabase);
        const r = await downloader.downloadPending(limit);
        downloaded = r.downloaded;
        failed = r.failed;
        extra = { downloaded: r.downloaded, failed: r.failed, processed: r.processed };
        await writeCursor(supabase, "download", {
          last_synced_date: new Date().toISOString(),
          total_records: r.downloaded,
          status: "completed",
        });
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
    mode === "incremental"
      ? "incremental"
      : mode === "documents" || mode === "download"
        ? "documents"
        : "full";
  try {
    await supabase.from("ingestion_log").insert({
      run_type: runType,
      status: error ? "failed" : "success",
      tenders_fetched: stats.fetched,
      tenders_new: stats.newCount,
      tenders_updated: stats.updatedCount,
      docs_queued: queued,
      docs_downloaded: downloaded,
      docs_failed: failed,
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
