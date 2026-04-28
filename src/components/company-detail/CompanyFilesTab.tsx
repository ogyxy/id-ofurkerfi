import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Download,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { t, formatDate } from "@/lib/sala_translations_is";
import { pathSafe, formatFileSize } from "@/lib/formatters";
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
  profile?: { id: string; name: string | null } | null;
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

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

function fileExt(name: string | null | undefined): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function guessCompanyType(name: string): CompanyFileType {
  const n = name.toLowerCase();
  const ext = fileExt(n);
  if (["svg", "ai", "eps"].includes(ext) || n.includes("logo")) return "logo";
  if (n.includes("guidelines") || n.includes("brand book") || n.includes("vörumerki"))
    return "brand_guidelines";
  if (["ttf", "otf", "woff", "woff2"].includes(ext) || n.includes("font")) return "font";
  if (n.includes("color") || n.includes("litir") || n.includes("palette")) return "color_scheme";
  if (n.includes("master") || n.includes("artwork") || n.includes("vector"))
    return "master_artwork";
  return "other";
}

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
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<DealFileType | "all">("all");

  const load = useCallback(async () => {
    // Brand files
    const { data: cFiles } = await supabase
      .from("company_files")
      .select(
        `id, storage_path, file_type, original_filename, file_size_bytes,
         uploaded_at, uploaded_by,
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
           uploaded_at, uploaded_by,
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
    setCompanyFiles(cRows);
    setDealFiles(dFiles);

    // Generate signed URLs for image previews from both lists
    const allImages = [...cRows, ...dFiles].filter((f) =>
      IMAGE_EXTS.includes(fileExt(f.original_filename)),
    );
    const next: Record<string, string> = {};
    await Promise.all(
      allImages.map(async (f) => {
        const { data: signed } = await supabase.storage
          .from("deal_files")
          .createSignedUrl(f.storage_path, 60 * 60);
        if (signed?.signedUrl) next[f.id] = signed.signedUrl;
      }),
    );
    setThumbs(next);
    onCountChanged?.();
  }, [companyId, onCountChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  // ------- Brand file actions -------

  const handleDownload = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("deal_files")
      .createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

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
    if (activeFilter === "all") return dealFiles;
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

        {companyFiles.length === 0 ? (
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
            {companyFiles.map((f) => (
              <FileCard
                key={f.id}
                file={f}
                thumbUrl={thumbs[f.id]}
                typeLabel={fileTypeLabel(f.file_type)}
                onDownload={() => void handleDownload(f.storage_path)}
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

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 sm:flex-nowrap">
          <FilterPill
            label={t.dealFile.filterAll}
            count={dealFiles.length}
            active={activeFilter === "all"}
            onClick={() => setActiveFilter("all")}
          />
          {DEAL_FILE_TYPES.map((ft) => {
            const count = dealFileCounts[ft];
            const isActive = activeFilter === ft;
            if (count === 0 && !isActive) return null;
            return (
              <FilterPill
                key={ft}
                label={fileTypeLabel(ft)}
                count={count}
                active={isActive}
                onClick={() => setActiveFilter(ft)}
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
              onClick={() => setActiveFilter("all")}
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
                  thumbUrl={thumbs[f.id]}
                  typeLabel={fileTypeLabel(f.file_type)}
                  linkedDeal={linkedDeal}
                  onDownload={() => void handleDownload(f.storage_path)}
                  onDelete={() => void handleDeleteDealFile(f)}
                />
              );
            })}
          </div>
        )}
      </section>

      <UploadCompanyFileDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        companyId={companyId}
        companyName={companyName}
        currentProfileId={currentProfileId}
        onUploaded={() => void load()}
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
  thumbUrl,
  typeLabel,
  linkedDeal,
  onDownload,
  onDelete,
}: {
  file: CompanyFileRow;
  thumbUrl?: string;
  typeLabel: string;
  linkedDeal?: DealLite;
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
            onClick={(e) => e.stopPropagation()}
            className="block text-xs text-ide-navy hover:underline"
          >
            <span className="font-medium">{linkedDeal.so_number}</span>
            <span className="ml-1 text-muted-foreground">— {linkedDeal.name}</span>
          </Link>
        </div>
      )}

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="rounded-md bg-background/90 p-1.5 text-muted-foreground shadow-sm hover:text-foreground"
          aria-label={t.dealFile.download}
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
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

// ---------- Upload dialog (brand asset) ----------

function UploadCompanyFileDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  currentProfileId,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
  companyName: string;
  currentProfileId: string | null;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<CompanyFileType>("other");
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
    if (f) setType(guessCompanyType(f.name));
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const safe = pathSafe(companyName);
    const ts = Math.floor(Date.now() / 1000);
    const storagePath = `${safe}/Brand/${ts}-${file.name}`;

    const { error: upErr } = await supabase.storage
      .from("deal_files")
      .upload(storagePath, file, { cacheControl: "3600", upsert: false });
    if (upErr) {
      toast.error(t.dealFile.uploadFailed);
      setUploading(false);
      return;
    }
    const { error: insErr } = await supabase.from("company_files").insert({
      company_id: companyId,
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
    toast.success(t.status.savedSuccessfully);
    setUploading(false);
    onOpenChange(false);
    onUploaded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.companyFile.upload}</DialogTitle>
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
                {file.name}{" "}
                <span className="text-xs text-muted-foreground">
                  ({formatFileSize(file.size)})
                </span>
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
                onValueChange={(v) => setType(v as CompanyFileType)}
                className="grid grid-cols-2 gap-2"
              >
                {COMPANY_FILE_TYPES.map((ft) => (
                  <label key={ft} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={ft} />
                    {fileTypeLabel(ft)}
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
