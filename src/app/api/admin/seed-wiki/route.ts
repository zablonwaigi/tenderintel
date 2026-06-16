import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { seedWiki } from "@/lib/wiki/seedWiki";

export const dynamic = "force-dynamic";

/**
 * Seed/refresh the pre-built wiki articles. Protected by CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await seedWiki();
    return NextResponse.json({ status: "completed", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
