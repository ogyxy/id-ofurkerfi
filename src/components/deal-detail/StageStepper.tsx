import { useState } from "react";
import { Check, MoreHorizontal } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

interface Props {
  stage: DealStage;
  onChange: (next: DealStage) => void;
}

export function StageStepper({ stage, onChange }: Props) {
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [confirmBackIdx, setConfirmBackIdx] = useState<number | null>(null);

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
          <Popover
            open={confirmBackIdx === currentIdx - 1}
            onOpenChange={(o) => !o && setConfirmBackIdx(null)}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentIdx <= 0}
                onClick={() =>
                  currentIdx > 0 && setConfirmBackIdx(currentIdx - 1)
                }
              >
                ←
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="space-y-3">
                <p className="text-sm">
                  Færa til baka í{" "}
                  <span className="font-semibold">
                    {currentIdx > 0 && t.dealStage[HAPPY_PATH[currentIdx - 1]]}
                  </span>
                  ?
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmBackIdx(null)}
                  >
                    {t.actions.cancel}
                  </Button>
                  <Button
                    size="sm"
                    className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                    onClick={() => {
                      if (currentIdx > 0) {
                        onChange(HAPPY_PATH[currentIdx - 1]);
                        setConfirmBackIdx(null);
                      }
                    }}
                  >
                    {t.actions.confirm}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">
              {currentIdx + 1} / {HAPPY_PATH.length}
            </div>
            <div className="font-semibold text-ide-navy">
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

            const circle = (
              <button
                type="button"
                disabled={!isNext && !isPrev}
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all",
                  isCompleted &&
                    "border-ide-navy bg-ide-navy text-white",
                  isCurrent &&
                    "border-ide-navy bg-ide-navy text-white shadow-md ring-4 ring-ide-navy/20",
                  isFuture &&
                    "border-border bg-background text-muted-foreground",
                  (isNext || isPrev) &&
                    "cursor-pointer hover:border-ide-navy hover:text-ide-navy",
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </button>
            );

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
                      onOpenChange={(o) => !o && setConfirmIdx(null)}
                    >
                      <PopoverTrigger asChild>{circle}</PopoverTrigger>
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
                    <Popover
                      open={confirmBackIdx === idx}
                      onOpenChange={(o) => !o && setConfirmBackIdx(null)}
                    >
                      <PopoverTrigger asChild>{circle}</PopoverTrigger>
                      <PopoverContent className="w-64">
                        <div className="space-y-3">
                          <p className="text-sm">
                            Færa til baka í{" "}
                            <span className="font-semibold">
                              {t.dealStage[s]}
                            </span>
                            ?
                          </p>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmBackIdx(null)}
                            >
                              {t.actions.cancel}
                            </Button>
                            <Button
                              size="sm"
                              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                              onClick={() => {
                                onChange(s);
                                setConfirmBackIdx(null);
                              }}
                            >
                              {t.actions.confirm}
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    circle
                  )}
                  <span
                    className={cn(
                      "max-w-[8rem] text-center text-xs leading-tight",
                      (isCompleted || isCurrent) &&
                        "font-semibold text-ide-navy",
                      isFuture && "text-muted-foreground",
                    )}
                  >
                    {t.dealStage[s]}
                  </span>
                </div>
                {idx < HAPPY_PATH.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 -mt-6 h-0.5 flex-1 transition-colors",
                      idx < currentIdx ? "bg-ide-navy" : "bg-border",
                    )}
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
              Galli / endurpöntun
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
