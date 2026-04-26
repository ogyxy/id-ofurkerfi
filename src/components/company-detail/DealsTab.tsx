import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { EmptyState } from "./EmptyState";

type DealStage = Database["public"]["Enums"]["deal_stage"];
type Deal = {
  id: string;
  so_number: string;
  name: string;
  stage: DealStage;
  amount_isk: number | null;
  promised_delivery_date: string | null;
  invoice_status: Database["public"]["Enums"]["invoice_status"];
  payment_status: Database["public"]["Enums"]["payment_status"];
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

function isOverdue(date: string | null, stage: DealStage): boolean {
  if (!date) return false;
  if (stage === "delivered" || stage === "cancelled") return false;
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

export function DealsTab({ companyId, deals, contacts, onChanged, onOpenDeal }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
              <TableHead>{t.deal.so_number}</TableHead>
              <TableHead>{t.deal.name}</TableHead>
              <TableHead>{t.deal.stage}</TableHead>
              <TableHead className="text-right">{t.deal.amount_isk}</TableHead>
              <TableHead>{t.deal.invoice_status}</TableHead>
              <TableHead>{t.deal.promised_delivery_date}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((d) => {
              const overdue = isOverdue(d.promised_delivery_date, d.stage);
              return (
                <TableRow
                  key={d.id}
                  onClick={() => onOpenDeal(d.id)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono text-xs">{d.so_number}</TableCell>
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
                  <TableCell className={overdue ? "text-destructive font-medium" : ""}>
                    {formatDate(d.promised_delivery_date)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
