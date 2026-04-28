import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { t } from "@/lib/sala_translations_is";

/**
 * Download a file via the authenticated Supabase client and open it in a new
 * tab using a blob URL. This avoids CORS issues that occur when browsers
 * block long signed URLs (especially for PDFs).
 */
export async function openStorageFile(
  bucket: string,
  storagePath: string,
): Promise<void> {
  const { data: blob, error } = await supabase.storage
    .from(bucket)
    .download(storagePath);

  if (error || !blob) {
    toast.error(t.status.somethingWentWrong);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Download a file via the authenticated Supabase client and return a blob URL
 * suitable for use as an <img src>. Caller is responsible for revoking it.
 */
export async function fetchStorageBlobUrl(
  bucket: string,
  storagePath: string,
): Promise<string | null> {
  const { data: blob, error } = await supabase.storage
    .from(bucket)
    .download(storagePath);
  if (error || !blob) return null;
  return URL.createObjectURL(blob);
}
