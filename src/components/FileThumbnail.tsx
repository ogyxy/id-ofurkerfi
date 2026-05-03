import {
  File as FileIconLucide,
  FileText,
  Image as ImageIcon,
  FileType as FileTypeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

function getExt(name: string | null | undefined): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export type ThumbnailStatus =
  | "pending"
  | "processing"
  | "done"
  | "unsupported"
  | "error";

interface FileThumbnailProps {
  filename: string | null | undefined;
  signedUrl: string | null | undefined;
  /** Pre-rendered thumbnail URL (typically from useThumbnailUrl or bulk fetch) */
  thumbnailUrl?: string | null;
  thumbnailStatus?: ThumbnailStatus | string | null;
  className?: string;
  alt?: string;
}

/**
 * Unified thumbnail for file cards across the app.
 *  • Images → original signedUrl
 *  • thumbnailUrl present → server-side rendered preview
 *  • status pending/processing → skeleton placeholder
 *  • unsupported/error/none → coloured icon fallback
 */
export function FileThumbnail({
  filename,
  signedUrl,
  thumbnailUrl,
  thumbnailStatus,
  className,
  alt,
}: FileThumbnailProps) {
  const ext = getExt(filename);
  const isImage = IMAGE_EXTS.includes(ext);

  const boxClass = cn(
    "flex h-28 w-full items-center justify-center overflow-hidden bg-muted/30",
    className,
  );

  if (isImage && signedUrl) {
    return (
      <div className={boxClass}>
        <img
          src={signedUrl}
          alt={alt ?? filename ?? ""}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (thumbnailUrl) {
    return (
      <div className={boxClass}>
        <img
          src={thumbnailUrl}
          alt={alt ?? filename ?? ""}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (thumbnailStatus === "pending" || thumbnailStatus === "processing") {
    return (
      <div className={boxClass}>
        <Skeleton className="h-full w-full rounded-none" />
      </div>
    );
  }

  return (
    <div className={boxClass}>
      <GenericFileIcon ext={ext} isImage={isImage} isPdf={ext === "pdf"} />
    </div>
  );
}

function GenericFileIcon({
  ext,
  isImage,
  isPdf,
}: {
  ext: string;
  isImage: boolean;
  isPdf: boolean;
}) {
  let color = "text-muted-foreground";
  let Icon: typeof FileIconLucide = FileIconLucide;

  if (isPdf) {
    color = "text-red-500";
    Icon = FileText;
  } else if (isImage) {
    color = "text-blue-500";
    Icon = ImageIcon;
  } else if (["doc", "docx"].includes(ext)) {
    color = "text-blue-600";
    Icon = FileText;
  } else if (["ppt", "pptx", "key"].includes(ext)) {
    color = "text-orange-500";
    Icon = FileText;
  } else if (["xls", "xlsx", "csv"].includes(ext)) {
    color = "text-green-600";
    Icon = FileText;
  } else if (["ttf", "otf", "woff", "woff2"].includes(ext)) {
    color = "text-purple-500";
    Icon = FileTypeIcon;
  } else if (["ai", "eps"].includes(ext) || ext === "svg") {
    color = "text-yellow-600";
    Icon = ImageIcon;
  } else if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    color = "text-gray-500";
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Icon className={cn("h-10 w-10", color)} />
      {ext && (
        <span className={cn("text-[10px] font-semibold uppercase tracking-wide", color)}>
          {ext}
        </span>
      )}
    </div>
  );
}
