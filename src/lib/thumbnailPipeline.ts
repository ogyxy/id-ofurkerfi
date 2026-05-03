// Helper: generate a thumbnail for a freshly uploaded file and update its row.
import { supabase } from "@/integrations/supabase/client";
import { generateThumbnail, isThumbnailSupported } from "@/lib/generateThumbnail";

export type ThumbTable = "deal_files" | "company_files";

/** Run thumbnail generation in the background. Never throws. */
export function processThumbnailInBackground(
  table: ThumbTable,
  recordId: string,
  file: File | Blob,
  filename: string,
): void {
  if (!isThumbnailSupported(filename)) return;
  void (async () => {
    try {
      const blob = await generateThumbnail(file, filename);
      if (!blob) {
        await supabase
          .from(table)
          .update({ thumbnail_status: "unsupported" })
          .eq("id", recordId);
        return;
      }
      const path = `${table}/${recordId}.png`;
      const { error: upErr } = await supabase.storage
        .from("thumbnails")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      await supabase
        .from(table)
        .update({ thumbnail_path: path, thumbnail_status: "done" })
        .eq("id", recordId);
    } catch (err) {
      console.error("[thumbnail]", err);
      await supabase
        .from(table)
        .update({ thumbnail_status: "error" })
        .eq("id", recordId);
    }
  })();
}

export function initialThumbStatus(filename: string): "processing" | "unsupported" {
  return isThumbnailSupported(filename) ? "processing" : "unsupported";
}
