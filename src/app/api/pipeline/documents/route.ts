import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { DocumentDownloader } from "@/lib/pipeline/documentDownloader";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Trigger a batch of pending document downloads.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let limit = 500;
  try {
    const body = await req.json();
    if (typeof body?.limit === "number") limit = Math.min(2000, body.limit);
  } catch {
    // default
  }

  try {
    const downloader = new DocumentDownloader();
    const result = await downloader.downloadPending(limit);
    return NextResponse.json({ status: "completed", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
