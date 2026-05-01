import { Package, PackageOpen, FileText, CheckCircle2, Check, Plus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";

type DealStage = Database["public"]["Enums"]["deal_stage"];

interface Props {
  stage: DealStage;
  onChange: (next: DealStage) => void;
  onOpenQuoteBuilder?: () => void;
  onOpenCreatePo?: () => void;
  /** Number of purchase orders on the deal (drives order_confirmed UI shape). */
  poCount: number;
  /** Legacy escape hatch: deals created before the PO gate cutoff always show
   *  the goods-arrived / delivered buttons even with zero POs. */
  legacyAllowProgressionWithoutPo?: boolean;
}

/**
 * Action buttons that sit below the deal lines editor and drive the
 * substep / next-step transitions for the 3-step stepper.
 *
 * - quote_in_progress: [Útbúa tilboð] (opens quote builder)
 * - quote_sent       : [Tilboð sent ✓ chip] [Lagfæra tilboð] [Staðfesta pöntun]
 * - order_confirmed  :
 *     • 0 POs (new deals)  → [Bæta við PO]                       (PO gate)
 *     • 0 POs (legacy)     → [Bæta við PO] [Vörur komnar í hús] [Merkja sem afhent]
 *     • ≥1 PO              → [Bæta við PO] [Vörur komnar í hús] [Merkja sem afhent]
 * - ready_for_pickup : [Skila í pöntunarstöðu] [Merkja sem afhent]
 * - inquiry / delivered / defect_reorder / cancelled: nothing
 */
export function StepperActions({
  stage,
  onChange,
  onOpenQuoteBuilder,
  onOpenCreatePo,
  poCount,
  legacyAllowProgressionWithoutPo,
}: Props) {
  if (
    stage === "inquiry" ||
    stage === "delivered" ||
    stage === "defect_reorder" ||
    stage === "cancelled"
  ) {
    return null;
  }

  const navy = "bg-ide-navy text-white hover:bg-ide-navy-hover";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-border bg-muted/30 p-3">
      {stage === "quote_in_progress" && (
        <Button onClick={() => onOpenQuoteBuilder?.()} className={navy}>
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
          <Button onClick={() => onChange("order_confirmed")} className={navy}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {t.deal.confirmOrder}
          </Button>
        </>
      )}

      {stage === "order_confirmed" && (() => {
        const showProgression = poCount > 0 || legacyAllowProgressionWithoutPo;
        const poButtonIsPrimary = poCount === 0 && !legacyAllowProgressionWithoutPo;

        return (
          <>
            <Button
              variant={poButtonIsPrimary ? "default" : "outline"}
              onClick={() => onOpenCreatePo?.()}
              className={poButtonIsPrimary ? navy : undefined}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t.purchaseOrder.createFromDeal}
            </Button>
            {showProgression && (
              <>
                <Button variant="outline" onClick={() => onChange("ready_for_pickup")}>
                  <Package className="mr-1.5 h-4 w-4" />
                  {t.deal.markGoodsArrived}
                </Button>
                <Button onClick={() => onChange("delivered")} className={navy}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  {t.deal.markAsDelivered}
                </Button>
              </>
            )}
          </>
        );
      })()}

      {stage === "ready_for_pickup" && (
        <>
          <Button variant="outline" onClick={() => onChange("order_confirmed")}>
            <PackageOpen className="mr-1.5 h-4 w-4" />
            {t.deal.revertGoodsArrived}
          </Button>
          <Button onClick={() => onChange("delivered")} className={navy}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {t.deal.markAsDelivered}
          </Button>
        </>
      )}
    </div>
  );
}
