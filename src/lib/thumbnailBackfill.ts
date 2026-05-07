// One-time backfill: render thumbnails for any deal_files / company_files
// rows still in 'pending' status. Safe no-op when there are none.
//
// Processes strictly sequentially with a small delay between files to avoid
// exhausting the browser's connection pool (ERR_INSUFFICIENT_RESOURCES) and
// starving the page's own image/SVG loads.
import { supabase } from "@/integrations/supabase/client";
import { generateThumbnail } from "@/lib/generateThumbnail";

type ThumbTable = "deal_files" | "company_files";

interface PendingRow {
  table: ThumbTable;
  id: string;
  storage_path: string;
  original_filename: string | null;
}

const DELAY_BETWEEN_FILES_MS = 200;
const DOWNLOAD_MAX_RETRIES = 2;
const DOWNLOAD_RETRY_BACKOFF_MS = 1000;

function getExt(name: string | null): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function isMissingFileError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { statusCode?: string | number; status?: number; message?: string; __isStorageError?: boolean };
  if (e.__isStorageError && (String(e.statusCode) === "404" || e.status === 400)) {
    return /not found/i.test(e.message ?? "");
  }
  return /object not found/i.test(e.message ?? "");
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

let isRunning = false;

export async function runThumbnailBackfill(
  isCancelled: () => boolean,
): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  const startedAt = Date.now();
  let succeeded = 0;
  let errored = 0;
  let unsupported = 0;
  let missing = 0;

  try {
    // Include 'error' rows so transient failures get retried on next visit.
    const [deals, companies] = await Promise.all([
      supabase
        .from("deal_files")
        .select("id, storage_path, original_filename")
        .in("thumbnail_status", ["pending", "error"]),
      supabase
        .from("company_files")
        .select("id, storage_path, original_filename")
        .in("thumbnail_status", ["pending", "error"]),
    ]);

    const queue: PendingRow[] = [
      ...((deals.data ?? []) as Omit<PendingRow, "table">[]).map((r) => ({
        ...r,
        table: "deal_files" as const,
      })),
      ...((companies.data ?? []) as Omit<PendingRow, "table">[]).map((r) => ({
        ...r,
        table: "company_files" as const,
      })),
    ];

    if (queue.length === 0) return;

    for (const row of queue) {
      if (isCancelled()) break;
      const result = await processOne(row);
      if (result === "done") succeeded++;
      else if (result === "unsupported") unsupported++;
      else if (result === "missing") missing++;
      else errored++;

      if (isCancelled()) break;
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_FILES_MS));
    }
  } finally {
    isRunning = false;
    const duration = formatDuration(Date.now() - startedAt);
    console.log(
      `[thumbnail-backfill] complete: ${succeeded} done, ${errored} error, ${unsupported} unsupported, ${missing} missing in ${duration}`,
    );
  }
}

type ProcessResult = "done" | "unsupported" | "missing" | "error";

async function downloadWithRetry(path: string): Promise<Blob> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= DOWNLOAD_MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase.storage
        .from("deal_files")
        .download(path);
      if (error) throw error;
      if (!data) throw new Error("download failed: no data");
      return data;
    } catch (err) {
      lastErr = err;
      if (isMissingFileError(err)) throw err; // never retry missing files
      if (attempt < DOWNLOAD_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, DOWNLOAD_RETRY_BACKOFF_MS));
        continue;
      }
    }
  }
  throw lastErr ?? new Error("download failed");
}

async function processOne(row: PendingRow): Promise<ProcessResult> {
  const ext = getExt(row.original_filename);
  if (ext !== "pdf" && ext !== "ai") {
    await supabase
      .from(row.table)
      .update({ thumbnail_status: "unsupported" })
      .eq("id", row.id);
    return "unsupported";
  }
  try {
    const data = await downloadWithRetry(row.storage_path);
    const blob = await generateThumbnail(data, row.original_filename ?? "");
    if (!blob) {
      await supabase
        .from(row.table)
        .update({ thumbnail_status: "unsupported" })
        .eq("id", row.id);
      return "unsupported";
    }
    const path = `${row.table}/${row.id}.png`;
    const { error: upErr } = await supabase.storage
      .from("thumbnails")
      .upload(path, blob, { contentType: "image/png", upsert: true });
    if (upErr) throw upErr;
    await supabase
      .from(row.table)
      .update({ thumbnail_path: path, thumbnail_status: "done" })
      .eq("id", row.id);
    return "done";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isMissingFileError(err)) {
      console.warn(
        `[thumbnail-backfill] missing file table=${row.table} id=${row.id} file="${row.original_filename}" path="${row.storage_path}"`,
      );
      await supabase
        .from(row.table)
        .update({ thumbnail_status: "error" })
        .eq("id", row.id);
      return "missing";
    }
    console.error(
      `[thumbnail-backfill] failed table=${row.table} id=${row.id} file="${row.original_filename}" path="${row.storage_path}":`,
      msg,
      err,
    );
    await supabase
      .from(row.table)
      .update({ thumbnail_status: "error" })
      .eq("id", row.id);
    return "error";
  }
}
