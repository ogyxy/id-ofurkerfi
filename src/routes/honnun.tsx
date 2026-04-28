import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileText,
  Image as ImageIcon,
  File as FileIconLucide,
  Download,
  Search,
  X,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { supabase } from "@/integrations/supabase/client";
import { t, formatDate } from "@/lib/sala_translations_is";
import { formatFileSize } from "@/lib/formatters";
import { rememberDealReturnPath, rememberCompanyReturnPath } from "@/lib/dealReturn";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/honnun")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${t.hönnunScreen.pageTitle} — ${t.brand.name}` }],
  }),
  component: HonnunPage,
});

// --------- Types ----------

type SourceTag = "deal" | "company";

interface CompanyLite {
  id: string;
  name: string;
}

interface DealLite {
  id: string;
  so_number: string;
  name: string;
  company_id: string;
  archived: boolean;
  company: CompanyLite | null;
}

interface BaseFileRow {
  id: string;
  storage_path: string;
  file_type: string;
  original_filename: string | null;
  file_size_bytes: number | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

interface DealFileRow extends BaseFileRow {
  deal_id: string;
  deal: DealLite | null;
}

interface CompanyFileRow extends BaseFileRow {
  company_id: string;
  company: CompanyLite | null;
}

type MergedFile =
  | (DealFileRow & { source: "deal"; signedUrl: string | null; signedUrlDownload: string | null })
  | (CompanyFileRow & { source: "company"; signedUrl: string | null; signedUrlDownload: string | null });

type TypeFilter = "mockup" | "artwork" | "logo" | "presentation" | "brand";

// --------- Helpers ----------

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

function isImage(name: string | null | undefined): boolean {
  return !!name && IMAGE_RE.test(name);
}

function fileExt(name: string | null | undefined): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toUpperCase() : "";
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(1, Math.round((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s síðan`;
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} mín síðan`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} klst síðan`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days} d síðan`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mán síðan`;
  const years = Math.round(months / 12);
  return `${years} ár síðan`;
}

function typeLabel(file_type: string): string {
  return (t.fileType as Record<string, string>)[file_type] ?? t.fileType.other;
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// --------- Component ----------

function HonnunPage() {
  return (
    <ProtectedRoute>
      {(session) => (
        <div className="min-h-screen bg-background">
          <Sidebar activeKey="designs" userEmail={session.user.email ?? ""} />
          <main className="px-4 pb-8 pt-20 md:ml-60 md:px-8 md:pt-8">
            <HonnunContent />
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}

function HonnunContent() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  const [typeFilter, setTypeFilter] = useState<TypeFilter | null>(null);
  const [companyFilter, setCompanyFilter] = useState<string>("");

  const [companyQuery, setCompanyQuery] = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);

  const [allFiles, setAllFiles] = useState<MergedFile[]>([]);
  const [lineMatchedDealIds, setLineMatchedDealIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Cache so re-running searches doesn't regenerate signed URLs needlessly
  const urlCacheRef = useRef<Map<string, { url: string; download: string }>>(new Map());

  // Load all files once on mount
  const loadAll = useCallback(async () => {
    setLoading(true);

    const dealFilesQuery = supabase
      .from("deal_files")
      .select(
        `id, deal_id, storage_path, file_type, original_filename,
         file_size_bytes, uploaded_at, uploaded_by,
         deal:deals!deal_files_deal_id_fkey(id, so_number, name, company_id, archived,
                    company:companies(id, name))`,
      )
      .in("file_type", ["mockup", "artwork", "logo", "presentation"])
      .order("uploaded_at", { ascending: false });

    const companyFilesQuery = supabase
      .from("company_files")
      .select(
        `id, company_id, storage_path, file_type, original_filename,
         file_size_bytes, uploaded_at, uploaded_by,
         company:companies!company_files_company_id_fkey(id, name)`,
      )
      .order("uploaded_at", { ascending: false });

    const [{ data: dealFiles }, { data: companyFiles }] = await Promise.all([
      dealFilesQuery,
      companyFilesQuery,
    ]);

    const liveDealFiles = ((dealFiles ?? []) as unknown as DealFileRow[]).filter(
      (f) => f.deal && !f.deal.archived,
    );
    const cFiles = (companyFiles ?? []) as unknown as CompanyFileRow[];

    // Generate signed URLs in parallel, with caching
    const cache = urlCacheRef.current;
    const sign = async (storagePath: string, filename: string | null) => {
      const key = `${storagePath}|${filename ?? ""}`;
      const cached = cache.get(key);
      if (cached) return cached;
      const [view, dl] = await Promise.all([
        supabase.storage.from("deal_files").createSignedUrl(storagePath, 3600),
        supabase.storage
          .from("deal_files")
          .createSignedUrl(storagePath, 3600, { download: filename ?? true }),
      ]);
      const value = {
        url: view.data?.signedUrl ?? "",
        download: dl.data?.signedUrl ?? "",
      };
      cache.set(key, value);
      return value;
    };

    const dealMerged: MergedFile[] = await Promise.all(
      liveDealFiles.map(async (f) => {
        const u = await sign(f.storage_path, f.original_filename);
        return {
          ...f,
          source: "deal" as const,
          signedUrl: u.url || null,
          signedUrlDownload: u.download || null,
        };
      }),
    );

    const companyMerged: MergedFile[] = await Promise.all(
      cFiles.map(async (f) => {
        const u = await sign(f.storage_path, f.original_filename);
        return {
          ...f,
          source: "company" as const,
          signedUrl: u.url || null,
          signedUrlDownload: u.download || null,
        };
      }),
    );

    setAllFiles([...dealMerged, ...companyMerged]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // When search term changes, re-query deal_lines for product matches
  useEffect(() => {
    const term = debouncedSearch.trim();
    if (!term) {
      setLineMatchedDealIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const ilikeTerm = `%${term}%`;
      const { data } = await supabase
        .from("deal_lines")
        .select("deal_id")
        .or(`product_name.ilike.${ilikeTerm},product_supplier_sku.ilike.${ilikeTerm}`);
      if (cancelled) return;
      setLineMatchedDealIds(new Set((data ?? []).map((l) => l.deal_id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  // Distinct companies for the company filter
  const companyOptions = useMemo<CompanyLite[]>(() => {
    const m = new Map<string, CompanyLite>();
    allFiles.forEach((f) => {
      const c = f.source === "deal" ? f.deal?.company : f.company;
      if (c) m.set(c.id, c);
    });
    return Array.from(m.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "is"),
    );
  }, [allFiles]);

  const filteredCompanyOptions = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (!q) return companyOptions;
    return companyOptions.filter((c) => c.name.toLowerCase().includes(q));
  }, [companyOptions, companyQuery]);

  const selectedCompany = useMemo(
    () => companyOptions.find((c) => c.id === companyFilter) ?? null,
    [companyOptions, companyFilter],
  );

  // Apply all filters
  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    return allFiles
      .filter((f) => {
        // Type filter
        if (typeFilter !== null) {
          if (typeFilter === "brand") {
            if (f.source !== "company") return false;
          } else {
            if (f.source !== "deal" || f.file_type !== typeFilter) return false;
          }
        }

        // Company filter
        if (companyFilter) {
          const cid = f.source === "deal" ? f.deal?.company_id : f.company_id;
          if (cid !== companyFilter) return false;
        }

        // Search
        if (term) {
          const filename = f.original_filename?.toLowerCase() ?? "";
          if (filename.includes(term)) return true;
          const companyName =
            (f.source === "deal" ? f.deal?.company?.name : f.company?.name) ?? "";
          if (companyName.toLowerCase().includes(term)) return true;
          if (f.source === "deal" && f.deal?.name?.toLowerCase().includes(term))
            return true;
          if (f.source === "deal" && lineMatchedDealIds.has(f.deal_id)) return true;
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
      );
  }, [allFiles, debouncedSearch, typeFilter, companyFilter, lineMatchedDealIds]);

  const hasActiveFilter =
    !!search.trim() || typeFilter !== null || !!companyFilter;

  const clearAll = () => {
    setSearch("");
    setTypeFilter(null);
    setCompanyFilter("");
    setCompanyQuery("");
  };

  const typePills: Array<{ key: TypeFilter; label: string }> = [
    { key: "mockup", label: t.hönnunScreen.typeMockup },
    { key: "artwork", label: t.hönnunScreen.typeArtwork },
    { key: "logo", label: t.hönnunScreen.typeLogo },
    { key: "presentation", label: t.hönnunScreen.typePresentation },
    { key: "brand", label: t.hönnunScreen.typeBrand },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          {t.hönnunScreen.pageTitle}
        </h1>
        <span className="text-sm text-muted-foreground">
          {t.hönnunScreen.resultsCount.replace("{count}", String(filtered.length))}
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.hönnunScreen.searchPlaceholder}
          className="pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={t.actions.reset}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        {/* Type pills */}
        <div className="flex flex-wrap gap-2">
          {typePills.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setTypeFilter(p.key)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                typeFilter === p.key
                  ? "border-ide-navy bg-ide-navy text-white"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Company combobox */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setCompanyOpen((o) => !o)}
            className="flex h-9 w-56 items-center justify-between rounded-md border border-border bg-background px-3 text-sm text-foreground hover:bg-muted/40"
          >
            <span className={cn("truncate", !selectedCompany && "text-muted-foreground")}>
              {selectedCompany ? selectedCompany.name : t.hönnunScreen.allCompanies}
            </span>
            {selectedCompany && (
              <X
                className="ml-2 h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setCompanyFilter("");
                  setCompanyQuery("");
                }}
              />
            )}
          </button>
          {companyOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-popover shadow-md">
              <div className="border-b border-border p-2">
                <Input
                  type="text"
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder={t.actions.search}
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {filteredCompanyOptions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    {t.status.noResults}
                  </div>
                ) : (
                  filteredCompanyOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCompanyFilter(c.id);
                        setCompanyOpen(false);
                        setCompanyQuery("");
                      }}
                      className={cn(
                        "block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-muted",
                        companyFilter === c.id && "bg-muted font-medium",
                      )}
                    >
                      {c.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">{t.hönnunScreen.filterFrom}</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-36 text-sm"
          />
          <label className="text-xs text-muted-foreground">{t.hönnunScreen.filterTo}</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-36 text-sm"
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-sm text-ide-navy hover:underline"
          >
            {t.hönnunScreen.clearFilters}
          </button>
        )}
      </div>

      {/* File grid */}
      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          {t.status.loading}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilter={hasActiveFilter} onClear={clearAll} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((f) => (
            <FileCard key={`${f.source}-${f.id}`} file={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasFilter, onClear }: { hasFilter: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-12 text-center">
      <p className="text-sm font-medium text-foreground">{t.hönnunScreen.noFiles}</p>
      {hasFilter ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 text-sm text-ide-navy hover:underline"
        >
          {t.hönnunScreen.clearFilters}
        </button>
      ) : (
        <p className="max-w-md text-xs text-muted-foreground">{t.hönnunScreen.emptyHint}</p>
      )}
    </div>
  );
}

function FileCard({ file }: { file: MergedFile }) {
  const ext = fileExt(file.original_filename);
  const img = isImage(file.original_filename);
  const isPdf = ext === "PDF";

  const company = file.source === "deal" ? file.deal?.company : file.company;
  const dealLink =
    file.source === "deal" && file.deal
      ? { id: file.deal.id, so: file.deal.so_number, name: file.deal.name }
      : null;

  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-card transition-colors hover:bg-muted/40">
      <a
        href={file.signedUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        title={file.original_filename ?? ""}
      >
        <div className="flex h-32 items-center justify-center bg-muted/30">
          {img && file.signedUrl ? (
            <img
              src={file.signedUrl}
              alt={file.original_filename ?? ""}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : isPdf ? (
            <FileText className="h-12 w-12 text-red-500" />
          ) : img ? (
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <FileIconLucide className="h-10 w-10 text-muted-foreground" />
              {ext && (
                <span className="text-[10px] font-medium uppercase text-muted-foreground">
                  .{ext}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1 p-3">
          <div
            className="truncate text-sm font-medium"
            title={file.original_filename ?? ""}
          >
            {file.original_filename ?? "—"}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              {file.source === "company"
                ? t.hönnunScreen.typeBrand
                : typeLabel(file.file_type)}
            </span>
          </div>
        </div>
      </a>

      {/* Company + source line (outside the anchor so internal links work) */}
      <div className="space-y-1 px-3 pb-3 text-xs">
        {company && (
          <Link
            to="/companies/$id"
            params={{ id: company.id }}
            onClick={() => rememberCompanyReturnPath("/honnun")}
            className="block truncate font-semibold text-foreground hover:underline"
            title={company.name}
          >
            {company.name}
          </Link>
        )}
        {dealLink ? (
          <div className="truncate text-muted-foreground">
            {t.hönnunScreen.sourceDeal}:{" "}
            <Link
              to="/deals/$id"
              params={{ id: dealLink.id }}
              onClick={() => rememberDealReturnPath("/honnun")}
              className="text-ide-navy hover:underline"
              title={`${dealLink.so} — ${dealLink.name}`}
            >
              {dealLink.so} — {dealLink.name}
            </Link>
          </div>
        ) : (
          <div className="text-muted-foreground">{t.hönnunScreen.sourceCompanyBrand}</div>
        )}
        <div className="text-muted-foreground">
          {formatFileSize(file.file_size_bytes)} · {formatDate(file.uploaded_at)} ·{" "}
          {relativeTime(file.uploaded_at)}
        </div>
      </div>

      {/* Download icon (top-right, hover) */}
      {file.signedUrlDownload && (
        <a
          href={file.signedUrlDownload}
          download={file.original_filename ?? ""}
          className="absolute right-2 top-2 rounded-md bg-background/90 p-1.5 text-muted-foreground opacity-0 shadow transition-opacity hover:text-foreground group-hover:opacity-100"
          title={t.actions.download}
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
