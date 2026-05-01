import { useState } from "react";
import { ExternalLink } from "lucide-react";
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

export function PaydayInvoiceCard({ deal, companyKennitala, onChanged }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

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
      const result = data as { cancelled?: boolean; error?: string } | null;
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result?.cancelled) {
        toast.warning(t.payday.refreshCancelledNotice);
      } else {
        toast.success(t.payday.refreshSuccess);
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
      toast.success(t.payday.unlinkSuccess);
      setUnlinkOpen(false);
      onChanged();
    } finally {
      setUnlinking(false);
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
          <a
            href={`https://app.payday.is/invoices/${deal.payday_invoice_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {t.payday.cardOpenInPayday}
            <ExternalLink className="h-3 w-3" />
          </a>
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
          <span className="text-xs text-muted-foreground">
            {deal.payday_synced_at
              ? `${t.payday.cardLastSynced}: ${formatRelative(deal.payday_synced_at)}`
              : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
            >
              {refreshing ? t.payday.cardRefreshing : t.payday.cardRefresh}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUnlinkOpen(true)}
            >
              {t.payday.cardUnlink}
            </Button>
          </div>
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
