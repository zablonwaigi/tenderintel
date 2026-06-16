import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, STORAGE_BUCKET } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Issue a short-lived signed URL for a downloaded document and redirect to it.
 * The storage bucket is private, so this is the only way to serve files.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();

  const { data: doc, error } = await supabase
    .from("tender_documents")
    .select("storage_path, download_status, source_url")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (doc.download_status !== "downloaded" || !doc.storage_path) {
    // Not yet mirrored to storage — fall back to the source URL if present.
    if (doc.source_url) return NextResponse.redirect(doc.source_url);
    return NextResponse.json({ error: "Document not available" }, { status: 409 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(doc.storage_path, 60 * 10); // 10 minutes

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
