import { Package, FileText, CheckCircle2, Pencil, Check } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";

type PO = Database["public"]["Tables"]["purchase_orders"]["Row"];

interface Props {
  po: PO;
  onMarkReceived: () => void;
  onOpenInvoiceDrawer: () => void;
  onApproveInvoice: () => void;
  onMarkPaid: () => void;
}

/**
 * Stage-aware action buttons for the PO detail page (mirrors SO StepperActions).
 *
 * - Pantað (no received_date): [Vörur komnar í hús]
 * - Móttekið + no invoice: [Skrá reikning frá birgi]
 * - Móttekið + invoice + not approved: [Breyta reikningi] [Samþykkja reikning]
 * - Móttekið + invoice approved: [Reikningur samþykktur ✓] [Breyta reikningi] [Merkja sem greitt]
 * - Móttekið + no invoice but want to pay (edge): [Skrá reikning] [Merkja sem greitt]
 * - Greitt or Cancelled: nothing
 */
export function POStepperActions({
  po,
  onMarkReceived,
  onOpenInvoiceDrawer,
  onApproveInvoice,
  onMarkPaid,
}: Props) {
  if (po.status === "cancelled" || po.paid_date) return null;

  const navy = "bg-ide-navy text-white hover:bg-ide-navy-hover";

  // Pantað → mark received
  if (!po.received_date) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-border bg-muted/30 p-3">
        <Button onClick={onMarkReceived} className={navy}>
          <Package className="mr-1.5 h-4 w-4" />
          {t.purchaseOrder.actionGoodsArrived}
        </Button>
      </div>
    );
  }

  const hasInvoice = Boolean(po.invoice_received_date);
  const isApproved = Boolean(po.invoice_approved_at);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-border bg-muted/30 p-3">
      {!hasInvoice && (
        <Button onClick={onOpenInvoiceDrawer} className={navy}>
          <FileText className="mr-1.5 h-4 w-4" />
          {t.purchaseOrder.actionRegisterInvoice}
        </Button>
      )}

      {hasInvoice && !isApproved && (
        <>
          <Button variant="outline" onClick={onOpenInvoiceDrawer}>
            <Pencil className="mr-1.5 h-4 w-4" />
            {t.purchaseOrder.actionEditInvoice}
          </Button>
          <Button onClick={onApproveInvoice} className={navy}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {t.purchaseOrder.actionApproveInvoice}
          </Button>
        </>
      )}

      {hasInvoice && isApproved && (
        <>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
            <Check className="h-3.5 w-3.5" />
            {t.purchaseOrder.pillInvoiceApproved}
          </span>
          <Button variant="outline" onClick={onOpenInvoiceDrawer}>
            <Pencil className="mr-1.5 h-4 w-4" />
            {t.purchaseOrder.actionEditInvoice}
          </Button>
          <Button onClick={onMarkPaid} className={navy}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {t.purchaseOrder.actionMarkPaid}
          </Button>
        </>
      )}

      {/* Edge case: edit invoice if not yet entered, also allow direct pay */}
      {!hasInvoice && (
        <Button variant="outline" onClick={onMarkPaid}>
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          {t.purchaseOrder.actionMarkPaid}
        </Button>
      )}
    </div>
  );
}
