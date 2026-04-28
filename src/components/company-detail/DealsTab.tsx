import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Copy, Check, X, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatIsk, formatDate } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";

type DealStage = Database["public"]["Enums"]["deal_stage"];
type DefectResolution = Database["public"]["Enums"]["defect_resolution"];
type Deal = {
  id: string;
  so_number: string;
  name: string;
  stage: DealStage;
  amount_isk: number | null;
  refund_amount_isk: number | null;
  promised_delivery_date: string | null;
  delivered_at: string | null;
  invoice_status: Database["public"]["Enums"]["invoice_status"];
  payment_status: Database["public"]["Enums"]["payment_status"];
  defect_resolution: DefectResolution;
  created_at: string;
  childDeals?: { stage: DealStage }[];
};
type Contact = Database["public"]["Tables"]["contacts"]["Row"];

interface Props {
  companyId: string;
  deals: Deal[];
  contacts: Contact[];
  onChanged: () => void;
  onOpenDeal: (id: string) => void;
}

const dealStageOptions: DealStage[] = [
  "inquiry",
  "quote_in_progress",
  "quote_sent",
  "order_confirmed",
  "delivered",
  "cancelled",
  "defect_reorder",
];

const stageColors: Record<DealStage, string> = {
  inquiry: "bg-gray-100 text-gray-700",
  quote_in_progress: "bg-blue-100 text-blue-700",
  quote_sent: "bg-indigo-100 text-indigo-700",
  order_confirmed: "bg-amber-100 text-amber-800",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  defect_reorder: "bg-orange-100 text-orange-700",
};

const OPEN_STAGES: DealStage[] = [
  "inquiry",
  "quote_in_progress",
  "quote_sent",
  "order_confirmed",
];

function isDefectResolved(deal: Deal): boolean {
  if (deal.stage !== "defect_reorder") return false;
  if (deal.defect_resolution === "refund" && deal.refund_amount_isk != null) return true;
  if (deal.defect_resolution === "credit_note") return true;
  if (deal.defect_resolution === "resolved") return true;
  if (
    deal.defect_resolution === "reorder" &&
    (deal.childDeals?.length ?? 0) > 0 &&
    deal.childDeals!.every((c) => c.stage === "delivered")
  ) {
    return true;
  }
  return false;
}

function isOverdue(date: string | null, stage: DealStage, resolved: boolean): boolean {
  if (!date) return false;
  if (stage === "delivered" || stage === "cancelled" || resolved) return false;
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

type FormState = {
  name: string;
  stage: DealStage;
  amount_isk: string;
  promised_delivery_date: string;
  contact_id: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  stage: "inquiry",
  amount_isk: "",
  promised_delivery_date: "",
  contact_id: "",
  notes: "",
};

type FilterKey = "open" | "delivered" | "defect" | "cancelled";
type SortKey = "created_at" | "amount_isk";
type SortDir = "asc" | "desc";

export function DealsTab({ companyId, deals, contacts, onChanged, onOpenDeal }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleCopySo = async (e: React.MouseEvent, id: string, soNumber: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(soNumber);
      setCopiedId(id);
      toast.success(`${soNumber} afritað`);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      toast.error(t.status.somethingWentWrong);
    }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("deals").insert({
      company_id: companyId,
      name: form.name.trim(),
      stage: form.stage,
      amount_isk: form.amount_isk ? Number(form.amount_isk) : 0,
      promised_delivery_date: form.promised_delivery_date || null,
      contact_id: form.contact_id || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    setDrawerOpen(false);
    onChanged();
  };

  // Counts — always reflect full unarchived dataset
  const counts = useMemo(() => {
    let open = 0,
      delivered = 0,
      defect = 0,
      cancelled = 0;
    deals.forEach((d) => {
      if (d.stage === "cancelled") cancelled++;
      else if (d.stage === "defect_reorder") {
        if (isDefectResolved(d)) delivered++;
        else defect++;
      } else if (d.stage === "delivered") delivered++;
      else if (OPEN_STAGES.includes(d.stage)) open++;
    });
    return { open, delivered, defect, cancelled };
  }, [deals]);

  const filteredDeals = useMemo(() => {
    let list: Deal[];
    if (activeFilter === "open") {
      list = deals.filter((d) => OPEN_STAGES.includes(d.stage));
    } else if (activeFilter === "delivered") {
      list = deals.filter(
        (d) =>
          d.stage === "delivered" ||
          (d.stage === "defect_reorder" && isDefectResolved(d)),
      );
    } else if (activeFilter === "defect") {
      list = deals.filter(
        (d) => d.stage === "defect_reorder" && !isDefectResolved(d),
      );
    } else if (activeFilter === "cancelled") {
      list = deals.filter((d) => d.stage === "cancelled");
    } else {
      list = deals.filter((d) => d.stage !== "cancelled");
    }
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "amount_isk") {
        cmp = Number(a.amount_isk ?? 0) - Number(b.amount_isk ?? 0);
      } else {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [deals, activeFilter, sortKey, sortDir]);

  const totalAmount = useMemo(() => {
    return filteredDeals.reduce((sum, d) => {
      const base = Number(d.amount_isk ?? 0);
      if (
        d.stage === "defect_reorder" &&
        isDefectResolved(d) &&
        d.defect_resolution === "refund" &&
        d.refund_amount_isk != null
      ) {
        return sum + (base - Number(d.refund_amount_isk));
      }
      return sum + base;
    }, 0);
  }, [filteredDeals]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (deals.length === 0) {
    return (
      <>
        <EmptyState label={t.nav.deals} onAdd={openCreate} />
        <DealDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          form={form}
          setForm={setForm}
          contacts={contacts}
          saving={saving}
          onSave={handleSave}
        />
      </>
    );
  }

  const pills: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "open", label: t.deal.filterOpen, count: counts.open },
    { key: "delivered", label: t.deal.filterDelivered, count: counts.delivered },
    { key: "defect", label: t.deal.filterDefect, count: counts.defect },
    { key: "cancelled", label: t.deal.filterCancelled, count: counts.cancelled },
  ];

  const visiblePills = activeFilter
    ? pills.filter((p) => p.key === activeFilter)
    : pills;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {visiblePills.map((p) => {
            const isActive = activeFilter === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() =>
                  setActiveFilter(isActive ? null : p.key)
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  isActive
                    ? "border-ide-navy bg-ide-navy text-white"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                <span>
                  {p.label} ({p.count})
                </span>
                {isActive && <X className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
        <Button
          onClick={openCreate}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          <Plus className="mr-1 h-4 w-4" />
          {t.actions.create} {t.nav.dealSingle.toLowerCase()}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("created_at")}
                  className={cn(
                    "inline-flex items-center gap-1 hover:text-foreground transition-colors",
                    sortKey === "created_at" ? "text-ide-navy font-semibold" : "text-muted-foreground",
                  )}
                >
                  {t.deal.so_number}
                  {sortKey === "created_at" &&
                    (sortDir === "desc" ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUp className="h-3 w-3" />
                    ))}
                </button>
              </TableHead>
              <TableHead>{t.deal.name}</TableHead>
              <TableHead>{t.deal.stage}</TableHead>
              <TableHead className="text-right">
                <button
                  type="button"
                  onClick={() => toggleSort("amount_isk")}
                  className={cn(
                    "inline-flex items-center gap-1 hover:text-foreground transition-colors",
                    sortKey === "amount_isk" ? "text-ide-navy font-semibold" : "text-muted-foreground",
                  )}
                >
                  {t.deal.amount_isk}
                  {sortKey === "amount_isk" &&
                    (sortDir === "desc" ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUp className="h-3 w-3" />
                    ))}
                </button>
              </TableHead>
              <TableHead>{t.deal.invoice_status}</TableHead>
              <TableHead>{t.deal.promised_delivery_date}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDeals.map((d) => {
              const resolved = isDefectResolved(d);
              const showDelivered = d.stage === "delivered" || resolved;
              const dateValue = showDelivered ? d.delivered_at : d.promised_delivery_date;
              const dateLabel = showDelivered ? t.deal.deliveredOn : t.deal.estimatedDelivery;
              const dateLabelClass = showDelivered ? "text-green-700" : "text-muted-foreground";
              const overdue = !showDelivered && isOverdue(d.promised_delivery_date, d.stage, resolved);
              return (
                <TableRow
                  key={d.id}
                  onClick={() => onOpenDeal(d.id)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono text-xs">
                    <div className="inline-flex items-center gap-1.5">
                      <span>{d.so_number}</span>
                      <button
                        type="button"
                        onClick={(e) => handleCopySo(e, d.id, d.so_number)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`Afrita ${d.so_number}`}
                        title="Afrita sölunúmer"
                      >
                        {copiedId === d.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stageColors[d.stage]}`}
                    >
                      {t.dealStage[d.stage]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIsk(Number(d.amount_isk ?? 0))}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t.invoiceStatus[d.invoice_status]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className={cn("text-[10px]", dateLabelClass)}>{dateLabel}</div>
                    <div className={cn("text-sm", overdue && "text-destructive font-medium")}>
                      {dateValue ? formatDate(dateValue) : "—"}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex justify-end border-t border-border px-4 py-2 text-sm text-muted-foreground tabular-nums">
          <span>
            {t.deal.total} ({filteredDeals.length}):{" "}
            <span className="ml-2 font-medium">{formatIsk(totalAmount)}</span>
          </span>
        </div>
      </div>

      <DealDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        form={form}
        setForm={setForm}
        contacts={contacts}
        saving={saving}
        onSave={handleSave}
      />
    </div>
  );
}

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormState;
  setForm: (form: FormState) => void;
  contacts: Contact[];
  saving: boolean;
  onSave: () => void;
}

function DealDrawer({ open, onOpenChange, form, setForm, contacts, saving, onSave }: DrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {t.actions.create} {t.nav.dealSingle.toLowerCase()}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-3 py-4">
          <div>
            <Label>
              {t.deal.name} <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>{t.deal.stage}</Label>
            <Select
              value={form.stage}
              onValueChange={(v) => setForm({ ...form, stage: v as DealStage })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dealStageOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t.dealStage[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t.deal.amount_isk}</Label>
            <Input
              type="number"
              value={form.amount_isk}
              onChange={(e) => setForm({ ...form, amount_isk: e.target.value })}
            />
          </div>
          <div>
            <Label>{t.deal.promised_delivery_date}</Label>
            <Input
              type="date"
              value={form.promised_delivery_date}
              onChange={(e) =>
                setForm({ ...form, promised_delivery_date: e.target.value })
              }
            />
          </div>
          <div>
            <Label>{t.nav.contacts}</Label>
            <Select
              value={form.contact_id || "__none"}
              onValueChange={(v) =>
                setForm({ ...form, contact_id: v === "__none" ? "" : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t.deal.notes}</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={4}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.actions.cancel}
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {saving ? t.status.saving : t.actions.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
