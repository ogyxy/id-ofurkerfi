import { Package, PackageOpen, FileText, CheckCircle2, Check } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";

type DealStage = Database["public"]["Enums"]["deal_stage"];

interface Props {
  stage: DealStage;
  onChange: (next: DealStage) => void;
  onOpenQuoteBuilder?: () => void;
  /** When true on order_confirmed, hides the goods-arrived/delivered buttons
   *  because the deal has no purchase orders registered yet (PO gate). */
  hideOrderConfirmedActions?: boolean;
}

/**
 * Action buttons that sit below the deal lines editor and drive the
 * substep / next-step transitions for the 3-step stepper.
 *
 * - quote_in_progress: [Útbúa tilboð] (opens quote builder)
 * - quote_sent       : [Tilboð sent ✓ chip] [Lagfæra tilboð] [Staðfesta pöntun]
 * - order_confirmed  : [Vörur komnar í hús] [Merkja sem afhent]
 * - ready_for_pickup : [Skila í pöntunarstöðu] [Merkja sem afhent]
 * - inquiry / delivered / defect_reorder / cancelled: nothing
 */
export function StepperActions({ stage, onChange, onOpenQuoteBuilder, hideOrderConfirmedActions }: Props) {
  if (
    stage === "inquiry" ||
    stage === "delivered" ||
    stage === "defect_reorder" ||
    stage === "cancelled"
  ) {
    return null;
  }

  // PO gate: on order_confirmed with zero POs (for new deals), hide the
  // goods-arrived / delivered buttons entirely.
  if (stage === "order_confirmed" && hideOrderConfirmedActions) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-border bg-muted/30 p-3">
      {stage === "quote_in_progress" && (
        <Button
          onClick={() => onOpenQuoteBuilder?.()}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          <FileText className="mr-1.5 h-4 w-4" />
          {t.deal.quoteBuilder}
        </Button>
      )}

      {stage === "quote_sent" && (
        <>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
            <Check className="h-3.5 w-3.5" />
            {t.deal.quoteSent}
          </span>
          <Button variant="outline" onClick={() => onChange("quote_in_progress")}>
            <FileText className="mr-1.5 h-4 w-4" />
            {t.deal.quoteRefine}
          </Button>
          <Button
            onClick={() => onChange("order_confirmed")}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {t.deal.confirmOrder}
          </Button>
        </>
      )}

      {stage === "order_confirmed" && (
        <>
          <Button variant="outline" onClick={() => onChange("ready_for_pickup")}>
            <Package className="mr-1.5 h-4 w-4" />
            {t.deal.markGoodsArrived}
          </Button>
          <Button
            onClick={() => onChange("delivered")}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {t.deal.markAsDelivered}
          </Button>
        </>
      )}

      {stage === "ready_for_pickup" && (
        <>
          <Button variant="outline" onClick={() => onChange("order_confirmed")}>
            <PackageOpen className="mr-1.5 h-4 w-4" />
            {t.deal.revertGoodsArrived}
          </Button>
          <Button
            onClick={() => onChange("delivered")}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {t.deal.markAsDelivered}
          </Button>
        </>
      )}
    </div>
  );
}
