import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { rememberDealReturnPath } from "@/lib/dealReturn";
import {
  Download,
  Trash2,
  Upload,
  ArrowRightLeft,
} from "lucide-react";
import { FileThumbnail } from "@/components/FileThumbnail";
import { FilePreviewOverlay } from "@/components/FilePreviewOverlay";
import { MultiFileUploadDialog } from "@/components/MultiFileUploadDialog";
import { smartGuessBrandFileType, smartGuessDealFileType } from "@/lib/uploadHelpers";
import {
  processThumbnailInBackground,
  initialThumbStatus,
} from "@/lib/thumbnailPipeline";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ---------- Types ----------

type CompanyFileType =
  | "logo"
  | "brand_guidelines"
  | "font"
  | "color_scheme"
  | "master_artwork"
  | "other";

const COMPANY_FILE_TYPES: CompanyFileType[] = [
  "logo",
  "brand_guidelines",
  "font",
  "color_scheme",
  "master_artwork",
  "other",
];

type DealFileType =
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

interface CompanyFileRow {
  id: string;
  storage_path: string;
  file_type: string;
  original_filename: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
  thumbnail_path: string | null;
  thumbnail_status: string;
  profile?: { id: string; name: string | null } | null;
  signedUrl?: string | null;
  signedUrlDownload?: string | null;
  thumbnailUrl?: string | null;
}

interface DealFileRow extends CompanyFileRow {
  deal_id: string;
}

interface DealLite {
  id: string;
  so_number: string;
  name: string;
}

interface Props {
  companyId: string;
  companyName: string;
  currentProfileId: string | null;
  onCountChanged?: () => void;
}

// ---------- Helpers ----------

function fileTypeLabel(ft: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (t.fileType as Record<string, string>)[ft] ?? t.fileType.other;
}

// ---------- Main component ----------

export function CompanyFilesTab({
  companyId,
  companyName,
  currentProfileId,
  onCountChanged,
}: Props) {
  const [companyFiles, setCompanyFiles] = useState<CompanyFileRow[]>([]);
  const [dealFiles, setDealFiles] = useState<DealFileRow[]>([]);
  const [deals, setDeals] = useState<DealLite[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<CompanyFileRow | null>(null);
  const [activeFilter, setActiveFilter] = useState<DealFileType | null>(null);

  const load = useCallback(async () => {
    // Brand files
    const { data: cFiles } = await supabase
      .from("company_files")
      .select(
        `id, storage_path, file_type, original_filename, file_size_bytes,
         uploaded_at, uploaded_by, thumbnail_path, thumbnail_status,
         profile:profiles!company_files_uploaded_by_fkey(id, name)`,
      )
      .eq("company_id", companyId)
      .order("uploaded_at", { ascending: false });

    // Company deals (for aggregating files + linking)
    const { data: cDeals } = await supabase
      .from("deals")
      .select("id, so_number, name")
      .eq("company_id", companyId)
      .eq("archived", false);

    const dealList = (cDeals ?? []) as DealLite[];
    setDeals(dealList);

    let dFiles: DealFileRow[] = [];
    if (dealList.length > 0) {
      const { data } = await supabase
        .from("deal_files")
        .select(
          `id, deal_id, storage_path, file_type, original_filename, file_size_bytes,
           uploaded_at, uploaded_by, thumbnail_path, thumbnail_status,
           profile:profiles!deal_files_uploaded_by_fkey(id, name)`,
        )
        .in(
          "deal_id",
          dealList.map((d) => d.id),
        )
        .order("uploaded_at", { ascending: false });
      dFiles = (data ?? []) as unknown as DealFileRow[];
    }

    const cRows = (cFiles ?? []) as unknown as CompanyFileRow[];

    const attachUrls = async <T extends CompanyFileRow>(rows: T[]): Promise<T[]> =>
      Promise.all(
        rows.map(async (f) => {
          const [view, dl, thumb] = await Promise.all([
            supabase.storage.from("deal_files").createSignedUrl(f.storage_path, 3600),
            supabase.storage
              .from("deal_files")
              .createSignedUrl(f.storage_path, 3600, {
                download: f.original_filename ?? true,
              }),
            f.thumbnail_status === "done" && f.thumbnail_path
              ? supabase.storage
                  .from("thumbnails")
                  .createSignedUrl(f.thumbnail_path, 3600)
              : Promise.resolve({ data: null }),
          ]);
          return {
            ...f,
            signedUrl: view.data?.signedUrl ?? null,
            signedUrlDownload: dl.data?.signedUrl ?? null,
            thumbnailUrl: thumb.data?.signedUrl ?? null,
          };
        }),
      );

    const [cWithUrls, dWithUrls] = await Promise.all([
      attachUrls(cRows),
      attachUrls(dFiles),
    ]);

    setCompanyFiles(cWithUrls);
    setDealFiles(dWithUrls);
    onCountChanged?.();
  }, [companyId, onCountChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  // ------- Brand file actions -------

  const handleDeleteCompanyFile = async (file: CompanyFileRow) => {
    await supabase.storage.from("deal_files").remove([file.storage_path]);
    await supabase.from("company_files").delete().eq("id", file.id);
    toast.success(t.status.savedSuccessfully);
    await load();
  };

  const handleDeleteDealFile = async (file: DealFileRow) => {
    await supabase.storage.from("deal_files").remove([file.storage_path]);
    await supabase.from("deal_files").delete().eq("id", file.id);
    await supabase.from("activities").insert({
      deal_id: file.deal_id,
      company_id: companyId,
      type: "note",
      body: `Skjali eytt: ${file.original_filename ?? file.storage_path}`,
      created_by: currentProfileId,
    });
    toast.success(t.status.savedSuccessfully);
    await load();
  };

  // ------- Filter pill counts -------

  const dealFileCounts = useMemo(() => {
    const counts: Record<DealFileType, number> = {
      mockup: 0,
      artwork: 0,
      logo: 0,
      presentation: 0,
      quote: 0,
      invoice: 0,
      other: 0,
    };
    dealFiles.forEach((f) => {
      const ft = (DEAL_FILE_TYPES as string[]).includes(f.file_type)
        ? (f.file_type as DealFileType)
        : "other";
      counts[ft] += 1;
    });
    return counts;
  }, [dealFiles]);

  const filteredDealFiles = useMemo(() => {
    if (activeFilter === null) return dealFiles;
    return dealFiles.filter((f) => {
      const ft = (DEAL_FILE_TYPES as string[]).includes(f.file_type)
        ? (f.file_type as DealFileType)
        : "other";
      return ft === activeFilter;
    });
  }, [activeFilter, dealFiles]);

  const dealById = useMemo(() => {
    const m = new Map<string, DealLite>();
    deals.forEach((d) => m.set(d.id, d));
    return m;
  }, [deals]);

  const isLegacy = (p: string) => p.includes("Legacy Import");
  const brandFiles = useMemo(
    () => companyFiles.filter((f) => !isLegacy(f.storage_path)),
    [companyFiles],
  );
  const legacyFiles = useMemo(
    () => companyFiles.filter((f) => isLegacy(f.storage_path)),
    [companyFiles],
  );

  const [moveFile, setMoveFile] = useState<CompanyFileRow | null>(null);

  // ---------- Render ----------

  return (
    <div className="space-y-8">
      {/* ============== Section A — Vörumerki ============== */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t.companyFile.sectionTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.companyFile.sectionHint}
            </p>
          </div>
          <Button
            onClick={() => setUploadOpen(true)}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            <Upload className="mr-1 h-4 w-4" />
            {t.companyFile.upload}
          </Button>
        </div>

        {brandFiles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium text-foreground">
              {t.companyFile.noFiles}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {t.companyFile.emptyHint}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="mr-1 h-4 w-4" />
              {t.companyFile.upload}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {brandFiles.map((f) => (
              <FileCard
                key={f.id}
                file={f}
                typeLabel={fileTypeLabel(f.file_type)}
                onPreview={() => setPreviewFile(f)}
                onDelete={() => void handleDeleteCompanyFile(f)}
              />
            ))}
          </div>
        )}
      </section>

      <hr className="border-border" />

      {/* ============== Section B — Skjöl úr sölum ============== */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t.dealFilesSection.sectionTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.dealFilesSection.sectionHint}
          </p>
        </div>

        {/* Filter pills — single-active behaviour, no "Allar" pill */}
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 sm:flex-nowrap">
          {DEAL_FILE_TYPES.map((ft) => {
            const count = dealFileCounts[ft];
            const isActive = activeFilter === ft;
            // Hide pills with no files unless active; hide non-active pills when one is active
            if (count === 0 && !isActive) return null;
            if (activeFilter !== null && !isActive) return null;
            return (
              <FilterPill
                key={ft}
                label={fileTypeLabel(ft)}
                count={count}
                active={isActive}
                onClick={() => setActiveFilter(isActive ? null : ft)}
              />
            );
          })}
        </div>

        {dealFiles.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium text-foreground">
              {t.dealFile.noFiles}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t.dealFile.emptyHint}</p>
          </div>
        ) : filteredDealFiles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t.dealFile.noFilesForFilter}
            </p>
            <button
              type="button"
              onClick={() => setActiveFilter(null)}
              className="text-sm text-ide-navy hover:underline"
            >
              {t.dealFile.clearFilter}
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredDealFiles.map((f) => {
              const linkedDeal = dealById.get(f.deal_id);
              return (
                <FileCard
                  key={f.id}
                  file={f}
                  typeLabel={fileTypeLabel(f.file_type)}
                  linkedDeal={linkedDeal}
                  onPreview={() => setPreviewFile(f)}
                  onDelete={() => void handleDeleteDealFile(f)}
                />
              );
            })}
          </div>
        )}
      </section>

      {legacyFiles.length > 0 && (
        <>
          <hr className="border-border" />
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{t.legacyImport.sectionTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.legacyImport.sectionHint}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {legacyFiles.map((f) => (
                <FileCard
                  key={f.id}
                  file={f}
                  typeLabel={fileTypeLabel(f.file_type)}
                  onPreview={() => setPreviewFile(f)}
                  onDelete={() => void handleDeleteCompanyFile(f)}
                  extraAction={{
                    icon: <ArrowRightLeft className="h-4 w-4" />,
                    label: t.legacyImport.move,
                    onClick: () => setMoveFile(f),
                  }}
                />
              ))}
            </div>
          </section>
        </>
      )}

      <MoveLegacyDialog
        file={moveFile}
        deals={deals}
        currentProfileId={currentProfileId}
        companyId={companyId}
        onClose={() => setMoveFile(null)}
        onMoved={() => {
          setMoveFile(null);
          void load();
        }}
      />

      <MultiFileUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title={t.upload.titleBrand}
        fileTypes={COMPANY_FILE_TYPES.map((ft) => ({ value: ft, label: fileTypeLabel(ft) }))}
        smartGuess={smartGuessBrandFileType}
        uploadOne={async (file, fileType) => {
          const safe = pathSafe(companyName);
          const ts = Math.floor(Date.now() / 1000);
          const storagePath = `${safe}/Brand/${ts}-${pathSafe(file.name)}`;
          const { error: upErr } = await supabase.storage
            .from("deal_files")
            .upload(storagePath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || "application/octet-stream",
            });
          if (upErr) throw new Error(upErr.message);
          const { data: inserted, error: insErr } = await supabase
            .from("company_files")
            .insert({
              company_id: companyId,
              storage_path: storagePath,
              file_type: fileType,
              original_filename: file.name,
              file_size_bytes: file.size,
              uploaded_by: currentProfileId,
              thumbnail_status: initialThumbStatus(file.name),
            })
            .select("id")
            .single();
          if (insErr) throw new Error(insErr.message);
          if (inserted?.id) {
            processThumbnailInBackground("company_files", inserted.id, file, file.name);
          }
        }}
        onAnySuccess={() => void load()}
      />

      <FilePreviewOverlay
        open={previewFile !== null}
        onOpenChange={(o) => !o && setPreviewFile(null)}
        file={previewFile}
      />
    </div>
  );
}

// ---------- Reusable bits ----------

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-ide-navy bg-ide-navy text-white"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {label} ({count})
    </button>
  );
}

function FileCard({
  file,
  typeLabel,
  linkedDeal,
  onPreview,
  onDelete,
}: {
  file: CompanyFileRow;
  typeLabel: string;
  linkedDeal?: DealLite;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-card transition-colors hover:bg-muted/40">
      <button
        type="button"
        onClick={onPreview}
        className="block w-full text-left"
        title={file.original_filename ?? ""}
        aria-label={`${t.dealFile.title}: ${file.original_filename ?? ""}`}
      >
        <FileThumbnail
          filename={file.original_filename}
          signedUrl={file.signedUrl}
          thumbnailUrl={file.thumbnailUrl}
          thumbnailStatus={file.thumbnail_status}
          className="h-28"
        />
        <div className="space-y-0.5 p-3">
          <div className="truncate text-sm font-medium" title={file.original_filename ?? ""}>
            {file.original_filename ?? "—"}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              {typeLabel}
            </span>
            <span className="text-muted-foreground">
              {formatFileSize(file.file_size_bytes)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {file.profile?.name ?? "—"} · {formatDate(file.uploaded_at)}
          </div>
        </div>
      </button>

      {linkedDeal && (
        <div className="border-t border-border px-3 py-2">
          <Link
            to="/deals/$id"
            params={{ id: linkedDeal.id }}
            onClick={(e) => {
              e.stopPropagation();
              rememberDealReturnPath();
            }}
            className="block text-xs text-ide-navy hover:underline"
          >
            <span className="font-medium">{linkedDeal.so_number}</span>
            <span className="ml-1 text-muted-foreground">— {linkedDeal.name}</span>
          </Link>
        </div>
      )}

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={file.signedUrlDownload ?? "#"}
          download={file.original_filename ?? ""}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md bg-background/90 p-1.5 text-muted-foreground shadow-sm hover:text-foreground"
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

