import { NextRequest, NextResponse } from "next/server";
import { queryTenders } from "@/lib/tenders/query";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const result = await queryTenders({
      q: sp.get("q") ?? undefined,
      status: sp.get("status") ?? undefined,
      category: sp.get("category") ?? undefined,
      province: sp.get("province") ?? undefined,
      page: sp.get("page") ? parseInt(sp.get("page")!, 10) : undefined,
      limit: sp.get("limit") ? parseInt(sp.get("limit")!, 10) : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
