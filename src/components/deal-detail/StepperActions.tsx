import { useState } from "react";
import { Send, Package, PackageOpen, Pencil, CheckCircle2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
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

type DealStage = Database["public"]["Enums"]["deal_stage"];

interface Props {
  stage: DealStage;
  onChange: (next: DealStage) => void;
}

/**
 * Action buttons that sit below the deal lines editor and drive the
 * substep / next-step transitions for the 3-step stepper.
 *
 * - quote_in_progress: [Merkja sem sent] (with confirm modal)
 * - quote_sent       : [Lagfæra tilboð]  [Staðfesta pöntun]
 * - order_confirmed  : [Vörur komnar í hús (toggle)] [Merkja sem afhent]
 * - ready_for_pickup : [Skila í pöntunarstöðu]      [Merkja sem afhent]
 * - inquiry / delivered / defect_reorder / cancelled: nothing
 */
export function StepperActions({ stage, onChange }: Props) {
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  if (
    stage === "inquiry" ||
    stage === "delivered" ||
    stage === "defect_reorder" ||
    stage === "cancelled"
  ) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 rounded-md border border-border bg-muted/30 p-3">
      {stage === "quote_in_progress" && (
        <Button
          onClick={() => setConfirmSendOpen(true)}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          <Send className="mr-1.5 h-4 w-4" />
          {t.deal.markAsSent}
        </Button>
      )}

      {stage === "quote_sent" && (
        <>
          <Button variant="outline" onClick={() => onChange("quote_in_progress")}>
            <Pencil className="mr-1.5 h-4 w-4" />
            {t.deal.reactivateQuote}
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

      <AlertDialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deal.markAsSent}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deal.markAsSentConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSendOpen(false);
                onChange("quote_sent");
              }}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {t.deal.markAsSentConfirmYes}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
