// One-time backfill: render thumbnails for any deal_files / company_files
// rows still in 'pending' status. Safe no-op when there are none.
import { supabase } from "@/integrations/supabase/client";
import { generateThumbnail } from "@/lib/generateThumbnail";

type ThumbTable = "deal_files" | "company_files";

interface PendingRow {
  table: ThumbTable;
  id: string;
  storage_path: string;
  original_filename: string | null;
}

const CONCURRENCY = 2;

function getExt(name: string | null): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

let started = false;

export async function runThumbnailBackfill(
  isCancelled: () => boolean,
): Promise<void> {
  if (started) return;
  started = true;

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

  let cursor = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (!isCancelled()) {
      const idx = cursor++;
      if (idx >= queue.length) return;
      const row = queue[idx];
      await processOne(row);
    }
  });
  await Promise.all(workers);
}

async function processOne(row: PendingRow): Promise<void> {
  const ext = getExt(row.original_filename);
  if (ext !== "pdf" && ext !== "ai") {
    await supabase
      .from(row.table)
      .update({ thumbnail_status: "unsupported" })
      .eq("id", row.id);
    return;
  }
  try {
    const { data, error } = await supabase.storage
      .from("deal_files")
      .download(row.storage_path);
    if (error || !data) throw error ?? new Error("download failed");
    const blob = await generateThumbnail(data, row.original_filename ?? "");
    if (!blob) {
      await supabase
        .from(row.table)
        .update({ thumbnail_status: "unsupported" })
        .eq("id", row.id);
      return;
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[thumbnail-backfill] failed table=${row.table} id=${row.id} file="${row.original_filename}" path="${row.storage_path}":`,
      msg,
      err,
    );
    await supabase
      .from(row.table)
      .update({ thumbnail_status: "error" })
      .eq("id", row.id);
  }
}
