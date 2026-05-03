import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ThumbnailFile = {
  thumbnail_path: string | null;
  thumbnail_status: string;
};

// Module-level cache of signed URLs to avoid re-fetching across renders.
const cache = new Map<string, { url: string; expires: number }>();
const TTL_MS = 50 * 60 * 1000; // refresh slightly before signed URL expiry (3600s)

export function useThumbnailUrl(file: ThumbnailFile): string | null {
  const path = file.thumbnail_status === "done" ? file.thumbnail_path : null;
  const [url, setUrl] = useState<string | null>(() => {
    if (!path) return null;
    const cached = cache.get(path);
    return cached && cached.expires > Date.now() ? cached.url : null;
  });

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const cached = cache.get(path);
    if (cached && cached.expires > Date.now()) {
      setUrl(cached.url);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage
        .from("thumbnails")
        .createSignedUrl(path, 3600);
      if (cancelled) return;
      const signed = data?.signedUrl ?? null;
      if (signed) {
        cache.set(path, { url: signed, expires: Date.now() + TTL_MS });
        setUrl(signed);
      } else {
        setUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}
