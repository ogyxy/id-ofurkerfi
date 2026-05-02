import { FileText, CheckCircle2, Check, Plus } from "lucide-react";
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
  /**
   * Number of POs not yet marked afhent to customer (delivered_to_customer_at IS NULL),
   * excluding cancelled. Drives whether the bulk "Merkja sem afhent" button shows.
   */
  undeliveredPoCount: number;
  /** Triggered when the user clicks the bulk "Merkja allar sem afhent" button. */
  onBulkMarkDelivered?: () => void;
  /** Legacy escape hatch for very old deals with zero POs. */
  legacyAllowProgressionWithoutPo?: boolean;
}

/**
 * Action buttons that sit below the deal lines editor.
 *
 * After the PO-workflow consolidation:
 *   - "Vörur komnar í hús" is now strictly a per-PO action — it does NOT
 *     appear at the deal level anymore.
 *   - "Merkja sem afhent" appears at the deal level ONLY as a bulk shortcut
 *     when the deal has 2+ POs and at least one is still not afhent.
 *     Single-PO deals use the per-row button instead.
 *
 * Stage map:
 *   quote_in_progress: [Útbúa tilboð]
 *   quote_sent       : [Tilboð sent ✓ chip] [Lagfæra tilboð] [Staðfesta pöntun]
 *   order_confirmed  :
 *       0 POs  → [Bæta við PO] (primary, gate)
 *       1 PO   → [Bæta við PO]
 *       2+ POs with at least one undelivered → [Bæta við PO] [Merkja allar sem afhent]
 *   ready_for_pickup : [Skila í pöntunarstöðu] (no deal-level afhent here either)
 */
export function StepperActions({
  stage,
  onChange,
  onOpenQuoteBuilder,
  onOpenCreatePo,
  poCount,
  undeliveredPoCount,
  onBulkMarkDelivered,
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
        const poButtonIsPrimary = poCount === 0 && !legacyAllowProgressionWithoutPo;
        const showBulkDelivered = poCount >= 2 && undeliveredPoCount > 0;
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
            {showBulkDelivered && (
              <Button onClick={() => onBulkMarkDelivered?.()} className={navy}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {t.purchaseOrder.actionMarkAllDeliveredToCustomer}
              </Button>
            )}
          </>
        );
      })()}

      {stage === "ready_for_pickup" && (() => {
        const showBulkDelivered = poCount >= 2 && undeliveredPoCount > 0;
        return (
          <>
            <Button variant="outline" onClick={() => onChange("order_confirmed")}>
              {t.deal.revertGoodsArrived}
            </Button>
            {showBulkDelivered && (
              <Button onClick={() => onBulkMarkDelivered?.()} className={navy}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {t.purchaseOrder.actionMarkAllDeliveredToCustomer}
              </Button>
            )}
          </>
        );
      })()}
    </div>
  );
}
