import { useEffect, useRef, useState } from "react";
import { Upload, X, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/formatters";
import { t } from "@/lib/sala_translations_is";
import { fileCountDative } from "@/lib/uploadHelpers";

export type UploadFileType = { value: string; label: string };

type UploadResult = {
  successful: number;
  failed: { file: File; error: string }[];
};

type FileEntry = {
  id: string;
  file: File;
  fileType: string;
  status: "pending" | "uploading" | "success" | "failed";
  error?: string;
};

interface MultiFileUploadDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  fileTypes: UploadFileType[];
  smartGuess: (filename: string) => string;
  /** Upload a single file. Should throw on error. */
  uploadOne: (file: File, fileType: string) => Promise<void>;
  /** Called once after a batch finishes, with summary. */
  onBatchComplete?: (result: UploadResult) => void;
  onAnySuccess?: () => void;
}

const CONCURRENCY = 3;

let _uid = 0;
const nextId = () => `f${++_uid}-${Date.now()}`;

export function MultiFileUploadDialog({
  open,
  onClose,
  title,
  fileTypes,
  smartGuess,
  uploadOne,
  onBatchComplete,
  onAnySuccess,
}: MultiFileUploadDialogProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [bulkType, setBulkType] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setEntries([]);
      setBulkType("");
      setUploading(false);
      setProgress({ current: 0, total: 0 });
      setDragOver(false);
    }
  }, [open]);

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const newEntries: FileEntry[] = arr.map((file) => ({
      id: nextId(),
      file,
      fileType: smartGuess(file.name),
      status: "pending",
    }));
    setEntries((prev) => [...prev, ...newEntries]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const setEntryType = (id: string, fileType: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, fileType } : e)));
  };

  const applyBulkType = (val: string) => {
    setEntries((prev) => prev.map((e) => ({ ...e, fileType: val })));
    setBulkType("");
  };

  const clearAll = () => setEntries([]);

  const handleUpload = async () => {
    const toUpload = entries.filter((e) => e.status === "pending" || e.status === "failed");
    if (toUpload.length === 0) return;

    setUploading(true);
    setProgress({ current: 0, total: toUpload.length });

    // Snapshot ids+types so the worker doesn't read stale state
    const queue = toUpload.map((e) => ({ id: e.id, file: e.file, fileType: e.fileType }));
    let index = 0;
    let completed = 0;
    const failed: { file: File; error: string }[] = [];
    let succeeded = 0;

    // Mark all queued as uploading (visual)
    setEntries((prev) =>
      prev.map((e) =>
        queue.some((q) => q.id === e.id) ? { ...e, status: "uploading" as const, error: undefined } : e,
      ),
    );

    const worker = async () => {
      while (index < queue.length) {
        const myIndex = index++;
        const item = queue[myIndex];
        try {
          await uploadOne(item.file, item.fileType);
          succeeded++;
          setEntries((prev) =>
            prev.map((e) => (e.id === item.id ? { ...e, status: "success" } : e)),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          failed.push({ file: item.file, error: msg });
          setEntries((prev) =>
            prev.map((e) =>
              e.id === item.id ? { ...e, status: "failed", error: msg } : e,
            ),
          );
        }
        completed++;
        setProgress({ current: completed, total: queue.length });
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    setUploading(false);

    const result: UploadResult = { successful: succeeded, failed };
    if (succeeded > 0) onAnySuccess?.();
    onBatchComplete?.(result);

    if (failed.length === 0) {
      toast.success(t.upload.uploadComplete.replace("{count}", String(succeeded)));
      onClose();
    } else {
      toast.error(
        t.upload.partialFailure
          .replace("{success}", String(succeeded))
          .replace("{total}", String(queue.length))
          .replace("{failed}", String(failed.length)),
      );
    }
  };

  const pendingOrFailedCount = entries.filter(
    (e) => e.status === "pending" || e.status === "failed",
  ).length;

  const buttonLabel = uploading
    ? t.upload.uploadingProgress
        .replace("{current}", String(progress.current))
        .replace("{total}", String(progress.total))
    : `${t.upload.uploadButton} ${fileCountDative(pendingOrFailedCount)}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !uploading && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Dropzone */}
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex min-h-[80px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-4 text-center text-sm transition-colors",
              dragOver ? "border-ide-navy bg-muted/40" : "border-border",
            )}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div className="text-muted-foreground">
              {entries.length === 0 ? t.upload.dropzone : t.upload.addMore}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
          </label>

          {/* Bulk action row */}
          {entries.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t.upload.setAllAs}</span>
                <Select value={bulkType} onValueChange={applyBulkType}>
                  <SelectTrigger className="h-8 w-[180px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {fileTypes.map((ft) => (
                      <SelectItem key={ft.value} value={ft.value}>
                        {ft.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                onClick={clearAll}
                disabled={uploading}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
              >
                {t.upload.clearAll}
              </button>
            </div>
          )}

          {/* File list */}
          {entries.length > 0 && (
            <div className="max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
              {entries.map((entry) => (
                <FileRow
                  key={entry.id}
                  entry={entry}
                  fileTypes={fileTypes}
                  disabled={uploading}
                  onTypeChange={(v) => setEntryType(entry.id, v)}
                  onRemove={() => removeEntry(entry.id)}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {entries.length > 0
              ? t.upload.fileCount.replace("{count}", String(entries.length))
              : ""}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={uploading}>
              {t.actions.cancel}
            </Button>
            <Button
              onClick={() => void handleUpload()}
              disabled={pendingOrFailedCount === 0 || uploading}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {buttonLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FileRow({
  entry,
  fileTypes,
  disabled,
  onTypeChange,
  onRemove,
}: {
  entry: FileEntry;
  fileTypes: UploadFileType[];
  disabled: boolean;
  onTypeChange: (v: string) => void;
  onRemove: () => void;
}) {
  const ext = (() => {
    const i = entry.file.name.lastIndexOf(".");
    return i >= 0 ? entry.file.name.slice(i + 1).toLowerCase() : "";
  })();

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
        {ext.slice(0, 4) || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium" title={entry.file.name}>
          {entry.file.name}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatFileSize(entry.file.size)}
        </div>
      </div>
      <Select
        value={entry.fileType}
        onValueChange={onTypeChange}
        disabled={disabled || entry.status === "uploading" || entry.status === "success"}
      >
        <SelectTrigger className="h-8 w-[150px] flex-shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fileTypes.map((ft) => (
            <SelectItem key={ft.value} value={ft.value}>
              {ft.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex w-6 flex-shrink-0 items-center justify-center">
        {entry.status === "uploading" && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {entry.status === "success" && <Check className="h-4 w-4 text-green-600" />}
        {entry.status === "failed" && (
          <AlertCircle className="h-4 w-4 text-red-600" aria-label={entry.error ?? ""} />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled || entry.status === "uploading"}
        className="flex-shrink-0 rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
        aria-label={t.upload.removeFile}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
