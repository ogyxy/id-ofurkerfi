import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatIsk, formatNumber } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DealLineRow = Database["public"]["Tables"]["deal_lines"]["Row"];

const CURRENCIES = ["EUR", "GBP", "USD", "NOK", "DKK", "SEK", "CHF"] as const;

export type EditableLine = {
  id: string; // local id (uuid or temp id)
  isNew: boolean;
  line_order: number;
  product_name: string;
  product_supplier_sku: string;
  quantity: number;
  unit_cost: number;
  cost_currency: string;
  exchange_rate: number;
  unit_cost_isk: number;
  markup_pct: number;
  unit_price_isk: number;
  manualPrice: boolean;
  notes: string;
};

export function fromDbLine(row: DealLineRow): EditableLine {
  return {
    id: row.id,
    isNew: false,
    line_order: row.line_order,
    product_name: row.product_name,
    product_supplier_sku: row.product_supplier_sku ?? "",
    quantity: row.quantity,
    unit_cost: Number(row.unit_cost),
    cost_currency: row.cost_currency,
    exchange_rate: Number(row.exchange_rate),
    unit_cost_isk: Number(row.unit_cost_isk),
    markup_pct: Number(row.markup_pct),
    unit_price_isk: Number(row.unit_price_isk),
    manualPrice: false,
    notes: row.notes ?? "",
  };
}

export function calcUnitCostIsk(line: EditableLine): number {
  return Math.round(line.unit_cost * line.exchange_rate * 100) / 100;
}

export function calcUnitPriceIsk(unitCostIsk: number, markupPct: number): number {
  const raw = unitCostIsk * (1 + markupPct / 100);
  return raw <= 10000 ? Math.round(raw / 10) * 10 : Math.round(raw / 100) * 100;
}

export function lineCostIsk(l: EditableLine) {
  return l.quantity * l.unit_cost_isk;
}
export function lineTotalIsk(l: EditableLine) {
  return l.quantity * l.unit_price_isk;
}
export function lineMarginIsk(l: EditableLine) {
  return lineTotalIsk(l) - lineCostIsk(l);
}

interface Props {
  dealId: string;
  lines: EditableLine[];
  setLines: (l: EditableLine[]) => void;
  defaultMarkupPct: number;
  setDefaultMarkupPct: (n: number) => void;
  rates: Record<string, number>;
  ratesError: boolean;
  onSaveDefaultMarkup: (n: number) => Promise<void>;
  onSaved: () => Promise<void>;
}

export function DealLinesEditor({
  dealId,
  lines,
  setLines,
  defaultMarkupPct,
  setDefaultMarkupPct,
  rates,
  ratesError,
  onSaveDefaultMarkup,
  onSaved,
}: Props) {
  // Track ids of lines that have been persisted at least once
  const persistedIds = useRef<Set<string>>(new Set());
  // Cache last serialized payload per id to avoid redundant writes
  const lastSerialized = useRef<Map<string, string>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize persisted ids from existing (non-new) lines
  useEffect(() => {
    for (const l of lines) {
      if (!l.isNew) persistedIds.current.add(l.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistTotals = async (currentLines: EditableLine[]) => {
    const totalCost = currentLines.reduce((s, l) => s + lineCostIsk(l), 0);
    const totalPrice = currentLines.reduce((s, l) => s + lineTotalIsk(l), 0);
    await supabase
      .from("deals")
      .update({
        total_cost_isk: totalCost,
        total_price_isk: totalPrice,
        total_margin_isk: totalPrice - totalCost,
        amount_isk: totalPrice,
      })
      .eq("id", dealId);
  };

  const saveLine = async (line: EditableLine, orderIdx: number) => {
    if (!line.product_name.trim()) return; // don't save until name exists
    const payload = {
      deal_id: dealId,
      line_order: orderIdx + 1,
      product_name: line.product_name.trim(),
      product_supplier_sku: line.product_supplier_sku.trim() || null,
      description: null,
      quantity: line.quantity,
      unit_cost: line.unit_cost,
      cost_currency: line.cost_currency,
      exchange_rate: line.exchange_rate,
      unit_cost_isk: line.unit_cost_isk,
      markup_pct: line.markup_pct,
      unit_price_isk: line.unit_price_isk,
      line_cost_isk: lineCostIsk(line),
      line_total_isk: lineTotalIsk(line),
      line_margin_isk: lineMarginIsk(line),
      notes: line.notes || null,
    };
    const serialized = JSON.stringify(payload);
    if (lastSerialized.current.get(line.id) === serialized) return;

    if (persistedIds.current.has(line.id)) {
      const { error } = await supabase
        .from("deal_lines")
        .update(payload)
        .eq("id", line.id);
      if (error) {
        toast.error(t.status.somethingWentWrong);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("deal_lines")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        toast.error(t.status.somethingWentWrong);
        return;
      }
      // Swap temp id for real id
      const newId = data.id;
      persistedIds.current.add(newId);
      lastSerialized.current.set(newId, serialized);
      setLines(
        lines.map((l) =>
          l.id === line.id ? { ...l, id: newId, isNew: false } : l,
        ),
      );
      return;
    }
    lastSerialized.current.set(line.id, serialized);
  };

  // Debounced auto-save whenever lines change
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const snapshot = lines;
      for (let i = 0; i < snapshot.length; i++) {
        await saveLine(snapshot[i], i);
      }
      await persistTotals(snapshot);
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  const updateLine = (idx: number, patch: Partial<EditableLine>) => {
    const next = [...lines];
    let line = { ...next[idx], ...patch };

    // Auto-fill exchange rate when currency changes (before unit_cost_isk recalc)
    if (patch.cost_currency !== undefined) {
      const r = rates[patch.cost_currency];
      if (r) {
        line.exchange_rate = Math.round(r * 100) / 100;
      }
    }

    // Recalc unit_cost_isk if cost inputs changed
    if (
      patch.unit_cost !== undefined ||
      patch.cost_currency !== undefined ||
      patch.exchange_rate !== undefined
    ) {
      line.unit_cost_isk = calcUnitCostIsk(line);
    }

    // Recalc unit_price_isk unless price is manually overridden
    if (
      (patch.unit_cost_isk !== undefined ||
        patch.markup_pct !== undefined ||
        patch.unit_cost !== undefined ||
        patch.cost_currency !== undefined ||
        patch.exchange_rate !== undefined) &&
      patch.unit_price_isk === undefined
    ) {
      if (!line.manualPrice) {
        line.unit_price_isk = calcUnitPriceIsk(line.unit_cost_isk, line.markup_pct);
      }
    }

    if (patch.unit_price_isk !== undefined) {
      line.manualPrice = true;
    }

    next[idx] = line;
    setLines(next);
  };

  const addLine = () => {
    const eurRate = rates.EUR ?? 0;
    const newLine: EditableLine = {
      id: `tmp-${Date.now()}-${Math.random()}`,
      isNew: true,
      line_order: lines.length + 1,
      product_name: "",
      product_supplier_sku: "",
      quantity: 1,
      unit_cost: 0,
      cost_currency: "EUR",
      exchange_rate: eurRate ? Math.round(eurRate * 100) / 100 : 0,
      unit_cost_isk: 0,
      markup_pct: defaultMarkupPct,
      unit_price_isk: 0,
      manualPrice: false,
      notes: "",
    };
    setLines([...lines, newLine]);
  };

  const removeLine = async (idx: number) => {
    const line = lines[idx];
    const next = lines.filter((_, i) => i !== idx);
    setLines(next);
    if (persistedIds.current.has(line.id)) {
      await supabase.from("deal_lines").delete().eq("id", line.id);
      persistedIds.current.delete(line.id);
      lastSerialized.current.delete(line.id);
      await persistTotals(next);
      await onSaved();
    }
  };

  const applyDefaultMarkup = () => {
    setLines(
      lines.map((l) => {
        const updated = { ...l, markup_pct: defaultMarkupPct, manualPrice: false };
        updated.unit_price_isk = calcUnitPriceIsk(updated.unit_cost_isk, defaultMarkupPct);
        return updated;
      }),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {t.dealLine.title} ({lines.length})
        </h2>
      </div>

      {ratesError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Ekki tókst að sækja gengi. Sláðu inn gengi handvirkt.
        </div>
      )}

      {/* Default markup row */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-3">
        <div>
          <Label className="text-xs">{t.dealLine.defaultMarkup} (%)</Label>
          <Input
            type="number"
            value={defaultMarkupPct}
            onChange={(e) => setDefaultMarkupPct(Number(e.target.value))}
            onBlur={() => onSaveDefaultMarkup(defaultMarkupPct)}
            className="w-32"
          />
        </div>
        <Button variant="outline" size="sm" onClick={applyDefaultMarkup}>
          {t.dealLine.applyToAll}
        </Button>
      </div>

      {/* Lines table */}
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2"></th>
              <th className="px-2 py-2 text-left">{t.dealLine.product_name}</th>
              <th className="px-2 py-2 text-right">{t.dealLine.quantity}</th>
              <th className="px-2 py-2 text-right">{t.dealLine.unit_cost}</th>
              <th className="px-2 py-2 text-left">{t.dealLine.cost_currency}</th>
              <th className="px-2 py-2 text-right">{t.dealLine.exchange_rate}</th>
              <th className="px-2 py-2 text-right">{t.dealLine.markup_pct}</th>
              <th className="px-2 py-2 text-right">{t.dealLine.unit_price_isk}</th>
              <th className="px-2 py-2 text-right">{t.dealLine.line_total_isk}</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const liveRate = rates[line.cost_currency];
              return (
                <tr key={line.id} className="border-t border-border">
                  <td className="px-2 py-2 text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      value={line.product_name}
                      onChange={(e) =>
                        updateLine(idx, { product_name: e.target.value })
                      }
                      className="min-w-[140px]"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(idx, { quantity: Number(e.target.value) })
                      }
                      className="w-20 text-right"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={line.unit_cost}
                      onChange={(e) =>
                        updateLine(idx, { unit_cost: Number(e.target.value) })
                      }
                      className="w-24 text-right"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Select
                      value={line.cost_currency}
                      onValueChange={(v) => updateLine(idx, { cost_currency: v })}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={line.exchange_rate}
                      onChange={(e) =>
                        updateLine(idx, {
                          exchange_rate: Number(e.target.value),
                        })
                      }
                      placeholder={ratesError ? "Sláðu inn gengi" : ""}
                      className="w-24 text-right"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={line.markup_pct}
                      onChange={(e) =>
                        updateLine(idx, {
                          markup_pct: Number(e.target.value),
                        })
                      }
                      onBlur={() => {
                        const updated = {
                          ...line,
                          manualPrice: false,
                          unit_price_isk: calcUnitPriceIsk(
                            line.unit_cost_isk,
                            line.markup_pct,
                          ),
                        };
                        const next = [...lines];
                        next[idx] = updated;
                        setLines(next);
                      }}
                      className="w-20 text-right"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {line.manualPrice && (
                        <Pencil className="h-3 w-3 text-amber-600" />
                      )}
                      <Input
                        type="number"
                        value={line.unit_price_isk}
                        onChange={(e) =>
                          updateLine(idx, {
                            unit_price_isk: Number(e.target.value),
                          })
                        }
                        className="w-28 text-right"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium">
                    {formatIsk(lineTotalIsk(line))}
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(idx)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {t.status.noDataYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Button variant="outline" onClick={addLine}>
        <Plus className="mr-1 h-4 w-4" />
        {t.dealLine.addLine}
      </Button>
    </div>
  );
}
