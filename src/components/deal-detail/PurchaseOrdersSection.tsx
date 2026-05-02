import { useEffect, useState } from "react";
import { MoreHorizontal, Truck, CheckCircle2, Plus, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { t, formatDate, formatIsk, formatNumber } from "@/lib/sala_translations_is";
import { cn } from "@/lib/utils";
import { PO_STATUS_STYLES } from "@/lib/poConstants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { TrackingCard } from "@/components/tracking/TrackingCard";
import { logPoReceived } from "@/lib/poActivityLog";

type PORow = Database["public"]["Tables"]["purchase_orders"]["Row"];

interface Props {
  dealId: string;
  pos: PORow[];
  /** Logged-in profile id, used for stamping delivered_to_customer_by. */
  currentProfileId: string | null;
  /** Reload deal data after a per-PO write. */
  onChanged: () => void | Promise<void>;
}

/**
 * "Innkaup" card on the deal detail page.
 *
 * Each PO renders as a self-contained tall row:
 *   - top line: PO# · supplier · supplier_reference · status badge · "..." menu
 *   - amount line (ISK + foreign currency)
 *   - date pills (depend on status: Pantað / Áætluð móttaka / Móttekið /
 *     Reikningur skráður / Greitt / Afhent viðskiptavini)
 *   - state-dependent inline actions (Vörur komnar í hús / Skrá reikning /
 *     Samþykkja reikning / Merkja sem greitt / Merkja sem afhent)
 *   - per-row tracking sub-section (replaces the old deal-level Tracking card)
 *
 * The PO detail screen is gone — everything happens inline here.
 */
type PoFile = Database["public"]["Tables"]["po_files"]["Row"];

export function PurchaseOrdersSection({
  dealId,
  pos,
  currentProfileId,
  onChanged,
}: Props) {
  const [filesByPo, setFilesByPo] = useState<Record<string, PoFile[]>>({});

  useEffect(() => {
    const ids = pos.map((p) => p.id);
    if (ids.length === 0) {
      setFilesByPo({});
      return;
    }
    let cancelled = false;
    void supabase
      .from("po_files")
      .select("*")
      .in("po_id", ids)
      .order("uploaded_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const grouped: Record<string, PoFile[]> = {};
        for (const f of data as PoFile[]) {
          (grouped[f.po_id] ??= []).push(f);
        }
        setFilesByPo(grouped);
      });
    return () => {
      cancelled = true;
    };
  }, [pos]);

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold">{t.purchaseOrder.title}</div>
      <div className="space-y-3" id="po-list">
        {pos.map((po) => (
          <PoRow
            key={po.id}
            po={po}
            dealId={dealId}
            currentProfileId={currentProfileId}
            onChanged={onChanged}
            files={filesByPo[po.id] ?? []}
          />
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  po: PORow;
  dealId: string;
  currentProfileId: string | null;
  onChanged: () => void | Promise<void>;
  files: PoFile[];
}

function PoRow({ po, dealId, currentProfileId, onChanged, files }: RowProps) {
  const style = PO_STATUS_STYLES[po.status];
  const total = Number(po.amount ?? 0) + Number(po.shipping_cost ?? 0);
  const totalIsk = po.exchange_rate ? total * Number(po.exchange_rate) : null;

  const isDelivered = !!po.delivered_to_customer_at;
  const isReceived =
    po.status === "received" || po.status === "invoiced" || po.status === "paid";
  const hasInvoice = !!po.supplier_invoice_number;
  const isInvoiceApproved = !!po.invoice_approved_at;
  const isPaid = po.status === "paid";
  const hasTracking = (po.tracking_numbers ?? []).length > 0;
  const isTerminal = po.status === "cancelled" || (isPaid && isDelivered);

  const [revertOpen, setRevertOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // ---------------------------------------------------------------------------
  // Actions wired in Phase 1
  // ---------------------------------------------------------------------------

  const markGoodsArrived = async () => {
    if (busy) return;
    setBusy(true);
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: "received", received_date: today })
      .eq("id", po.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      setBusy(false);
      return;
    }
    await logPoReceived({
      dealId,
      poNumber: po.po_number,
      receivedDate: today,
      createdBy: currentProfileId,
    });
    toast.success(t.status.savedSuccessfully);
    setBusy(false);
    await onChanged();
  };

  const markDeliveredToCustomer = async () => {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("purchase_orders")
      .update({
        delivered_to_customer_at: new Date().toISOString(),
        delivered_to_customer_by: currentProfileId,
      })
      .eq("id", po.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      setBusy(false);
      return;
    }
    // Saga entry — Phase 2 will format with "Innkaup ·" prefix
    await supabase.from("activities").insert({
      deal_id: dealId,
      type: "note",
      body: `${po.po_number}: afhent viðskiptavini`,
      created_by: currentProfileId,
    });
    toast.success(t.status.savedSuccessfully);
    setBusy(false);
    // The DB trigger may auto-advance the deal stage; reload picks it up.
    await onChanged();
  };

  const revertToOrdered = async () => {
    if (busy) return;
    setBusy(true);
    // Revert the PO and clear delivered_to_customer (per "EKKI afhent" body)
    const { error } = await supabase
      .from("purchase_orders")
      .update({
        status: "ordered",
        received_date: null,
        delivered_to_customer_at: null,
        delivered_to_customer_by: null,
      })
      .eq("id", po.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      setBusy(false);
      return;
    }
    await supabase.from("activities").insert({
      deal_id: dealId,
      type: "note",
      body: `${po.po_number}: skilað í pöntunarstöðu`,
      created_by: currentProfileId,
    });
    toast.success(t.status.savedSuccessfully);
    setBusy(false);
    setRevertOpen(false);
    await onChanged();
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const datePill = (
    label: string,
    value: string | null,
    opts?: { subdued?: boolean; emphasized?: boolean },
  ) => {
    if (!value) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-background/60 px-2 py-0.5 text-[11px]",
          opts?.subdued && "text-muted-foreground/70",
          opts?.emphasized && "font-medium text-foreground",
          !opts?.subdued && !opts?.emphasized && "text-muted-foreground",
        )}
      >
        <span className="uppercase tracking-wide opacity-80">{label}:</span>
        <span className="tabular-nums">{formatDate(value)}</span>
      </span>
    );
  };

  // Phase 2 stub — disabled buttons with tooltip
  const phase2Button = (label: string, primary: boolean) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button
              size="sm"
              variant={primary ? "default" : "outline"}
              disabled
              className={
                primary ? "bg-ide-navy text-white hover:bg-ide-navy-hover" : undefined
              }
            >
              {label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{t.purchaseOrder.phase2Tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const deliveredButton = (primary: boolean) => (
    <Button
      size="sm"
      variant={primary ? "default" : "outline"}
      disabled={busy}
      onClick={markDeliveredToCustomer}
      className={primary ? "bg-ide-navy text-white hover:bg-ide-navy-hover" : undefined}
    >
      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
      {t.purchaseOrder.actionMarkDeliveredToCustomer}
    </Button>
  );

  // Decide which action buttons to show
  const renderActions = () => {
    if (po.status === "cancelled") return null;
    if (isDelivered && isPaid) return null;

    if (po.status === "ordered") {
      return (
        <Button
          size="sm"
          disabled={busy}
          onClick={markGoodsArrived}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          <Truck className="mr-1.5 h-3.5 w-3.5" />
          {t.purchaseOrder.actionGoodsArrived}
        </Button>
      );
    }

    // received / invoiced / paid (with various sub-states)
    const buttons: React.ReactNode[] = [];

    if (isReceived && !hasInvoice) {
      buttons.push(
        <span key="reg-inv">
          {phase2Button(t.purchaseOrder.actionRegisterInvoice, true)}
        </span>,
      );
    } else if (isReceived && hasInvoice && !isInvoiceApproved) {
      buttons.push(
        <span key="approve-inv">
          {phase2Button(t.purchaseOrder.actionApproveInvoice, true)}
        </span>,
      );
    } else if (isReceived && isInvoiceApproved && !isPaid) {
      buttons.push(
        <span key="mark-paid">
          {phase2Button(t.purchaseOrder.actionMarkPaid, true)}
        </span>,
      );
    }

    // "Merkja sem afhent" — secondary alongside an invoice action,
    // primary when nothing else is happening (paid + not afhent).
    if (!isDelivered) {
      const primary = isPaid; // only primary when no invoice button is showing
      buttons.push(<span key="afhent">{deliveredButton(primary)}</span>);
    }

    return buttons.length > 0 ? <>{buttons}</> : null;
  };

  return (
    <div
      id={`po-${po.id}`}
      className={cn(
        "rounded-md border border-border p-3 text-sm transition-colors",
        style.muted && "text-muted-foreground",
        isTerminal && "opacity-70",
      )}
      style={{
        borderLeft: `4px solid ${style.border}`,
        backgroundColor: style.bg,
      }}
    >
      {/* Top line: PO# · supplier · ref · badges · menu */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-muted-foreground">
          {po.po_number}
        </span>
        <span className="font-medium text-foreground">{po.supplier}</span>
        {po.supplier_reference && (
          <span className="text-xs text-muted-foreground">
            {po.supplier_reference}
          </span>
        )}
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
            style.badge,
          )}
        >
          {t.poStatus[po.status]}
        </span>
        {hasTracking && !isDelivered && (
          <span className="inline-flex items-center rounded-md border border-sky-300 bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
            {t.purchaseOrder.pillEnRoute}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-medium text-foreground tabular-nums">
              {totalIsk !== null ? formatIsk(totalIsk) : "—"}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {po.currency} {formatNumber(total, 2)}
            </div>
          </div>
          <FileDownloadButtons files={files} />
          <RowMenu
            isReceived={isReceived}
            hasInvoice={hasInvoice}
            poStatus={po.status}
            onRevertClick={() => setRevertOpen(true)}
          />
        </div>
      </div>

      {/* Date pills */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {po.status === "ordered" && (
          <>
            {datePill(t.purchaseOrder.orderedShort, po.order_date)}
            {datePill(
              t.purchaseOrder.estimatedDeliveryShort,
              po.expected_delivery_date,
            )}
          </>
        )}
        {(po.status === "received" || po.status === "invoiced") && (
          <>
            {datePill(t.purchaseOrder.orderedShort, po.order_date, {
              subdued: true,
            })}
            {datePill(t.purchaseOrder.received_date, po.received_date, {
              emphasized: true,
            })}
            {datePill(
              t.purchaseOrder.estimatedDeliveryShort,
              po.expected_delivery_date,
              { subdued: true },
            )}
            {po.status === "invoiced" &&
              datePill(
                t.purchaseOrder.invoiceRegisteredShort,
                po.invoice_received_date,
              )}
          </>
        )}
        {po.status === "paid" && (
          <>
            {datePill(t.purchaseOrder.received_date, po.received_date, {
              subdued: true,
            })}
            {datePill(t.purchaseOrder.paidShort, po.paid_date, {
              emphasized: true,
            })}
          </>
        )}
        {isDelivered && (
          <span className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-900">
            <CheckCircle2 className="h-3 w-3" />
            {t.purchaseOrder.deliveredToCustomerOn}:{" "}
            <span className="tabular-nums">
              {formatDate(po.delivered_to_customer_at)}
            </span>
          </span>
        )}
      </div>

      {/* Per-row tracking — single tracking number per PO; the "+ Bæta við" placeholder
          replaces the section title to save vertical space. */}
      <div className="mt-2">
        <TrackingCard
          mode="po"
          poId={po.id}
          dealId={dealId}
          initial={po.tracking_numbers ?? []}
          bare
          inlineHeader
        />
      </div>

      {/* Action buttons */}
      {renderActions() && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-3">
          {renderActions()}
        </div>
      )}

      {/* Revert confirmation */}
      <AlertDialog open={revertOpen} onOpenChange={setRevertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.purchaseOrder.revertConfirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.purchaseOrder.revertConfirmBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={revertToOrdered}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {t.purchaseOrder.revertConfirmYes}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface RowMenuProps {
  isReceived: boolean;
  hasInvoice: boolean;
  poStatus: Database["public"]["Enums"]["po_status"];
  onRevertClick: () => void;
}

function RowMenu({ isReceived, hasInvoice, poStatus, onRevertClick }: RowMenuProps) {
  // Phase 2 will wire the editor drawers; for now they are visible but no-op.
  const stub = () => {
    toast.info(t.purchaseOrder.phase2Tooltip);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={stub}>
          {t.purchaseOrder.rowMenuEditExchange}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={stub}>
          {t.purchaseOrder.rowMenuEditLines}
        </DropdownMenuItem>
        {hasInvoice && (
          <DropdownMenuItem onClick={stub}>
            {t.purchaseOrder.rowMenuEditInvoice}
          </DropdownMenuItem>
        )}
        {isReceived && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRevertClick}>
              {t.purchaseOrder.rowMenuRevertToOrdered}
            </DropdownMenuItem>
          </>
        )}
        {poStatus === "ordered" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={stub} className="text-red-600">
              {t.purchaseOrder.rowMenuDelete}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Per-PO download buttons. Renders one icon button per uploaded file
 * (e.g. order confirmation uploaded at PO creation, supplier invoice in Phase 2).
 * Files are stored in the private "po_files" bucket — we generate a short-lived
 * signed URL and trigger a download in a new tab.
 */
function FileDownloadButtons({ files }: { files: PoFile[] }) {
  if (!files || files.length === 0) return null;

  const labelFor = (f: PoFile): string => {
    if (f.file_type === "order_confirmation") return "Pöntunarstaðfesting";
    if (f.file_type === "invoice") return "Reikningur";
    return f.original_filename ?? "Skjal";
  };

  const handleDownload = async (f: PoFile) => {
    if (!f.storage_path) {
      if (f.file_url) window.open(f.file_url, "_blank", "noopener,noreferrer");
      return;
    }
    const { data, error } = await supabase.storage
      .from("po_files")
      .createSignedUrl(f.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {files.map((f) => (
          <Tooltip key={f.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void handleDownload(f)}
                aria-label={`Sækja ${labelFor(f)}`}
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {labelFor(f)}
              {f.original_filename && (
                <span className="ml-1 text-muted-foreground">
                  · {f.original_filename}
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
