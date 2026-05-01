import { useState } from "react";
import { Check, MoreHorizontal, Truck, FileCheck2, FileClock } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { cn } from "@/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PO = Database["public"]["Tables"]["purchase_orders"]["Row"];

const NAVY = "#1a2540";
const FUTURE_BORDER = "#d1d5db";

export type PoStepIdx = 0 | 1 | 2;

export function getPoStepIdx(po: Pick<PO, "paid_date" | "received_date">): PoStepIdx {
  if (po.paid_date) return 2;
  if (po.received_date) return 1;
  return 0;
}

const STEPS = [
  { key: "pantad", label: t.purchaseOrder.step1Pantad },
  { key: "mottekid", label: t.purchaseOrder.step2Mottekid },
  { key: "greitt", label: t.purchaseOrder.step3Greitt },
] as const;

interface Props {
  po: PO;
  hasTracking: boolean;
  onRevertToPantad: () => void; // clears received + invoice + approval
  onRevertToMottekid: () => void; // clears paid_date
  onRevertApproval: () => void; // clears invoice_approved_at/by
  onRevertPayment: () => void; // alias for revert to mottekid
  onCancel: () => void;
  onReactivate: () => void;
}

export function POStageStepper({
  po,
  hasTracking,
  onRevertToPantad,
  onRevertToMottekid,
  onRevertApproval,
  onCancel,
  onReactivate,
}: Props) {
  const [confirmAction, setConfirmAction] = useState<
    | null
    | "revert_to_pantad"
    | "revert_to_mottekid"
    | "revert_approval"
    | "cancel_po"
  >(null);

  if (po.status === "cancelled") {
    return (
      <div className="flex flex-col items-center justify-between gap-3 rounded-md border border-red-300 bg-red-100 p-4 text-red-800 sm:flex-row">
        <div className="text-lg font-semibold">{t.poStatus.cancelled}</div>
        <Button variant="outline" onClick={onReactivate} className="bg-white">
          {t.purchaseOrder.reactivatePO}
        </Button>
      </div>
    );
  }

  const currentIdx = getPoStepIdx(po);

  // Sub-pill under active step
  let pillLabel: string | null = null;
  let PillIcon: typeof Truck | null = null;
  if (currentIdx === 0) {
    if (hasTracking) {
      pillLabel = t.purchaseOrder.pillEnRoute;
      PillIcon = Truck;
    }
  } else if (currentIdx === 1) {
    if (po.invoice_received_date && !po.invoice_approved_at) {
      pillLabel = t.purchaseOrder.pillInvoicePending;
      PillIcon = FileClock;
    } else if (po.invoice_approved_at) {
      pillLabel = t.purchaseOrder.pillInvoiceApproved;
      PillIcon = FileCheck2;
    }
  }

  const handleStepClick = (idx: number) => {
    if (idx >= currentIdx) return;
    if (currentIdx === 2 && idx === 1) setConfirmAction("revert_to_mottekid");
    else if (currentIdx === 2 && idx === 0) setConfirmAction("revert_to_pantad");
    else if (currentIdx === 1 && idx === 0) setConfirmAction("revert_to_pantad");
  };

  // Dropdown items based on state
  const menuItems: Array<{ key: string; label: string; onClick: () => void; danger?: boolean }> =
    [];
  if (po.invoice_approved_at) {
    menuItems.push({
      key: "revert_approval",
      label: t.purchaseOrder.actionRevertApproval,
      onClick: () => setConfirmAction("revert_approval"),
    });
  }
  if (currentIdx === 2) {
    menuItems.push({
      key: "revert_payment",
      label: t.purchaseOrder.actionRevertPayment,
      onClick: () => setConfirmAction("revert_to_mottekid"),
    });
  }
  if (currentIdx >= 1) {
    menuItems.push({
      key: "revert_to_ordered",
      label: t.purchaseOrder.actionRevertToOrdered,
      onClick: () => setConfirmAction("revert_to_pantad"),
    });
  }

  const confirmMeta: Record<
    NonNullable<typeof confirmAction>,
    { title: string; description: string; action: () => void; danger?: boolean }
  > = {
    revert_to_pantad: {
      title: "Færa til baka?",
      description: t.purchaseOrder.confirmRevertInvoiceData,
      action: onRevertToPantad,
      danger: true,
    },
    revert_to_mottekid: {
      title: "Færa til baka?",
      description: "Greiðsludagur verður hreinsaður.",
      action: onRevertToMottekid,
    },
    revert_approval: {
      title: "Afturkalla samþykki?",
      description: "Samþykki reiknings verður hreinsað.",
      action: onRevertApproval,
    },
    cancel_po: {
      title: "Hætta við PO?",
      description: "Þetta merkir innkaupapöntunina sem aflýsta.",
      action: onCancel,
      danger: true,
    },
  };

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <ol className="flex flex-1 items-start">
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const isClickablePrev = idx < currentIdx;

            const sizeClass = isCurrent ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
            const baseCircle =
              "relative flex items-center justify-center rounded-full font-semibold transition-all";

            let circleStyle: React.CSSProperties = {};
            if (isCompleted) {
              circleStyle = { backgroundColor: NAVY, color: "white" };
            } else if (isCurrent) {
              circleStyle = {
                backgroundColor: NAVY,
                color: "white",
                boxShadow: `0 0 0 2px white, 0 0 0 4px ${NAVY}`,
              };
            } else {
              circleStyle = {
                backgroundColor: "white",
                color: "#9ca3af",
                border: `1px solid ${FUTURE_BORDER}`,
              };
            }

            const clickable = isClickablePrev;
            const circleClassName = cn(
              baseCircle,
              sizeClass,
              clickable && "cursor-pointer hover:opacity-80",
            );

            const circleContent = isCompleted ? (
              <Check className="h-4 w-4" />
            ) : (
              <span>{idx + 1}</span>
            );

            const labelClass = cn(
              "max-w-[10rem] text-center text-xs leading-tight",
              isCurrent ? "font-bold" : "text-muted-foreground",
            );
            const labelStyle: React.CSSProperties = isCurrent ? { color: NAVY } : {};

            return (
              <li
                key={step.key}
                className={cn(
                  "flex flex-1 items-start",
                  idx === STEPS.length - 1 && "flex-none",
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => handleStepClick(idx)}
                    className={circleClassName}
                    style={circleStyle}
                  >
                    {circleContent}
                  </button>
                  <span className={labelClass} style={labelStyle}>
                    {step.label}
                  </span>
                  {isCurrent && pillLabel && PillIcon && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <PillIcon className="h-3 w-3" />
                      {pillLabel}
                    </span>
                  )}
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 mt-3.5 h-0.5 flex-1",
                      idx < currentIdx
                        ? ""
                        : "border-t-2 border-dashed bg-transparent",
                    )}
                    style={
                      idx < currentIdx
                        ? { backgroundColor: NAVY }
                        : { borderColor: FUTURE_BORDER }
                    }
                  />
                )}
              </li>
            );
          })}
        </ol>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="flex-shrink-0">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menuItems.map((m) => (
              <DropdownMenuItem key={m.key} onClick={m.onClick}>
                {m.label}
              </DropdownMenuItem>
            ))}
            {menuItems.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => setConfirmAction("cancel_po")}
              className="text-red-600"
            >
              {t.purchaseOrder.cancelPO}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          {confirmAction && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmMeta[confirmAction].title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmMeta[confirmAction].description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmAction(null)}>
                  {t.actions.cancel}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    confirmMeta[confirmAction].action();
                    setConfirmAction(null);
                  }}
                  className={cn(
                    confirmMeta[confirmAction].danger
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-ide-navy text-white hover:bg-ide-navy-hover",
                  )}
                >
                  {t.actions.confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
