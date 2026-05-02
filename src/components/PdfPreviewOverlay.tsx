import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X, ZoomIn, ZoomOut, RotateCcw, Loader2 } from "lucide-react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/sala_translations_is";

if (typeof window !== "undefined" && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = workerUrl;
}

interface Props {
  url: string;
  title: string;
  /** Optional filename used for the download attribute. */
  filename?: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Generic full-screen PDF preview overlay.
 * - Backdrop click + Escape close.
 * - Top bar: title · download · close.
 * - Body: vertically scrollable canvases, one per page, with zoom controls.
 * - Default zoom = fit to width of the viewer column.
 */
export function PdfPreviewOverlay({ url, title, filename, open, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // zoom: null = fit-to-width, number = explicit scale multiplier
  const [zoom, setZoom] = useState<number | null>(null);

  // Reset state when (re)opening with a new url
  useEffect(() => {
    if (!open) return;
    setDoc(null);
    setLoading(true);
    setFailed(false);
    setZoom(null);
  }, [open, url]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Lock background scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Load PDF
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let pdf: PDFDocumentProxy | null = null;
    (async () => {
      try {
        pdf = await getDocument({ url }).promise;
        if (cancelled) {
          void pdf.destroy();
          return;
        }
        setDoc(pdf);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      try {
        void pdf?.destroy();
      } catch {
        /* ignore */
      }
    };
  }, [open, url]);

  const handleDownload = useCallback(() => {
    // Open in new tab — browser handles the download for the signed URL.
    const a = document.createElement("a");
    a.href = url;
    if (filename) a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [url, filename]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center gap-3 border-b border-white/10 bg-black/60 px-4 py-2 text-white"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1 truncate text-sm font-medium" title={title}>
          {title}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setZoom((z) => Math.max(0.4, (z ?? 1) - 0.2))}
            aria-label={t.purchaseOrder.pdfPreviewZoomOut}
            title={t.purchaseOrder.pdfPreviewZoomOut}
            disabled={!doc}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setZoom(null)}
            aria-label={t.purchaseOrder.pdfPreviewZoomReset}
            title={t.purchaseOrder.pdfPreviewZoomReset}
            disabled={!doc}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setZoom((z) => Math.min(4, (z ?? 1) + 0.2))}
            aria-label={t.purchaseOrder.pdfPreviewZoomIn}
            title={t.purchaseOrder.pdfPreviewZoomIn}
            disabled={!doc}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="mx-2 h-6 w-px bg-white/20" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-white hover:bg-white/10 hover:text-white"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
            {t.purchaseOrder.pdfPreviewDownload}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label={t.purchaseOrder.pdfPreviewClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div
        ref={containerRef}
        className="flex flex-1 items-start justify-center overflow-auto p-6"
      >
        <div
          ref={viewerRef}
          className="w-full max-w-[1200px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {loading && (
            <div className="flex h-[60vh] items-center justify-center text-white/80">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          {failed && (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3 rounded-md bg-white/5 p-8 text-white">
              <div className="text-base font-medium">
                {t.purchaseOrder.pdfPreviewLoadError}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                {t.purchaseOrder.pdfPreviewDownload}
              </Button>
            </div>
          )}
          {doc && !failed && (
            <PdfPages
              doc={doc}
              zoom={zoom}
              containerRef={viewerRef}
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

interface PagesProps {
  doc: PDFDocumentProxy;
  zoom: number | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function PdfPages({ doc, zoom, containerRef }: PagesProps) {
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  const pageNumbers = Array.from({ length: doc.numPages }, (_, i) => i + 1);

  return (
    <div className="flex flex-col items-center gap-4">
      {pageNumbers.map((n) => (
        <PdfPage
          key={n}
          doc={doc}
          pageNumber={n}
          zoom={zoom}
          containerWidth={containerWidth}
        />
      ))}
    </div>
  );
}

interface PageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  zoom: number | null;
  containerWidth: number;
}

function PdfPage({ doc, pageNumber, zoom, containerWidth }: PageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!containerWidth) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = containerWidth / baseViewport.width;
        const scale = (zoom ?? fitScale) * (window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
        canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;
        task = page.render({ canvas, canvasContext: ctx, viewport });
        await task.promise;
      } catch {
        /* swallow render-cancel errors */
      }
    })();
    return () => {
      cancelled = true;
      try {
        task?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [doc, pageNumber, zoom, containerWidth]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded bg-white shadow-lg"
    />
  );
}
