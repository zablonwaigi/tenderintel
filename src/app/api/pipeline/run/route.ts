import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { startRun, executeRun, type PipelineMode } from "@/lib/pipeline/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VALID_MODES: PipelineMode[] = ["full", "incremental", "documents", "ocds"];

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let mode: PipelineMode = "incremental";
  try {
    const body = await req.json();
    if (body?.mode) mode = body.mode;
  } catch {
    // default mode
  }

  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: `Invalid mode: ${mode}` }, { status: 400 });
  }

  const runId = await startRun(mode);

  // Fire-and-forget: do not await so the request returns immediately.
  void executeRun(runId, mode);

  return NextResponse.json({ runId, status: "started", mode });
}
