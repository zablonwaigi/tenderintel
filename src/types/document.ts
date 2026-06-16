export type DownloadStatus = "pending" | "downloaded" | "failed" | "skipped";
export type ParseStatus = "pending" | "parsed" | "failed";
export type FileType = "pdf" | "docx" | "xlsx" | "zip" | "other";

export interface TenderDocument {
  id: string;
  tender_id: string;
  file_name: string;
  file_size: number | null;
  file_type: FileType | string | null;
  source_url: string | null;
  storage_path: string | null;
  download_status: DownloadStatus;
  parse_status: ParseStatus;
  parsed_text: string | null;
  parsed_at: string | null;
  downloaded_at: string | null;
  created_at: string;
}
