import { useCallback, useEffect, useState } from "react";
import { FileText, Image as ImageIcon, File as FileIcon, Download, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { t, formatDate } from "@/lib/sala_translations_is";
import { pathSafe, formatFileSize } from "@/lib/formatters";
import { openStorageFile, fetchStorageBlobUrl } from "@/lib/openStorageFile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type DealFileType =
  | "mockup"
  | "artwork"
  | "logo"
  | "presentation"
  | "quote"
  | "invoice"
  | "other";

const DEAL_FILE_TYPES: DealFileType[] = [
  "mockup",
  "artwork",
  "logo",
  "presentation",
  "quote",
  "invoice",
  "other",
];

interface DealFileRow {
  id: string;
  storage_path: string;
  file_type: string;
  original_filename: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
  profile?: { id: string; name: string | null } | null;
}

interface Props {
  dealId: string;
  companyId: string;
  companyName: string;
  soNumber: string;
  currentProfileId: string | null;
}

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

function fileExt(name: string | null | undefined): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function guessType(name: string): DealFileType {
  const n = name.toLowerCase();
  const ext = fileExt(n);
  if (n.includes("mockup")) return "mockup";
  if (n.includes("artwork") || n.includes("design") || n.includes("hönnun")) return "artwork";
  if (n.includes("logo")) return "logo";
  if (n.includes("presentation") || n.includes("kynning") || ext === "ppt" || ext === "pptx") return "presentation";
  if (n.includes("tilboð") || n.includes("tilbod") || n.includes("quote")) return "quote";
  if (n.includes("reikningur") || n.includes("invoice")) return "invoice";
  return "other";
}

export function DealFilesSection({
  dealId,
  companyId,
  companyName,
  soNumber,
  currentProfileId,
}: Props) {
  const [files, setFiles] = useState<DealFileRow[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("deal_files")
      .select(
        `id, storage_path, file_type, original_filename, file_size_bytes,
         uploaded_at, uploaded_by,
         profile:profiles!deal_files_uploaded_by_fkey(id, name)`,
      )
      .eq("deal_id", dealId)
      .order("uploaded_at", { ascending: false });
    const rows = (data ?? []) as unknown as DealFileRow[];
    setFiles(rows);

    // Fetch image previews as blob URLs (avoids CORS on signed URLs)
    const imagesToFetch = rows.filter((f) => IMAGE_EXTS.includes(fileExt(f.original_filename)));
    const next: Record<string, string> = {};
    await Promise.all(
      imagesToFetch.map(async (f) => {
        const url = await fetchStorageBlobUrl("deal_files", f.storage_path);
        if (url) next[f.id] = url;
      }),
    );
    setThumbs((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      return next;
    });
  }, [dealId]);

  useEffect(() => {
    return () => {
      setThumbs((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return {};
      });
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = async (file: DealFileRow) => {
    await openStorageFile("deal_files", file.storage_path);
  };

  const handleDelete = async (file: DealFileRow) => {
    await supabase.storage.from("deal_files").remove([file.storage_path]);
    await supabase.from("deal_files").delete().eq("id", file.id);
    await supabase.from("activities").insert({
      deal_id: dealId,
      company_id: companyId,
      type: "note",
      body: `Skjali eytt: ${file.original_filename ?? file.storage_path}`,
      created_by: currentProfileId,
    });
    toast.success(t.status.savedSuccessfully);
    await load();
  };

  const grouped = new Map<DealFileType, DealFileRow[]>();
  DEAL_FILE_TYPES.forEach((ft) => grouped.set(ft, []));
  files.forEach((f) => {
    const ft = (DEAL_FILE_TYPES as string[]).includes(f.file_type)
      ? (f.file_type as DealFileType)
      : "other";
    grouped.get(ft)!.push(f);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {t.dealFile.title} ({files.length})
        </h2>
        <Button
          onClick={() => setUploadOpen(true)}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          <Upload className="mr-1 h-4 w-4" />
          {t.dealFile.upload}
        </Button>
      </div>

      {files.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t.dealFile.noFiles}
        </div>
      ) : (
        <div className="space-y-5">
          {DEAL_FILE_TYPES.map((ft) => {
            const arr = grouped.get(ft) ?? [];
            if (arr.length === 0) return null;
            return (
              <div key={ft}>
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  {t.fileType[ft]}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {arr.map((f) => (
                    <FileCard
                      key={f.id}
                      file={f}
                      thumbUrl={thumbs[f.id]}
                      onDownload={() => void handleDownload(f)}
                      onDelete={() => void handleDelete(f)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UploadDealFileDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        dealId={dealId}
        companyId={companyId}
        companyName={companyName}
        soNumber={soNumber}
        currentProfileId={currentProfileId}
        onUploaded={() => void load()}
        guessType={guessType}
      />
    </div>
  );
}

function FileCard({
  file,
  thumbUrl,
  onDownload,
  onDelete,
}: {
  file: DealFileRow;
  thumbUrl?: string;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const ext = fileExt(file.original_filename);
  const isImage = IMAGE_EXTS.includes(ext);
  const isPdf = ext === "pdf";

  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-card transition-colors hover:bg-muted/40">
      <button
        type="button"
        onClick={onDownload}
        className="block w-full text-left"
        title={file.original_filename ?? ""}
      >
        <div className="flex h-28 items-center justify-center bg-muted/30">
          {isImage && thumbUrl ? (
            <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
          ) : isPdf ? (
            <FileText className="h-10 w-10 text-red-500" />
          ) : isImage ? (
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
          ) : (
            <FileIcon className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-0.5 p-3">
          <div className="truncate text-sm font-medium" title={file.original_filename ?? ""}>
            {file.original_filename ?? "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatFileSize(file.file_size_bytes)}
          </div>
          <div className="text-xs text-muted-foreground">
            {file.profile?.name ?? "—"} · {formatDate(file.uploaded_at)}
          </div>
        </div>
      </button>

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onDownload}
          className={cn(
            "rounded-md bg-background/90 p-1.5 text-muted-foreground shadow-sm hover:text-foreground",
          )}
          aria-label={t.dealFile.download}
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="rounded-md bg-background/90 p-1.5 text-muted-foreground shadow-sm hover:text-red-600"
          aria-label={t.dealFile.delete}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.dealFile.confirmDelete}</AlertDialogTitle>
            <AlertDialogDescription>{t.status.cannotBeUndone}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirm(false);
                onDelete();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {t.dealFile.confirmYes}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UploadDealFileDialog({
  open,
  onOpenChange,
  dealId,
  companyId,
  companyName,
  soNumber,
  currentProfileId,
  onUploaded,
  guessType,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dealId: string;
  companyId: string;
  companyName: string;
  soNumber: string;
  currentProfileId: string | null;
  onUploaded: () => void;
  guessType: (name: string) => DealFileType;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DealFileType>("other");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setType("other");
      setUploading(false);
    }
  }, [open]);

  const handleFile = (f: File | null) => {
    setFile(f);
    if (f) setType(guessType(f.name));
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const safe = pathSafe(companyName);
    const ts = Math.floor(Date.now() / 1000);
    const storagePath = `${safe}/${soNumber}/${ts}-${file.name}`;

    const { error: upErr } = await supabase.storage
      .from("deal_files")
      .upload(storagePath, file, { cacheControl: "3600", upsert: false });
    if (upErr) {
      toast.error(t.dealFile.uploadFailed);
      setUploading(false);
      return;
    }
    const { error: insErr } = await supabase.from("deal_files").insert({
      deal_id: dealId,
      storage_path: storagePath,
      file_type: type,
      original_filename: file.name,
      file_size_bytes: file.size,
      uploaded_by: currentProfileId,
    });
    if (insErr) {
      toast.error(t.dealFile.uploadFailed);
      setUploading(false);
      return;
    }
    await supabase.from("activities").insert({
      deal_id: dealId,
      company_id: companyId,
      type: "note",
      body: `Skjali hlaðið upp: ${file.name} (${t.fileType[type]})`,
      created_by: currentProfileId,
    });
    toast.success(t.status.savedSuccessfully);
    setUploading(false);
    onOpenChange(false);
    onUploaded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.dealFile.upload}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0] ?? null;
              handleFile(f);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center text-sm transition-colors",
              dragOver ? "border-ide-navy bg-muted/40" : "border-border",
            )}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <div className="text-muted-foreground">{t.dealFile.dropHere}</div>
            {file && (
              <div className="font-medium text-foreground">
                {file.name} <span className="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
              </div>
            )}
            <Input
              type="file"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {file && (
            <div>
              <Label className="mb-2 block">{t.dealFile.fileType}</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as DealFileType)}
                className="grid grid-cols-2 gap-2"
              >
                {DEAL_FILE_TYPES.map((ft) => (
                  <label key={ft} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={ft} />
                    {t.fileType[ft]}
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.actions.cancel}
          </Button>
          <Button
            onClick={() => void handleUpload()}
            disabled={!file || uploading}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {uploading ? t.dealFile.uploading : t.actions.upload}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
