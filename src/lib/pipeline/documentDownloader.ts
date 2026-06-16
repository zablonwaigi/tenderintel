import { SupabaseClient } from "@supabase/supabase-js";
import pLimit from "p-limit";
import { createServiceClient, STORAGE_BUCKET } from "@/lib/supabase/server";

const PORTAL_REFERER = "https://www.etenders.gov.za";
const MAX_CONCURRENCY = 10;
const MAX_RETRIES = 3;

export interface DownloadResult {
  downloaded: number;
  failed: number;
  processed: number;
}

interface DocRow {
  id: string;
  tender_id: string;
  file_name: string;
  source_url: string | null;
  tenders?: { status?: string; date_advertised?: string | null } | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

function buildPath(doc: DocRow): string {
  const status = doc.tenders?.status ?? "unknown";
  const adv = doc.tenders?.date_advertised;
  const year = adv ? new Date(adv).getFullYear() : "unknown";
  return `${status}/${year}/${doc.tender_id}/${sanitize(doc.file_name)}`;
}

export class DocumentDownloader {
  private supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase = supabase ?? createServiceClient();
  }

  async ensureBucket(): Promise<void> {
    const { data, error } = await this.supabase.storage.getBucket(STORAGE_BUCKET);
    if (error || !data) {
      // Private bucket — downloads served via signed URLs.
      await this.supabase.storage.createBucket(STORAGE_BUCKET, { public: false });
    }
  }

  private async downloadOne(doc: DocRow): Promise<boolean> {
    if (!doc.source_url) return false;

    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(doc.source_url, {
          headers: {
            Referer: PORTAL_REFERER,
            "User-Agent": "Mozilla/5.0",
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const arrayBuffer = await res.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        if (bytes.byteLength === 0) throw new Error("empty file");

        const path = buildPath(doc);
        const contentType = res.headers.get("content-type") ?? "application/octet-stream";

        const { error: uploadError } = await this.supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, bytes, { contentType, upsert: true });
        if (uploadError) throw uploadError;

        await this.supabase
          .from("tender_documents")
          .update({
            download_status: "downloaded",
            storage_path: path,
            file_size: bytes.byteLength,
            downloaded_at: new Date().toISOString(),
          })
          .eq("id", doc.id);

        return true;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES - 1) await sleep(2000 * (attempt + 1));
      }
    }

    await this.supabase
      .from("tender_documents")
      .update({ download_status: "failed" })
      .eq("id", doc.id);

    console.error(`Download failed for ${doc.file_name} (${doc.id}):`, lastError);
    return false;
  }

  /**
   * Download up to `limit` pending documents with a concurrency cap of 10.
   */
  async downloadPending(limit = 500): Promise<DownloadResult> {
    await this.ensureBucket();

    const { data, error } = await this.supabase
      .from("tender_documents")
      .select("id, tender_id, file_name, source_url, tenders(status, date_advertised)")
      .eq("download_status", "pending")
      .not("source_url", "is", null)
      .limit(limit);

    if (error) throw new Error(`Failed to query pending documents: ${error.message}`);

    const docs = (data ?? []) as unknown as DocRow[];
    const result: DownloadResult = { downloaded: 0, failed: 0, processed: docs.length };

    const limiter = pLimit(MAX_CONCURRENCY);
    const tasks = docs.map((doc) =>
      limiter(async () => {
        const ok = await this.downloadOne(doc);
        if (ok) result.downloaded += 1;
        else result.failed += 1;
      })
    );

    await Promise.all(tasks);
    return result;
  }
}
