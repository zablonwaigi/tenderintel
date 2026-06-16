import { NextRequest, NextResponse } from "next/server";
import { getTenderWithDocuments } from "@/lib/tenders/detail";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tender = await getTenderWithDocuments(decodeURIComponent(params.id));
    if (!tender) {
      return NextResponse.json({ error: "Tender not found" }, { status: 404 });
    }
    return NextResponse.json(tender);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
