import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { t, formatIsk, formatDate } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
import { LinkPaydayInvoiceModal } from "./LinkPaydayInvoiceModal";

type Deal = Database["public"]["Tables"]["deals"]["Row"];

type Props = {
  deal: Deal;
  companyKennitala: string | null;
  currentProfile: { id: string; name: string | null } | null;
  onChanged: () => void;
};

const invoiceColors: Record<
  Database["public"]["Enums"]["invoice_status"],
  string
> = {
  not_invoiced: "bg-gray-100 text-gray-700",
  full: "bg-green-100 text-green-700",
};

const paymentColors: Record<
  Database["public"]["Enums"]["payment_status"],
  string
> = {
  unpaid: "bg-amber-100 text-amber-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return t.payday.timeJustNow;
  if (min < 60) return t.payday.timeMinutesAgo.replace("{n}", String(min));
  const hr = Math.floor(min / 60);
  if (hr < 24) return t.payday.timeHoursAgo.replace("{n}", String(hr));
  const days = Math.floor(hr / 24);
  if (days === 1) return t.payday.timeYesterday;
  return t.payday.timeDaysAgo.replace("{n}", String(days));
}

const rateFmt = new Intl.NumberFormat("is-IS", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const foreignAmountFmt = new Intl.NumberFormat("is-IS", {
  maximumFractionDigits: 0,
});

export function PaydayInvoiceCard({ deal, companyKennitala, currentProfile, onChanged }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // State A — not linked
  if (!deal.payday_invoice_id) {
    return (
      <>
        <div className="rounded-md border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold">
            {t.payday.sectionTitle}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {t.payday.notLinked}
            </div>
            <Button onClick={() => setLinkOpen(true)}>
              {t.payday.linkButton}
            </Button>
          </div>
        </div>
        <LinkPaydayInvoiceModal
          open={linkOpen}
          onOpenChange={setLinkOpen}
          dealId={deal.id}
          companyKennitala={companyKennitala}
          currentProfile={currentProfile}
          onLinked={onChanged}
        />
      </>
    );
  }

  // State B — linked
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "payday-refresh-invoice",
        { body: { deal_id: deal.id } },
      );
      if (error) {
        toast.error(t.payday.modalErrorGeneric);
        return;
      }
      const result = data as {
        cancelled?: boolean;
        error?: string;
        invoice_status?: string;
        payment_status?: string;
      } | null;
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result?.cancelled) {
        toast.warning(t.payday.refreshCancelledNotice);
      } else {
        toast.success(t.payday.refreshSuccess);
      }
      try {
        await supabase.from("audit_log").insert({
          user_id: currentProfile?.id ?? null,
          action: "payday_refresh",
          entity_type: "deal",
          entity_id: deal.id,
          changes: {
            cancelled: result?.cancelled ?? false,
            invoice_status: result?.invoice_status,
            payment_status: result?.payment_status,
          },
        });
      } catch (e) {
        console.error("audit_log insert (payday_refresh) failed", e);
      }
    } catch {
      toast.error(t.payday.modalErrorGeneric);
    } finally {
      setRefreshing(false);
      onChanged();
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      const previousInvoiceNumber = deal.payday_invoice_number;
      const { error } = await supabase
        .from("deals")
        .update({
          payday_invoice_id: null,
          payday_invoice_number: null,
          payday_currency_code: null,
          payday_foreign_amount_excl_vsk: null,
          payday_foreign_amount_incl_vsk: null,
          payday_synced_at: null,
          invoice_status: "not_invoiced",
          payment_status: "unpaid",
          invoice_date: null,
          amount_invoiced_isk: null,
          amount_invoiced_with_vsk_isk: null,
          amount_paid_isk: null,
          paid_at: null,
        })
        .eq("id", deal.id);
      if (error) {
        toast.error(t.status.somethingWentWrong);
        return;
      }
      try {
        await supabase.from("audit_log").insert({
          user_id: currentProfile?.id ?? null,
          action: "payday_unlink",
          entity_type: "deal",
          entity_id: deal.id,
          changes: { previous_invoice_number: previousInvoiceNumber },
        });
      } catch (e) {
        console.error("audit_log insert (payday_unlink) failed", e);
      }
      toast.success(t.payday.unlinkSuccess);
      setUnlinkOpen(false);
      onChanged();
    } finally {
      setUnlinking(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const session = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payday-invoice-pdf`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.data.session?.access_token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ deal_id: deal.id }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody.error ?? t.payday.pdfDownloadError);
        return;
      }
      const blob = await res.blob();
      const filename =
        res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ??
        `Reikningur-${deal.payday_invoice_number ?? "payday"}.pdf`;
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast.success(t.payday.pdfDownloadSuccess);
    } catch (e) {
      console.error(e);
      toast.error(t.payday.pdfDownloadError);
    } finally {
      setDownloading(false);
    }
  };

  const isForeign =
    deal.payday_currency_code && deal.payday_currency_code !== "ISK";
  const amountExcl = Number(deal.amount_invoiced_isk ?? 0);
  const amountIncl = Number(deal.amount_invoiced_with_vsk_isk ?? 0);
  const hasVsk = amountExcl !== amountIncl && amountExcl > 0;
  const foreignIncl = deal.payday_foreign_amount_incl_vsk
    ? Number(deal.payday_foreign_amount_incl_vsk)
    : null;
  const computedRate =
    isForeign && foreignIncl && foreignIncl > 0 && amountIncl > 0
      ? amountIncl / foreignIncl
      : null;

  const amountPaid = Number(deal.amount_paid_isk ?? 0);
  const outstanding = amountIncl - amountPaid;

  return (
    <>
      <div className="rounded-md border border-border bg-card p-4 shadow-sm">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{t.payday.sectionTitle}</div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => void handleDownloadPdf()}
            disabled={downloading}
          >
            <Download className="h-3 w-3" />
            {downloading ? t.payday.pdfDownloading : t.payday.pdfDownload}
          </Button>
        </div>

        {/* Invoice number row */}
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base font-medium">
            {t.payday.cardInvoiceNumber} #{deal.payday_invoice_number}
          </span>
          {deal.invoice_date && (
            <span className="text-xs text-muted-foreground">
              {formatDate(deal.invoice_date)}
            </span>
          )}
        </div>

        {/* Status pills */}
        <div className="mb-3 flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${invoiceColors[deal.invoice_status]}`}
          >
            {t.invoiceStatus[deal.invoice_status]}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${paymentColors[deal.payment_status]}`}
          >
            {t.paymentStatus[deal.payment_status]}
          </span>
        </div>

        {/* Amount block */}
        <div className="mb-3 space-y-0.5 text-sm">
          {isForeign ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">
                  {t.payday.cardAmount}
                </span>
                <span className="font-semibold">{formatIsk(amountIncl)}</span>
              </div>
              <div className="flex items-baseline justify-end gap-1 text-xs text-muted-foreground">
                <span>
                  {deal.payday_currency_code}{" "}
                  {foreignIncl !== null ? foreignAmountFmt.format(foreignIncl) : "—"}
                </span>
                {computedRate && (
                  <span>
                    {t.payday.cardForeignAt} {rateFmt.format(computedRate)}
                  </span>
                )}
              </div>
            </>
          ) : hasVsk ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">
                  {t.payday.cardAmountExVsk}
                </span>
                <span>{formatIsk(amountExcl)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">
                  {t.payday.cardAmountInclVsk}
                </span>
                <span className="font-semibold">{formatIsk(amountIncl)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">
                {t.payday.cardAmount}
              </span>
              <span className="font-semibold">{formatIsk(amountIncl)}</span>
            </div>
          )}
        </div>

        {/* Due date */}
        {deal.payday_due_date && deal.payment_status !== "paid" && (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const due = new Date(deal.payday_due_date);
          const isOverdue = due < today;
          return (
            <div className="mb-3 flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">
                {t.payday.cardDueDate}
              </span>
              <span className={isOverdue ? "font-semibold text-red-600" : ""}>
                {formatDate(deal.payday_due_date)}
                {isOverdue && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {t.payday.cardOverdue}
                  </span>
                )}
              </span>
            </div>
          );
        })()}

        {/* Payment block */}
        {deal.payment_status === "paid" && deal.paid_at && (
          <div className="mb-3 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {t.payday.cardPaidOn}
            </span>
            <span>{formatDate(deal.paid_at)}</span>
          </div>
        )}
        {deal.payment_status === "unpaid" && amountPaid > 0 && (
          <div className="mb-3 space-y-0.5 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">
                {t.payday.cardPaidLabel}
              </span>
              <span>{formatIsk(amountPaid)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">
                {t.payday.cardOutstandingLabel}
              </span>
              <span className="font-semibold">{formatIsk(outstanding)}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {deal.payday_synced_at && (
              <>
                <span>
                  {t.payday.cardLastSynced}: {formatRelative(deal.payday_synced_at)}
                </span>
                {deal.payment_status !== "paid" && (
                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={refreshing}
                    aria-label={t.payday.cardRefresh}
                    title={t.payday.cardRefresh}
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                  </button>
                )}
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUnlinkOpen(true)}
          >
            {t.payday.cardUnlink}
          </Button>
        </div>
      </div>

      <AlertDialog open={unlinkOpen} onOpenChange={setUnlinkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.payday.unlinkConfirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.payday.unlinkConfirmBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinking}>
              {t.actions.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleUnlink();
              }}
              disabled={unlinking}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {t.payday.cardUnlink}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
