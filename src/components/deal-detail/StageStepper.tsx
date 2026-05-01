import { useState } from "react";
import { Check, MoreHorizontal, Send, Package } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DealStage = Database["public"]["Enums"]["deal_stage"];

const NAVY = "#1a2540";
const FUTURE_BORDER = "#d1d5db";

// Map stage → which of the 3 main steps it belongs to (0,1,2). -1 = pre-stepper (inquiry).
function stageToStepIdx(stage: DealStage): number {
  switch (stage) {
    case "inquiry":
      return -1;
    case "quote_in_progress":
    case "quote_sent":
      return 0;
    case "order_confirmed":
    case "ready_for_pickup":
      return 1;
    case "delivered":
      return 2;
    default:
      return -1;
  }
}

const STEPS: Array<{
  key: string;
  label: string;
}> = [
  { key: "tilbod", label: t.deal.step1Tilbod },
  { key: "pontun", label: t.deal.step2Pontun },
  { key: "afhent", label: t.deal.step3Afhent },
];

interface Props {
  stage: DealStage;
  onChange: (next: DealStage) => void;
  poProgress?: { received: number; total: number } | null;
}

export function StageStepper({ stage, onChange, poProgress }: Props) {
  const [confirmBackStage, setConfirmBackStage] = useState<DealStage | null>(null);

  if (stage === "cancelled") {
    return (
      <div className="flex flex-col items-center justify-between gap-3 rounded-md border border-red-300 bg-red-100 p-4 text-red-800 sm:flex-row">
        <div className="text-lg font-semibold">{t.dealStage.cancelled}</div>
        <Button variant="outline" onClick={() => onChange("inquiry")} className="bg-white">
          Endurvirkja
        </Button>
      </div>
    );
  }

  // defect_reorder is handled by DefectBar in the parent — stepper not rendered.
  // delivered is handled by DeliveredBar in the parent — stepper not rendered.

  const currentIdx = stageToStepIdx(stage);
  const isInquiry = stage === "inquiry";

  // Substep label under the active step
  let substepLabel: string | null = null;
  let SubstepIcon: typeof Send | null = null;
  if (stage === "quote_sent") {
    substepLabel = t.deal.substepSent;
    SubstepIcon = Send;
  } else if (stage === "ready_for_pickup") {
    substepLabel =
      poProgress && poProgress.total > 1
        ? `${poProgress.received}/${poProgress.total} ${t.deal.substepInHouse.toLowerCase()}`
        : t.deal.substepInHouse;
    SubstepIcon = Package;
  } else if (
    stage === "order_confirmed" &&
    poProgress &&
    poProgress.total > 0 &&
    poProgress.received > 0
  ) {
    substepLabel = `${poProgress.received}/${poProgress.total} ${t.deal.substepInHouse.toLowerCase()}`;
    SubstepIcon = Package;
  }

  // Click handler for circles. Circles allow:
  // - clicking step 0 from inquiry to advance to quote_in_progress
  // - clicking a previous step (with confirm) to revert
  // Forward jumps within stepper happen via the action buttons below the lines table.
  const handleStepClick = (idx: number) => {
    if (isInquiry && idx === 0) {
      onChange("quote_in_progress");
      return;
    }
    if (idx < currentIdx) {
      // revert to first stage of that step
      const target: DealStage =
        idx === 0 ? "quote_in_progress" : idx === 1 ? "order_confirmed" : "delivered";
      setConfirmBackStage(target);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <ol className="flex flex-1 items-start">
          {STEPS.map((step, idx) => {
            const isCompleted = !isInquiry && idx < currentIdx;
            const isCurrent = !isInquiry && idx === currentIdx;
            const isFuture = isInquiry || idx > currentIdx;
            const isClickablePrev = !isInquiry && idx < currentIdx;
            const isInquiryEntry = isInquiry && idx === 0;

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

            const clickable = isClickablePrev || isInquiryEntry;
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
                  {isCurrent && substepLabel && SubstepIcon && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <SubstepIcon className="h-3 w-3" />
                      {substepLabel}
                    </span>
                  )}
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 mt-3.5 h-0.5 flex-1",
                      !isInquiry && idx < currentIdx
                        ? ""
                        : "border-t-2 border-dashed bg-transparent",
                    )}
                    style={
                      !isInquiry && idx < currentIdx
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
            <DropdownMenuItem
              onClick={() => onChange("cancelled")}
              className="text-red-600"
            >
              Hætta við sölu
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onChange("defect_reorder")}
              className="text-orange-600"
            >
              Galli / Vesen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isInquiry && (
        <p className="mt-3 text-center text-xs italic text-muted-foreground">
          {t.deal.inquiryStepperNote}
        </p>
      )}

      <AlertDialog
        open={Boolean(confirmBackStage)}
        onOpenChange={(open) => !open && setConfirmBackStage(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Færa til baka?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBackStage ? (
                <>
                  Færa í <span className="font-semibold">{t.dealStage[confirmBackStage]}</span>?
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmBackStage(null)}>
              {t.actions.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmBackStage) return;
                onChange(confirmBackStage);
                setConfirmBackStage(null);
              }}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {t.actions.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
