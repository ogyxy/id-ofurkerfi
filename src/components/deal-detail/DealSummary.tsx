import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatIsk, formatNumber } from "@/lib/sala_translations_is";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  type EditableLine,
  lineCostIsk,
  lineTotalIsk,
} from "./DealLinesEditor";

type VskStatus = Database["public"]["Enums"]["vsk_status"];

interface Props {
  dealId: string;
  lines: EditableLine[];
  shippingCost: number;
  setShippingCost: (n: number) => void;
  vskStatus: VskStatus;
  readOnly?: boolean;
}

export function DealSummary({
  dealId,
  lines,
  shippingCost,
  setShippingCost,
  vskStatus,
  readOnly = false,
}: Props) {
  const [localShipping, setLocalShipping] = useState(String(shippingCost));

  useEffect(() => {
    setLocalShipping(String(shippingCost));
  }, [shippingCost]);

  const subtotal = lines.reduce((s, l) => s + lineTotalIsk(l), 0);
  const totalCost = lines.reduce((s, l) => s + lineCostIsk(l), 0);
  const totalMargin = subtotal - totalCost - shippingCost;
  const marginPct = subtotal > 0 ? (totalMargin / subtotal) * 100 : 0;

  const vskRate =
    vskStatus === "standard" ? 0.24 : vskStatus === "reduced" ? 0.11 : 0;
  const showVat = vskStatus === "standard" || vskStatus === "reduced";
  const vat = subtotal * vskRate;
  const grandTotal = subtotal + vat;

  const marginColor =
    marginPct >= 20
      ? "text-green-700"
      : marginPct >= 10
        ? "text-amber-700"
        : "text-red-700";

  const saveShipping = async (n: number) => {
    const { error } = await supabase
      .from("deals")
      .update({ shipping_cost_isk: n })
      .eq("id", dealId);
    if (error) {
      toast.error(t.status.somethingWentWrong);
    } else {
      setShippingCost(n);
    }
  };

  return (
    <div className="mr-auto max-w-md space-y-3 rounded-md border border-border bg-card p-4">
      <Row label={t.dealSummary.subtotal} value={formatIsk(subtotal)} />
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm text-muted-foreground">
          {t.dealSummary.shipping}
        </Label>
        <Input
          type="number"
          value={localShipping}
          onChange={(e) => setLocalShipping(e.target.value)}
          onBlur={() => {
            const n = Number(localShipping) || 0;
            if (n !== shippingCost) saveShipping(n);
          }}
          className="w-32 text-right"
          disabled={readOnly}
        />
      </div>
      <Row
        label={t.dealSummary.totalCost}
        value={formatIsk(totalCost + shippingCost)}
        muted
      />
      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{t.dealSummary.totalMargin}</span>
          <span className={cn("font-semibold tabular-nums", marginColor)}>
            {formatIsk(totalMargin)}{" "}
            <span className="text-xs">({formatNumber(marginPct, 1)}%)</span>
          </span>
        </div>
      </div>
      {showVat && (
        <div className="border-t border-border pt-3">
          <Row
            label={`${t.dealSummary.vat} (${Math.round(vskRate * 100)}%)`}
            value={formatIsk(vat)}
            muted
          />
          <div className="mt-2 flex items-center justify-between text-base font-bold">
            <span>{t.dealSummary.grandTotal}</span>
            <span className="tabular-nums">{formatIsk(grandTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm",
        muted && "text-muted-foreground",
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
