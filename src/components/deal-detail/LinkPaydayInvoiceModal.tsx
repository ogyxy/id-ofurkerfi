import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { t, formatIsk, formatDate } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Info } from "lucide-react";

type Invoice = {
  id: string;
  number: number | string;
  status: string;
  invoiceDate?: string | null;
  currencyCode?: string;
  amountExcludingVat?: number | null;
  amountIncludingVat?: number | null;
  foreignAmountExcludingVat?: number | null;
  foreignAmountIncludingVat?: number | null;
  customer?: { id?: string; name?: string; ssn?: string | null } | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  companyKennitala: string | null;
  currentProfile: { id: string; name: string | null } | null;
  onLinked: () => void;
};

function mapErrorMessage(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw === "Invoice not found") return t.payday.modalErrorNotFound;
  const lc = raw.toLowerCase();
  if (lc.includes("cancelled")) return t.payday.modalErrorCancelled;
  if (lc.includes("draft")) return t.payday.modalErrorDraft;
  if (lc.includes("credit")) return t.payday.modalErrorCredit;
  return raw;
}

export function LinkPaydayInvoiceModal({
  open,
  onOpenChange,
  dealId,
  companyKennitala,
  currentProfile,
  onLinked,
}: Props) {
  const [input, setInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!open) {
      setInput("");
      setFetching(false);
      setLinking(false);
      setError(null);
      setPreview(null);
    }
  }, [open]);

  const handleFetch = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setFetching(true);
    setError(null);
    setPreview(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "payday-fetch-invoice",
        { body: { invoice_number: trimmed } },
      );
      if (fnError) {
        setError(t.payday.modalErrorGeneric);
        return;
      }
      const errMsg = (data as { error?: string } | null)?.error;
      if (errMsg) {
        setError(mapErrorMessage(errMsg) ?? t.payday.modalErrorGeneric);
        return;
      }
      const inv = (data as { invoice?: Invoice } | null)?.invoice ?? null;
      if (!inv) {
        setError(t.payday.modalErrorNotFound);
        return;
      }
      setPreview(inv);
    } catch {
      setError(t.payday.modalErrorGeneric);
    } finally {
      setFetching(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setLinking(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "payday-link-invoice",
        { body: { deal_id: dealId, invoice_number: input.trim() } },
      );
      if (fnError) {
        toast.error(t.payday.modalErrorGeneric);
        return;
      }
      const errMsg = (data as { error?: string } | null)?.error;
      if (errMsg) {
        toast.error(mapErrorMessage(errMsg) ?? errMsg);
        return;
      }
      toast.success(t.payday.linkSuccess);
      try {
        await supabase.from("audit_log").insert({
          user_id: currentProfile?.id ?? null,
          action: "payday_link",
          entity_type: "deal",
          entity_id: dealId,
          changes: {
            invoice_number: input.trim(),
            kennitala_mismatch: !!showMismatch,
          },
        });
      } catch (e) {
        console.error("audit_log insert (payday_link) failed", e);
      }
      onOpenChange(false);
      onLinked();
    } catch {
      toast.error(t.payday.modalErrorGeneric);
    } finally {
      setLinking(false);
    }
  };

  const isForeign = preview && preview.currencyCode && preview.currencyCode !== "ISK";
  const customerKt = preview?.customer?.ssn ?? null;
  const showMismatch =
    preview && companyKennitala && customerKt && customerKt !== companyKennitala;
  const showNoKt = preview && companyKennitala && !customerKt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.payday.modalTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="payday-invoice-input">
              {t.payday.modalInputLabel}
            </Label>
            <div className="flex gap-2">
              <Input
                id="payday-invoice-input"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={t.payday.modalInputPlaceholder}
                value={input}
                onChange={(e) =>
                  setInput(e.target.value.replace(/\D/g, ""))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !fetching && input.trim()) {
                    e.preventDefault();
                    void handleFetch();
                  }
                }}
                disabled={fetching || linking}
              />
              <Button
                type="button"
                onClick={() => void handleFetch()}
                disabled={fetching || linking || !input.trim()}
              >
                {fetching ? t.payday.modalFetching : t.payday.modalFetch}
              </Button>
            </div>
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
          </div>

          {preview && (
            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.payday.previewTitle}
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                <span className="text-muted-foreground">
                  {t.payday.previewCustomer}
                </span>
                <span>{preview.customer?.name ?? "—"}</span>

                <span className="text-muted-foreground">
                  {t.payday.previewInvoiceDate}
                </span>
                <span>{formatDate(preview.invoiceDate ?? null) || "—"}</span>

                {preview.amountExcludingVat !==
                preview.amountIncludingVat ? (
                  <>
                    <span className="text-muted-foreground">
                      {t.payday.previewAmountExVsk}
                    </span>
                    <span>{formatIsk(preview.amountExcludingVat ?? 0)}</span>
                    <span className="text-muted-foreground">
                      {t.payday.previewAmountInclVsk}
                    </span>
                    <span className="font-semibold">
                      {formatIsk(preview.amountIncludingVat ?? 0)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      {t.payday.previewAmount}
                    </span>
                    <span className="font-semibold">
                      {formatIsk(preview.amountIncludingVat ?? 0)}
                    </span>
                  </>
                )}

                <span className="text-muted-foreground">
                  {t.payday.previewStatus}
                </span>
                <span>
                  {preview.status === "PAID"
                    ? t.payday.previewStatusPaid
                    : t.payday.previewStatusUnpaid}
                </span>
              </div>

              {isForeign && (
                <div className="text-xs text-muted-foreground">
                  {preview.currencyCode}{" "}
                  {preview.foreignAmountIncludingVat?.toLocaleString("is-IS") ?? "—"}
                </div>
              )}

              {showMismatch && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {t.payday.modalKennitalaMismatch
                      .replace("{invoiceKt}", customerKt ?? "")
                      .replace("{dealKt}", companyKennitala ?? "")}
                  </span>
                </div>
              )}

              {showNoKt && (
                <div className="flex items-start gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{t.payday.modalNoCustomerKt}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={linking}
          >
            {t.payday.modalCancel}
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={!preview || linking}
          >
            {linking ? t.payday.modalLinking : t.payday.modalConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
