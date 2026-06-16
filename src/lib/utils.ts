import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Parse a money string from the portal/OCDS into integer cents.
 * e.g. "R 1,234.56" -> 123456
 */
export function parseAmountToCents(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!isFinite(value)) return null;
    return Math.round(value * 100);
  }
  const str = String(value).replace(/[^0-9.]/g, "");
  if (!str) return null;
  const num = parseFloat(str);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

/**
 * Format integer cents into a ZAR currency string.
 */
export function formatCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const rands = cents / 100;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(rands);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(size >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Days until a closing date. Negative if already passed.
 */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const diff = d.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function fileTypeFromName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return "pdf";
  if (["docx", "doc"].includes(ext)) return "docx";
  if (["xlsx", "xls"].includes(ext)) return "xlsx";
  if (["zip", "rar", "7z"].includes(ext)) return "zip";
  return "other";
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string | null | undefined, max = 200): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

export const PROVINCES = [
  "National",
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];

export const STATUSES: { value: string; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "awarded", label: "Awarded" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];
