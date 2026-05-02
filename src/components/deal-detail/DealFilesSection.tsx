import { useCallback, useEffect, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { FileThumbnail } from "@/components/FileThumbnail";
import { MultiFileUploadDialog } from "@/components/MultiFileUploadDialog";
import { smartGuessDealFileType } from "@/lib/uploadHelpers";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { t, formatDate } from "@/lib/sala_translations_is";
import { pathSafe, formatFileSize } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
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
  signedUrl?: string | null;
  signedUrlDownload?: string | null;
}

interface Props {
  dealId: string;
  companyId: string;
  companyName: string;
  soNumber: string;
  currentProfileId: string | null;
}


export function DealFilesSection({
  dealId,
  companyId,
  companyName,
  soNumber,
  currentProfileId,
}: Props) {
  const [files, setFiles] = useState<DealFileRow[]>([]);
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

    const withUrls = await Promise.all(
      rows.map(async (f) => {
        const [view, dl] = await Promise.all([
          supabase.storage.from("deal_files").createSignedUrl(f.storage_path, 3600),
          supabase.storage
            .from("deal_files")
            .createSignedUrl(f.storage_path, 3600, {
              download: f.original_filename ?? true,
            }),
        ]);
        return {
          ...f,
          signedUrl: view.data?.signedUrl ?? null,
          signedUrlDownload: dl.data?.signedUrl ?? null,
        };
      }),
    );
    setFiles(withUrls);
  }, [dealId]);

  useEffect(() => {
    void load();
  }, [load]);

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
                      onDelete={() => void handleDelete(f)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MultiFileUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title={t.upload.title}
        fileTypes={DEAL_FILE_TYPES.map((ft) => ({ value: ft, label: t.fileType[ft] }))}
        smartGuess={smartGuessDealFileType}
        defaultFileType="mockup"
        uploadOne={async (file, fileType) => {
          const safe = pathSafe(companyName);
          const ts = Math.floor(Date.now() / 1000);
          const storagePath = `${safe}/${pathSafe(soNumber)}/${ts}-${pathSafe(file.name)}`;
          const { error: upErr } = await supabase.storage
            .from("deal_files")
            .upload(storagePath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || "application/octet-stream",
            });
          if (upErr) throw new Error(upErr.message);
          const { error: insErr } = await supabase.from("deal_files").insert({
            deal_id: dealId,
            storage_path: storagePath,
            file_type: fileType,
            original_filename: file.name,
            file_size_bytes: file.size,
            uploaded_by: currentProfileId,
          });
          if (insErr) throw new Error(insErr.message);
        }}
        onAnySuccess={() => void load()}
        onBatchComplete={async (result) => {
          if (result.successful > 0) {
            const body =
              result.successful === 1
                ? `Skjali hlaðið upp`
                : `${result.successful} skjölum hlaðið upp`;
            await supabase.from("activities").insert({
              deal_id: dealId,
              company_id: companyId,
              type: "note",
              body,
              created_by: currentProfileId,
            });
          }
        }}
      />
    </div>
  );
}

function FileCard({
  file,
  onDelete,
}: {
  file: DealFileRow;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-card transition-colors hover:bg-muted/40">
      <a
        href={file.signedUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-left"
        title={file.original_filename ?? ""}
      >
        <FileThumbnail
          filename={file.original_filename}
          signedUrl={file.signedUrl}
          className="h-28"
        />
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
      </a>

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={file.signedUrlDownload ?? "#"}
          download={file.original_filename ?? ""}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "rounded-md bg-background/90 p-1.5 text-muted-foreground shadow-sm hover:text-foreground",
          )}
          aria-label={t.dealFile.download}
        >
          <Download className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setConfirm(true);
          }}
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

