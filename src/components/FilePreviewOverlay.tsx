import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, X, FileText, FileType as FileTypeIcon, Image as ImageIcon, File as FileIconLucide } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { t } from "@/lib/sala_translations_is";

interface FilePreviewOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    original_filename: string | null;
    signedUrl?: string | null;
    signedUrlDownload?: string | null;
    thumbnailUrl?: string | null;
  } | null;
}

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

function getExt(name: string | null | undefined): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function FilePreviewOverlay({ open, onOpenChange, file }: FilePreviewOverlayProps) {
  if (!file) return null;
  const ext = getExt(file.original_filename);
  const isImage = IMAGE_EXTS.includes(ext);
  const isPdf = ext === "pdf";
  const isAi = ext === "ai";
  const filename = file.original_filename ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/90" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex flex-col outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
          onClick={(e) => {
            // Click on the backdrop area (outside the inner content) closes.
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <DialogTitle className="sr-only">{filename || "File preview"}</DialogTitle>

          {/* Top bar */}
          <div className="relative z-10 flex items-center gap-3 bg-black/60 px-4 py-3 text-white">
            <div className="min-w-0 flex-1 truncate text-sm font-medium" title={filename}>
              {filename || "—"}
            </div>
            {file.signedUrlDownload && (
              <a
                href={file.signedUrlDownload}
                download={filename}
                className="inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
                aria-label={t.filePreview.download}
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">{t.filePreview.download}</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/10"
              aria-label={t.filePreview.close}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div
            className="flex flex-1 items-center justify-center overflow-hidden p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) onOpenChange(false);
            }}
          >
            <PreviewBody
              ext={ext}
              isImage={isImage}
              isPdf={isPdf}
              isAi={isAi}
              filename={filename}
              signedUrl={file.signedUrl ?? null}
              thumbnailUrl={file.thumbnailUrl ?? null}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function PreviewBody({
  ext,
  isImage,
  isPdf,
  isAi,
  filename,
  signedUrl,
  thumbnailUrl,
}: {
  ext: string;
  isImage: boolean;
  isPdf: boolean;
  isAi: boolean;
  filename: string;
  signedUrl: string | null;
  thumbnailUrl: string | null;
}) {
  const [pdfFailed, setPdfFailed] = useState(false);

  if (isImage && signedUrl) {
    return (
      <img
        src={signedUrl}
        alt={filename}
        className="max-h-[85vh] max-w-[95vw] object-contain"
      />
    );
  }

  if (isPdf && signedUrl && !pdfFailed) {
    return (
      <iframe
        src={signedUrl}
        title={filename}
        className="h-[85vh] w-[95vw] rounded-md bg-white"
        onError={() => setPdfFailed(true)}
      />
    );
  }

  if (isPdf && (pdfFailed || !signedUrl)) {
    if (thumbnailUrl) {
      return (
        <div className="flex flex-col items-center gap-3">
          <img
            src={thumbnailUrl}
            alt={filename}
            className="max-h-[80vh] max-w-[95vw] object-contain"
          />
          <p className="text-xs text-white/70">{t.filePreview.previewUnavailable}</p>
        </div>
      );
    }
    return <PlaceholderBody ext={ext} filename={filename} />;
  }

  if (isAi) {
    if (thumbnailUrl) {
      return (
        <div className="relative">
          <img
            src={thumbnailUrl}
            alt={filename}
            className="max-h-[85vh] max-w-[95vw] object-contain"
          />
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white/80">
            {t.filePreview.previewFromPage1}
          </span>
        </div>
      );
    }
    return <PlaceholderBody ext={ext} filename={filename} />;
  }

  return <PlaceholderBody ext={ext} filename={filename} />;
}

function PlaceholderBody({ ext, filename }: { ext: string; filename: string }) {
  let Icon: typeof FileIconLucide = FileIconLucide;
  let color = "text-white/70";
  if (ext === "pdf") {
    Icon = FileText;
    color = "text-red-400";
  } else if (["doc", "docx", "ppt", "pptx", "key", "xls", "xlsx", "csv"].includes(ext)) {
    Icon = FileText;
  } else if (IMAGE_EXTS.includes(ext) || ["ai", "eps"].includes(ext)) {
    Icon = ImageIcon;
    color = "text-yellow-300";
  } else if (["ttf", "otf", "woff", "woff2"].includes(ext)) {
    Icon = FileTypeIcon;
  }
  return (
    <div className="flex flex-col items-center gap-3 text-white">
      <Icon className={cn("h-24 w-24", color)} />
      <div className="max-w-[80vw] truncate text-sm" title={filename}>
        {filename || "—"}
      </div>
      {ext && (
        <span className="rounded bg-white/10 px-2 py-1 text-xs uppercase tracking-wide">
          {ext}
        </span>
      )}
    </div>
  );
}
