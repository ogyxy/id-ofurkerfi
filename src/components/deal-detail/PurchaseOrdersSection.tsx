import { useEffect, useState } from "react";
import { MoreHorizontal, Truck, CheckCircle2, Download, AlertTriangle } from "lucide-react";
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
import { logPoReceived, logPoDeliveredToCustomer, logPoRevertedToOrdered } from "@/lib/poActivityLog";
import {
  InvoiceDrawer,
  ApproveInvoiceDialog,
  MarkPaidDrawer,
  DeletePoDialog,
} from "@/components/deal-detail/PoActionDrawers";
import { CreatePoDrawer } from "@/components/innkaup/CreatePoDrawer";
import { PdfPreviewOverlay } from "@/components/PdfPreviewOverlay";

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
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceEditMode, setInvoiceEditMode] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [editPoOpen, setEditPoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Invoice mismatch warning (shown next to invoice-registered date pill)
  const invoiceAmount = po.supplier_invoice_amount != null
    ? Number(po.supplier_invoice_amount)
    : null;
  const orderedAmount = Number(po.amount ?? 0);
  const invoiceDiff = invoiceAmount != null
    ? +(invoiceAmount - orderedAmount).toFixed(2)
    : 0;
  const invoiceMismatch = invoiceAmount != null && Math.abs(invoiceDiff) > 0.01;

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
    const today = new Date().toISOString().split("T")[0];
    // Direct-to-customer case: if PO is still in ordered state, also mark as
    // received (set received_date + status) before stamping delivered_to_customer_at.
    const wasOrdered = po.status === "ordered";
    const patch: Partial<PORow> = {
      delivered_to_customer_at: new Date().toISOString(),
      delivered_to_customer_by: currentProfileId,
    };
    if (wasOrdered) {
      patch.status = "received";
      patch.received_date = today;
    }
    const { error } = await supabase
      .from("purchase_orders")
      .update(patch)
      .eq("id", po.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      setBusy(false);
      return;
    }
    if (wasOrdered) {
      await logPoReceived({
        dealId,
        poNumber: po.po_number,
        receivedDate: today,
        createdBy: currentProfileId,
      });
    }
    await logPoDeliveredToCustomer({
      dealId,
      poNumber: po.po_number,
      createdBy: currentProfileId,
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
    await logPoRevertedToOrdered({
      dealId,
      poNumber: po.po_number,
      createdBy: currentProfileId,
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

  const actionButton = (label: string, primary: boolean, onClick: () => void) => (
    <Button
      size="sm"
      variant={primary ? "default" : "outline"}
      onClick={onClick}
      className={primary ? "bg-ide-navy text-white hover:bg-ide-navy-hover" : undefined}
    >
      {label}
    </Button>
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
        <>
          <Button
            size="sm"
            disabled={busy}
            onClick={markGoodsArrived}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            <Truck className="mr-1.5 h-3.5 w-3.5" />
            {t.purchaseOrder.actionGoodsArrived}
          </Button>
          {!isDelivered && deliveredButton(false)}
        </>
      );
    }

    // received / invoiced / paid (with various sub-states)
    const buttons: React.ReactNode[] = [];

    if (isReceived && !hasInvoice) {
      buttons.push(
        <span key="reg-inv">
          {actionButton(t.purchaseOrder.actionRegisterInvoice, true, () => {
            setInvoiceEditMode(false);
            setInvoiceOpen(true);
          })}
        </span>,
      );
    } else if (isReceived && hasInvoice && !isInvoiceApproved) {
      buttons.push(
        <span key="approve-inv">
          {actionButton(t.purchaseOrder.actionApproveInvoice, true, () =>
            setApproveOpen(true),
          )}
        </span>,
      );
    } else if (isReceived && isInvoiceApproved && !isPaid) {
      buttons.push(
        <span key="mark-paid">
          {actionButton(t.purchaseOrder.actionMarkPaid, true, () =>
            setPaidOpen(true),
          )}
        </span>,
      );
    }

    // "Sala afhent" — secondary alongside an invoice action,
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
      {/* Top line: PO# · supplier (+ ref subtitle) · Lýsing · status · menu */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-muted-foreground">
          {po.po_number}
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-medium text-foreground">{po.supplier}</span>
          {po.supplier_reference && (
            <span className="text-[10px] text-muted-foreground">
              {t.purchaseOrder.supplier_reference}: {po.supplier_reference}
            </span>
          )}
        </div>
        {po.notes && (
          <span className="text-xs text-foreground/80">{po.notes}</span>
        )}
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
            style.badge,
          )}
        >
          {po.status === "ordered" && hasTracking
            ? t.purchaseOrder.pillOrderedEnRoute
            : t.poStatus[po.status]}
        </span>

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
            onEditPo={() => setEditPoOpen(true)}
            onEditInvoice={() => {
              setInvoiceEditMode(true);
              setInvoiceOpen(true);
            }}
            onDelete={() => setDeleteOpen(true)}
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
            {po.status === "invoiced" && (
              <span className="inline-flex items-center gap-1">
                {datePill(
                  t.purchaseOrder.invoiceRegisteredShort,
                  po.invoice_received_date,
                )}
                {invoiceMismatch && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {t.purchaseOrder.invoiceMismatchTooltip} (
                        {invoiceDiff > 0 ? "+" : ""}
                        {formatNumber(invoiceDiff, 2)} {po.currency})
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
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

      {/* Phase 2 drawers */}
      <InvoiceDrawer
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        po={po}
        dealId={dealId}
        currentProfileId={currentProfileId}
        editMode={invoiceEditMode}
        onSaved={onChanged}
      />
      <ApproveInvoiceDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        po={po}
        dealId={dealId}
        currentProfileId={currentProfileId}
        onSaved={onChanged}
      />
      <MarkPaidDrawer
        open={paidOpen}
        onOpenChange={setPaidOpen}
        po={po}
        dealId={dealId}
        currentProfileId={currentProfileId}
        onSaved={onChanged}
      />
      <EditExchangeDrawer
        open={exchangeOpen}
        onOpenChange={setExchangeOpen}
        po={po}
        dealId={dealId}
        currentProfileId={currentProfileId}
        onSaved={onChanged}
      />
      <EditLinesDrawer
        open={linesOpen}
        onOpenChange={setLinesOpen}
        po={po}
        dealId={dealId}
        currentProfileId={currentProfileId}
        onSaved={onChanged}
      />
      <DeletePoDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        po={po}
        dealId={dealId}
        currentProfileId={currentProfileId}
        onSaved={onChanged}
      />
    </div>
  );
}

interface RowMenuProps {
  isReceived: boolean;
  hasInvoice: boolean;
  poStatus: Database["public"]["Enums"]["po_status"];
  onRevertClick: () => void;
  onEditExchange: () => void;
  onEditLines: () => void;
  onEditInvoice: () => void;
  onDelete: () => void;
}

function RowMenu({
  isReceived,
  hasInvoice,
  poStatus,
  onRevertClick,
  onEditExchange,
  onEditLines,
  onEditInvoice,
  onDelete,
}: RowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onEditExchange}>
          {t.purchaseOrder.rowMenuEditExchange}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEditLines}>
          {t.purchaseOrder.rowMenuEditLines}
        </DropdownMenuItem>
        {hasInvoice && (
          <DropdownMenuItem onClick={onEditInvoice}>
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
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              {t.purchaseOrder.rowMenuDelete}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Per-PO file access. Renders a single download icon for the row's PO files.
 *
 * - 0 files → renders nothing.
 * - 1 file  → icon click opens that file directly in the PDF preview overlay.
 * - 2+ files → icon click opens a small popover picker with one row per file
 *   ("Staðfesting" / "Reikningur frá birgi"); selecting one opens the overlay.
 *
 * The overlay itself contains a "Hlaða niður" button so the file is still
 * one click away when needed.
 */
function FileDownloadButtons({ files }: { files: PoFile[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<PoFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (!files || files.length === 0) return null;

  const labelFor = (f: PoFile): string => {
    if (f.file_type === "order_confirmation")
      return t.purchaseOrder.fileLabelOrderConfirmation;
    if (f.file_type === "invoice") return t.purchaseOrder.fileLabelInvoice;
    return f.original_filename ?? "Skjal";
  };

  const isPdf = (f: PoFile): boolean => {
    const name = (f.original_filename ?? f.storage_path ?? "").toLowerCase();
    return name.endsWith(".pdf");
  };

  const resolveUrl = async (f: PoFile): Promise<string | null> => {
    if (f.storage_path) {
      const { data, error } = await supabase.storage
        .from("po_files")
        .createSignedUrl(f.storage_path, 60);
      if (error || !data?.signedUrl) {
        toast.error(t.status.somethingWentWrong);
        return null;
      }
      return data.signedUrl;
    }
    return f.file_url ?? null;
  };

  const openFile = async (f: PoFile) => {
    setPickerOpen(false);
    const url = await resolveUrl(f);
    if (!url) return;
    if (isPdf(f)) {
      setPreviewFile(f);
      setPreviewUrl(url);
    } else {
      // Non-PDF file: fall back to direct download / open in new tab.
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleIconClick = () => {
    if (files.length === 1) {
      void openFile(files[0]);
    } else {
      setPickerOpen((v) => !v);
    }
  };

  const triggerLabel =
    files.length === 1
      ? `Sækja ${labelFor(files[0])}`
      : t.purchaseOrder.fileMenuPickLabel;

  return (
    <>
      <TooltipProvider>
        <div className="flex items-center gap-1">
          {files.length === 1 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleIconClick}
                  aria-label={triggerLabel}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {labelFor(files[0])}
                {files[0].original_filename && (
                  <span className="ml-1 text-muted-foreground">
                    · {files[0].original_filename}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenu open={pickerOpen} onOpenChange={setPickerOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={triggerLabel}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {files.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    onClick={() => void openFile(f)}
                  >
                    {labelFor(f)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TooltipProvider>

      {previewFile && previewUrl && (
        <PdfPreviewOverlay
          open={true}
          url={previewUrl}
          title={`${labelFor(previewFile)}${previewFile.original_filename ? ` · ${previewFile.original_filename}` : ""}`}
          filename={previewFile.original_filename ?? undefined}
          onClose={() => {
            setPreviewFile(null);
            setPreviewUrl(null);
          }}
        />
      )}
    </>
  );
}

