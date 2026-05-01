import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FileThumbnail } from "@/components/FileThumbnail";
import { supabase } from "@/integrations/supabase/client";
import { t, formatIsk } from "@/lib/sala_translations_is";
import { formatFileSize } from "@/lib/formatters";
import { generateQuotePdf, type QuoteLine } from "@/lib/generateQuotePdf";
import { mergeQuotePdf, type QuoteAttachment } from "@/lib/mergeQuotePdf";
import { parseSizeBreakdown, type SizeBreakdown } from "@/lib/sizeBreakdown";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];
const ALL_EXTS = ["pdf", ...IMAGE_EXTS];

function extOf(name: string | null | undefined): string {
  if (!name) return "";
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

interface DealLineRow {
  id: string;
  product_name: string;
  description: string | null;
  quantity: number;
  unit_price_isk: number;
  line_total_isk: number;
  line_order: number;
  size_breakdown: SizeBreakdown | null;
}

interface AttachmentRow {
  source: "deal" | "company";
  id: string;
  storage_path: string;
  bucket: "deal_files" | "company_files";
  original_filename: string | null;
  file_size_bytes: number | null;
  ext: string;
  signedUrl: string | null;
}

export interface QuoteBuilderDeal {
  id: string;
  so_number: string;
  name: string;
  stage: string;
  total_price_isk: number;
}

export interface QuoteBuilderCompany {
  id: string;
  name: string;
  kennitala: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  postcode?: string | null;
  city?: string | null;
}

export interface QuoteBuilderContact {
  first_name: string | null;
  last_name: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: QuoteBuilderDeal;
  company: QuoteBuilderCompany;
  contact: QuoteBuilderContact | null;
  currentProfile: { id: string; name: string | null } | null;
  currentUserEmail: string;
  /** Called after successful save so parent can refresh deal + files. */
  onGenerated: (opts: { wasFirstSend: boolean; filename: string }) => void;
}

export function QuoteBuilderModal({
  open,
  onOpenChange,
  deal,
  company,
  contact,
  currentProfile,
  currentUserEmail,
  onGenerated,
}: Props) {
  const defaultValid = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  }, []);

  const [validUntil, setValidUntil] = useState(defaultValid);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DealLineRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValidUntil(defaultValid);
    setNote("");
    setSelected(new Set());
    setLoadingData(true);

    (async () => {
      const [linesRes, dealFilesRes, companyFilesRes] = await Promise.all([
        supabase
          .from("deal_lines")
          .select("id, product_name, description, quantity, unit_price_isk, line_total_isk, line_order, size_breakdown")
          .eq("deal_id", deal.id)
          .order("line_order"),
        supabase
          .from("deal_files")
          .select("id, storage_path, original_filename, file_size_bytes")
          .eq("deal_id", deal.id),
        supabase
          .from("company_files")
          .select("id, storage_path, original_filename, file_size_bytes")
          .eq("company_id", company.id),
      ]);

      setLines(
        (linesRes.data ?? []).map((r) => ({
          ...(r as Omit<DealLineRow, "size_breakdown">),
          size_breakdown: parseSizeBreakdown((r as { size_breakdown?: unknown }).size_breakdown),
        })) as DealLineRow[],
      );

      const buildRow = async (
        row: { id: string; storage_path: string; original_filename: string | null; file_size_bytes: number | null },
        source: "deal" | "company",
        bucket: "deal_files" | "company_files",
      ): Promise<AttachmentRow | null> => {
        const ext = extOf(row.original_filename);
        if (!ALL_EXTS.includes(ext)) return null;
        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrl(row.storage_path, 3600);
        return {
          source,
          id: `${source}:${row.id}`,
          storage_path: row.storage_path,
          bucket,
          original_filename: row.original_filename,
          file_size_bytes: row.file_size_bytes,
          ext,
          signedUrl: signed?.signedUrl ?? null,
        };
      };

      const dealAtt = await Promise.all(
        (dealFilesRes.data ?? []).map((r) => buildRow(r, "deal", "deal_files")),
      );
      const companyAtt = await Promise.all(
        (companyFilesRes.data ?? []).map((r) => buildRow(r, "company", "company_files")),
      );
      setAttachments(
        [...dealAtt, ...companyAtt].filter((x): x is AttachmentRow => x !== null),
      );
      setLoadingData(false);
    })();
  }, [open, deal.id, company.id, defaultValid]);

  const totalExVat = useMemo(
    () => lines.reduce((s, l) => s + Number(l.line_total_isk), 0),
    [lines],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const handleGenerate = async () => {
    if (lines.length === 0) return;
    setGenerating(true);
    try {
      // 1. Determine version by counting files in quote_pdfs/{so_number}/
      const { data: existing } = await supabase.storage
        .from("quote_pdfs")
        .list(deal.so_number, { limit: 1000 });
      const version = (existing?.length ?? 0) + 1;
      const storageFilename = `${deal.so_number}-${version}.pdf`;
      const filePath = `${deal.so_number}/${storageFilename}`;

      // Friendly download filename: "IDÉ Tilboð - {deal.name} {company.name} - {so}-{v}.pdf"
      const dealNamePart = deal.name?.trim() ?? "";
      const companyNamePart = company.name?.trim() ?? "";
      const titleParts = [dealNamePart, companyNamePart].filter(Boolean).join(" ");
      const suffix = `${deal.so_number}-${version}`;
      const filename = titleParts
        ? `IDÉ Tilboð - ${titleParts} - ${suffix}.pdf`
        : `IDÉ Tilboð - ${suffix}.pdf`;

      // 2. Generate base quote
      const quoteLines: QuoteLine[] = lines.map((l) => ({
        product_name: l.product_name,
        description: l.description,
        quantity: l.quantity,
        unit_price_isk: Number(l.unit_price_isk),
        line_total_isk: Number(l.line_total_isk),
        size_breakdown: l.size_breakdown,
      }));

      const baseBuf = await generateQuotePdf({
        quoteNumber: suffix,
        soNumber: deal.so_number,
        dealName: deal.name,
        validUntil: new Date(validUntil),
        note,
        company,
        contact,
        lines: quoteLines,
        totalPriceIsk: totalExVat,
        sender: {
          name: currentProfile?.name ?? null,
          email: currentUserEmail,
        },
      });

      // 3. Fetch + merge attachments
      const chosen = attachments.filter((a) => selected.has(a.id));
      const fetched: QuoteAttachment[] = [];
      const fetchSkipped: string[] = [];
      for (const a of chosen) {
        if (!a.signedUrl) {
          fetchSkipped.push(a.original_filename ?? a.storage_path);
          continue;
        }
        try {
          const res = await fetch(a.signedUrl);
          const buf = await res.arrayBuffer();
          fetched.push({
            filename: a.original_filename ?? a.storage_path,
            bytes: buf,
            ext: a.ext,
          });
        } catch {
          fetchSkipped.push(a.original_filename ?? a.storage_path);
        }
      }

      const { bytes, skipped } = await mergeQuotePdf(baseBuf, fetched);
      const allSkipped = [...fetchSkipped, ...skipped];
      const pdfBlob = new Blob([bytes as BlobPart], { type: "application/pdf" });

      // 4. Upload to storage + insert deal_files row
      let uploadOk = true;
      const { error: upErr } = await supabase.storage
        .from("quote_pdfs")
        .upload(filePath, pdfBlob, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upErr) {
        uploadOk = false;
        console.error("[quote upload]", upErr);
      } else {
        await supabase.from("deal_files").insert({
          deal_id: deal.id,
          storage_path: filePath,
          file_type: "quote",
          original_filename: filename,
          file_size_bytes: bytes.byteLength,
          uploaded_by: currentProfile?.id ?? null,
        });
      }

      // 5. Stage transition / log
      const wasFirstSend = deal.stage === "quote_in_progress";
      if (wasFirstSend) {
        await supabase.from("deals").update({ stage: "quote_sent" }).eq("id", deal.id);
        await supabase.from("activities").insert({
          deal_id: deal.id,
          company_id: company.id,
          type: "stage_change",
          body: "quote_sent",
          created_by: currentProfile?.id ?? null,
        });
      } else {
        await supabase.from("activities").insert({
          deal_id: deal.id,
          company_id: company.id,
          type: "note",
          body: `${t.deal.quoteRegenNote}: ${filename}`,
          created_by: currentProfile?.id ?? null,
        });
      }

      // 6. Trigger browser download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (!uploadOk) {
        toast.error(t.deal.quoteUploadFailed);
      } else {
        toast.success(t.deal.quoteSuccess);
      }
      if (allSkipped.length > 0) {
        toast.warning(`${t.deal.quoteAttachSkipped}: ${allSkipped.join(", ")}`);
      }

      onOpenChange(false);
      onGenerated({ wasFirstSend, filename });
    } catch (err) {
      console.error("[generateQuote]", err);
      toast.error(t.status.somethingWentWrong);
    } finally {
      setGenerating(false);
    }
  };

  const previewVersion = "?"; // version is only known at generation time
  const previewNumber = `${deal.so_number}-${previewVersion}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.deal.quoteBuilderTitle}</DialogTitle>
          <DialogDescription className="sr-only">
            {t.deal.quoteBuilderTitle}
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t.status.loading}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section 1 — Settings */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t.deal.quoteSettingsTitle}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="valid-until">{t.deal.quoteValidUntil}</Label>
                  <Input
                    id="valid-until"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-note">{t.deal.quoteNote}</Label>
                <Textarea
                  id="quote-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.deal.quoteNotePlaceholder}
                  rows={3}
                />
              </div>
            </section>

            {/* Section 2 — Attachments */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t.deal.quoteAttachments}
              </h3>
              {attachments.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  {t.deal.quoteNoAttachments}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {attachments.map((a) => {
                    const checked = selected.has(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex items-center gap-3 rounded-md border p-2 cursor-pointer transition-colors ${
                          checked ? "border-ide-navy bg-muted/40" : "border-border hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(a.id)}
                        />
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded">
                          <FileThumbnail
                            filename={a.original_filename}
                            signedUrl={a.signedUrl}
                            className="h-12"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium" title={a.original_filename ?? ""}>
                            {a.original_filename ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(a.file_size_bytes)}
                            {a.source === "company" ? " · viðskiptavinur" : ""}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Section 3 — Preview */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t.deal.quotePreviewTitle}
              </h3>
              <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-muted-foreground">Tilboð nr.</span>
                  <span className="font-medium">{previewNumber}</span>
                  <span className="text-muted-foreground">{t.deal.quoteCustomer}</span>
                  <span className="font-medium">{company.name}</span>
                  <span className="text-muted-foreground">{t.deal.quoteLineCount}</span>
                  <span className="font-medium">{lines.length}</span>
                  <span className="text-muted-foreground">{t.deal.quoteTotalExVat}</span>
                  <span className="font-medium">{formatIsk(totalExVat)}</span>
                </div>
              </div>
              {lines.length === 0 && (
                <p className="text-sm text-red-600">{t.deal.quoteNoLines}</p>
              )}
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            {t.deal.quoteCancel}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating || loadingData || lines.length === 0}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t.deal.quoteGenerateButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
