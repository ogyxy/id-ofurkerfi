import { useState } from "react";
import { Check, MoreHorizontal } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DealStage = Database["public"]["Enums"]["deal_stage"];

const HAPPY_PATH: DealStage[] = [
  "inquiry",
  "quote_in_progress",
  "quote_sent",
  "order_confirmed",
  "delivered",
];

const NAVY = "#1a2540";
const FUTURE_BORDER = "#d1d5db";

interface Props {
  stage: DealStage;
  onChange: (next: DealStage) => void;
}

export function StageStepper({ stage, onChange }: Props) {
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [confirmBackStage, setConfirmBackStage] = useState<DealStage | null>(null);

  if (stage === "cancelled" || stage === "defect_reorder") {
    const tone =
      stage === "cancelled"
        ? "bg-red-100 text-red-800 border-red-300"
        : "bg-orange-100 text-orange-800 border-orange-300";
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-between gap-3 rounded-md border p-4 sm:flex-row",
          tone,
        )}
      >
        <div className="text-lg font-semibold">{t.dealStage[stage]}</div>
        <Button
          variant="outline"
          onClick={() => onChange("inquiry")}
          className="bg-white"
        >
          Endurvirkja
        </Button>
      </div>
    );
  }

  const currentIdx = HAPPY_PATH.indexOf(stage);

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-2">
        {/* Mobile: collapsed view */}
        <div className="flex flex-1 items-center justify-between md:hidden">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentIdx <= 0}
            onClick={() =>
              currentIdx > 0 && setConfirmBackStage(HAPPY_PATH[currentIdx - 1])
            }
          >
            ←
          </Button>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">
              {currentIdx + 1} / {HAPPY_PATH.length}
            </div>
            <div className="font-semibold" style={{ color: NAVY }}>
              {t.dealStage[stage]}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={currentIdx >= HAPPY_PATH.length - 1}
            onClick={() =>
              currentIdx < HAPPY_PATH.length - 1 &&
              setConfirmIdx(currentIdx + 1)
            }
          >
            →
          </Button>
        </div>

        {/* Desktop: full stepper */}
        <ol className="hidden flex-1 items-center md:flex">
          {HAPPY_PATH.map((s, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const isNext = idx === currentIdx + 1;
            const isPrev = idx === currentIdx - 1;
            const isFuture = idx > currentIdx;

            // Sizes: current larger (36px) vs others (28px)
            const sizeClass = isCurrent ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";

            const baseCircle =
              "relative flex items-center justify-center rounded-full font-semibold transition-all";

            let circleStyle: React.CSSProperties = {};
            let circleExtra = "";
            if (isCompleted) {
              circleStyle = { backgroundColor: NAVY, color: "white" };
            } else if (isCurrent) {
              circleStyle = {
                backgroundColor: NAVY,
                color: "white",
                boxShadow: `0 0 0 2px white, 0 0 0 4px ${NAVY}`,
              };
            } else if (isFuture) {
              circleStyle = {
                backgroundColor: "white",
                color: "#9ca3af",
                border: `1px solid ${FUTURE_BORDER}`,
              };
            }
            if (isNext || isPrev) {
              circleExtra = "cursor-pointer hover:opacity-80";
            }

            const circleClassName = cn(baseCircle, sizeClass, circleExtra);

            const circleContent = isCompleted ? (
              <Check className="h-4 w-4" />
            ) : (
              <span>{idx + 1}</span>
            );

            // Label styles
            let labelClass = "max-w-[8rem] text-center text-xs leading-tight";
            let labelStyle: React.CSSProperties = {};
            if (isCompleted) {
              labelClass = cn(labelClass, "text-muted-foreground");
            } else if (isCurrent) {
              labelClass = cn(labelClass, "font-bold");
              labelStyle = { color: NAVY };
            } else {
              labelClass = cn(labelClass, "text-muted-foreground");
            }

            return (
              <li
                key={s}
                className={cn(
                  "flex flex-1 items-center",
                  idx === HAPPY_PATH.length - 1 && "flex-none",
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  {isNext ? (
                    <Popover
                      open={confirmIdx === idx}
                      onOpenChange={(o) =>
                        setConfirmIdx(o ? idx : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={circleClassName}
                          style={circleStyle}
                        >
                          {circleContent}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64">
                        <div className="space-y-3">
                          <p className="text-sm">
                            Færa í{" "}
                            <span className="font-semibold">
                              {t.dealStage[s]}
                            </span>
                            ?
                          </p>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmIdx(null)}
                            >
                              {t.actions.cancel}
                            </Button>
                            <Button
                              size="sm"
                              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                              onClick={() => {
                                onChange(s);
                                setConfirmIdx(null);
                              }}
                            >
                              {t.actions.confirm}
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : isPrev ? (
                    <button
                      type="button"
                      onClick={() => setConfirmBackStage(s)}
                      className={circleClassName}
                      style={circleStyle}
                    >
                      {circleContent}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className={circleClassName}
                      style={circleStyle}
                    >
                      {circleContent}
                    </button>
                  )}
                  <span className={labelClass} style={labelStyle}>
                    {t.dealStage[s]}
                  </span>
                </div>
                {idx < HAPPY_PATH.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 -mt-6 h-0.5 flex-1",
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
    </div>
  );
}
