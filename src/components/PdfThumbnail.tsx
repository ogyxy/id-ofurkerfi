import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure worker once (module-level, browser-only — file is imported only client-side)
if (typeof window !== "undefined" && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = workerUrl;
}

interface PdfThumbnailProps {
  url: string;
  className?: string;
  onError?: () => void;
}

export function PdfThumbnail({ url, className, onError }: PdfThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let pdfDoc: PDFDocumentProxy | null = null;

    async function render() {
      try {
        const loadingTask = getDocument({ url });
        pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdfDoc.getPage(1);
        if (cancelled || !canvasRef.current) return;

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({ canvas, canvasContext: ctx, viewport });
        await renderTask.promise;

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
          onError?.();
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        /* ignore */
      }
      try {
        void pdfDoc?.destroy();
      } catch {
        /* ignore */
      }
    };
  }, [url, onError]);

  if (failed) return null;

  return (
    <div className={`relative bg-white ${className ?? ""}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30 text-xs text-muted-foreground">
          Hleður...
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="h-full w-full object-cover"
        style={{ display: loading ? "none" : "block" }}
      />
    </div>
  );
}
