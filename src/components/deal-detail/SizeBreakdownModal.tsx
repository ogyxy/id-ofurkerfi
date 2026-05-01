import { useEffect, useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/sala_translations_is";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CLOTHING_SIZES,
  SHOE_SIZES,
  type SizeBreakdown,
  type SizeBreakdownType,
  sizesForType,
} from "@/lib/sizeBreakdown";

const NO_SPINNER =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineQuantity: number;
  initial: SizeBreakdown | null;
  onSave: (breakdown: SizeBreakdown | null) => void;
}

export function SizeBreakdownModal({
  open,
  onOpenChange,
  lineQuantity,
  initial,
  onSave,
}: Props) {
  const [type, setType] = useState<SizeBreakdownType>(initial?.type ?? "clothing");
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const initType = initial?.type ?? "clothing";
    setType(initType);
    const next: Record<string, string> = {};
    for (const s of sizesForType(initType)) {
      const v = initial?.sizes[s];
      next[s] = v && v > 0 ? String(v) : "";
    }
    setValues(next);
  }, [open, initial]);

  const sizes = sizesForType(type);
  const sum = sizes.reduce((acc, s) => acc + (Number(values[s]) || 0), 0);
  const matches = sum === lineQuantity;

  const switchType = (newType: SizeBreakdownType) => {
    if (newType === type) return;
    const hasValues = Object.values(values).some((v) => Number(v) > 0);
    if (hasValues) {
      const ok = window.confirm(
        "Skipta yfir í aðra stærðagerð? Núverandi gildi tapast.",
      );
      if (!ok) return;
    }
    setType(newType);
    const next: Record<string, string> = {};
    for (const s of sizesForType(newType)) next[s] = "";
    setValues(next);
  };

  const handleSave = () => {
    if (!matches) return;
    const sizesOut: Record<string, number> = {};
    for (const s of sizes) {
      const n = Number(values[s]) || 0;
      if (n > 0) sizesOut[s] = n;
    }
    if (Object.keys(sizesOut).length === 0) {
      onSave(null);
    } else {
      onSave({ type, sizes: sizesOut });
    }
    onOpenChange(false);
  };

  const handleClear = () => {
    onSave(null);
    onOpenChange(false);
  };

  const gridCols =
    type === "clothing" ? "grid-cols-4" : "grid-cols-5";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.dealLine.sizeBreakdown}</DialogTitle>
        </DialogHeader>

        {/* Segmented toggle */}
        <div className="inline-flex rounded-md border border-border bg-muted/30 p-1 self-start">
          <button
            type="button"
            onClick={() => switchType("clothing")}
            className={cn(
              "px-3 py-1.5 text-sm rounded transition-colors",
              type === "clothing"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.dealLine.sizeBreakdownClothing}
          </button>
          <button
            type="button"
            onClick={() => switchType("shoes")}
            className={cn(
              "px-3 py-1.5 text-sm rounded transition-colors",
              type === "shoes"
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.dealLine.sizeBreakdownShoes}
          </button>
        </div>

        {/* Size grid */}
        <div className={cn("grid gap-3", gridCols)}>
          {sizes.map((s) => (
            <div key={s} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{s}</Label>
              <Input
                type="number"
                min={0}
                value={values[s] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [s]: e.target.value }))
                }
                className={cn("text-center", NO_SPINNER)}
              />
            </div>
          ))}
        </div>

        {/* Status row */}
        <div
          className={cn(
            "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
            matches
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-900",
          )}
        >
          <div className="flex items-center gap-2">
            {matches ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <span>
              {t.dealLine.sizeBreakdownTotal}: <strong>{sum}</strong>
              <span className="mx-2 text-muted-foreground">/</span>
              {t.dealLine.sizeBreakdownExpected}: <strong>{lineQuantity}</strong>
            </span>
          </div>
          {!matches && (
            <span className="text-xs">{t.dealLine.sizeBreakdownMismatch}</span>
          )}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <div>
            {initial && (
              <Button variant="ghost" onClick={handleClear}>
                {t.dealLine.sizeBreakdownClear}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.actions.cancel}
            </Button>
            <Button onClick={handleSave} disabled={!matches}>
              {t.actions.save}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
