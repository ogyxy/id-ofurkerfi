import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatDate } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type POStatus = Database["public"]["Enums"]["po_status"];
type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"];
type POLine = Database["public"]["Tables"]["po_lines"]["Row"];

const PO_STATUSES: POStatus[] = [
  "draft",
  "sent",
  "confirmed",
  "in_production",
  "shipped",
  "received",
  "invoiced",
  "cancelled",
];

const CURRENCIES = ["EUR", "GBP", "NOK", "USD", "DKK"] as const;

interface Props {
  dealId: string;
  pos: Array<PurchaseOrder & { po_lines: POLine[] }>;
  onChanged: () => Promise<void>;
}

export function PurchaseOrdersSection({ dealId, pos, onChanged }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const updateStatus = async (id: string, status: POStatus) => {
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    await onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {t.nav.purchaseOrders} ({pos.length})
        </h2>
        <Button
          onClick={() => setDrawerOpen(true)}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          <Plus className="mr-1 h-4 w-4" />
          {t.actions.add}
        </Button>
      </div>

      {pos.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t.status.noDataYet}
        </div>
      ) : (
        <div className="space-y-2">
          {pos.map((po) => (
            <div
              key={po.id}
              className="rounded-md border border-border bg-card"
            >
              <div className="flex flex-wrap items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => toggle(po.id)}
                  className="text-muted-foreground"
                >
                  {expanded[po.id] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <span className="font-mono text-xs text-muted-foreground">
                  {po.po_number}
                </span>
                <span className="text-sm font-medium">{po.supplier}</span>
                <Select
                  value={po.status}
                  onValueChange={(v) => updateStatus(po.id, v as POStatus)}
                >
                  <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PO_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t.poStatus[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="ml-auto text-sm tabular-nums">
                  {Number(po.amount ?? 0).toLocaleString("is-IS")}{" "}
                  {po.currency}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(po.expected_delivery_date)}
                </span>
              </div>
              {expanded[po.id] && (
                <div className="border-t border-border p-3">
                  {po.po_lines && po.po_lines.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1 text-left">
                            {t.poLine.supplier_sku}
                          </th>
                          <th className="px-2 py-1 text-left">
                            {t.poLine.description}
                          </th>
                          <th className="px-2 py-1 text-right">
                            {t.poLine.quantity}
                          </th>
                          <th className="px-2 py-1 text-right">
                            {t.poLine.unit_cost}
                          </th>
                          <th className="px-2 py-1 text-right">
                            {t.poLine.line_total}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {po.po_lines.map((l) => (
                          <tr key={l.id} className="border-t border-border">
                            <td className="px-2 py-1">{l.supplier_sku}</td>
                            <td className="px-2 py-1">{l.description}</td>
                            <td className="px-2 py-1 text-right">
                              {l.quantity}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums">
                              {Number(l.unit_cost).toFixed(2)}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums">
                              {Number(l.line_total ?? 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t.status.noDataYet}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AddPODrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        dealId={dealId}
        onSaved={onChanged}
      />
    </div>
  );
}

interface AddProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dealId: string;
  onSaved: () => Promise<void>;
}

function AddPODrawer({ open, onOpenChange, dealId, onSaved }: AddProps) {
  const [supplier, setSupplier] = useState("midocean");
  const [currency, setCurrency] = useState("EUR");
  const [amount, setAmount] = useState("");
  const [shipping, setShipping] = useState("");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setSupplier("midocean");
    setCurrency("EUR");
    setAmount("");
    setShipping("");
    setExpected("");
    setNotes("");
  };

  const handleSave = async () => {
    if (!supplier.trim()) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("purchase_orders").insert({
      deal_id: dealId,
      supplier: supplier.trim(),
      currency,
      amount: amount ? Number(amount) : 0,
      shipping_cost: shipping ? Number(shipping) : null,
      expected_delivery_date: expected || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    reset();
    onOpenChange(false);
    await onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {t.actions.add} {t.nav.purchaseOrders.toLowerCase()}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-3 py-4">
          <div>
            <Label>{t.purchaseOrder.supplier}</Label>
            <Input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>
          <div>
            <Label>{t.purchaseOrder.currency}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
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
          </div>
          <div>
            <Label>{t.purchaseOrder.amount}</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>{t.purchaseOrder.shipping_cost}</Label>
            <Input
              type="number"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
            />
          </div>
          <div>
            <Label>{t.purchaseOrder.expected_delivery_date}</Label>
            <Input
              type="date"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
          </div>
          <div>
            <Label>{t.purchaseOrder.notes}</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <SheetFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t.actions.cancel}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className={cn("bg-ide-navy text-white hover:bg-ide-navy-hover")}
          >
            {saving ? t.status.saving : t.actions.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
