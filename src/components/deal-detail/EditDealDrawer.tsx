import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
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

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type Contact = Pick<
  Database["public"]["Tables"]["contacts"]["Row"],
  "id" | "first_name" | "last_name" | "email"
>;
type Profile = { id: string; name: string | null; email: string };
type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

const INVOICE: InvoiceStatus[] = ["not_invoiced", "partial", "full"];
const PAYMENT: PaymentStatus[] = ["unpaid", "partial", "paid"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deal: Deal;
  contacts: Contact[];
  profiles: Profile[];
  onSaved: () => Promise<void>;
}

type FormState = {
  name: string;
  contact_id: string;
  owner_id: string;
  promised_delivery_date: string;
  // estimated_delivery_date is intentionally omitted — it can only be edited from /innkaup/:id
  invoice_status: InvoiceStatus;
  payment_status: PaymentStatus;
  invoice_date: string;
  amount_invoiced_isk: string;
  amount_paid_isk: string;
  paid_at: string;
  payday_invoice_number: string;
  notes: string;
};

function fromDeal(d: Deal): FormState {
  return {
    name: d.name,
    contact_id: d.contact_id ?? "",
    owner_id: d.owner_id ?? "",
    promised_delivery_date: d.promised_delivery_date ?? "",
    estimated_delivery_date: d.estimated_delivery_date ?? "",
    invoice_status: d.invoice_status,
    payment_status: d.payment_status,
    invoice_date: d.invoice_date ?? "",
    amount_invoiced_isk: d.amount_invoiced_isk?.toString() ?? "",
    amount_paid_isk: d.amount_paid_isk?.toString() ?? "",
    paid_at: d.paid_at ?? "",
    payday_invoice_number: d.payday_invoice_number ?? "",
    notes: d.notes ?? "",
  };
}

export function EditDealDrawer({
  open,
  onOpenChange,
  deal,
  contacts,
  profiles,
  onSaved,
}: Props) {
  const initial = useMemo(() => fromDeal(deal), [deal]);
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) setForm(fromDeal(deal));
  }, [open, deal]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial],
  );

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const requestClose = () => {
    if (isDirty) setConfirmOpen(true);
    else onOpenChange(false);
  };

  const handleSheetOpenChange = (next: boolean) => {
    if (!next) requestClose();
    else onOpenChange(next);
  };

  const discardAndClose = () => {
    setForm(initial);
    setConfirmOpen(false);
    onOpenChange(false);
  };

  const saveFromConfirm = async () => {
    setConfirmOpen(false);
    await handleSave();
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("deals")
      .update({
        name: form.name.trim(),
        contact_id: form.contact_id || null,
        owner_id: form.owner_id || null,
        promised_delivery_date: form.promised_delivery_date || null,
        estimated_delivery_date: form.estimated_delivery_date || null,
        invoice_status: form.invoice_status,
        payment_status: form.payment_status,
        invoice_date: form.invoice_date || null,
        amount_invoiced_isk: form.amount_invoiced_isk
          ? Number(form.amount_invoiced_isk)
          : null,
        amount_paid_isk: form.amount_paid_isk
          ? Number(form.amount_paid_isk)
          : null,
        paid_at: form.paid_at || null,
        payday_invoice_number: form.payday_invoice_number.trim() || null,
        notes: form.notes.trim() || null,
      })
      .eq("id", deal.id);
    setSaving(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    onOpenChange(false);
    await onSaved();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {t.actions.edit} — {deal.name}
            </SheetTitle>
          </SheetHeader>
          <div className="grid gap-3 py-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>
                {t.deal.name} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>
            <div>
              <Label>{t.nav.contactSingle}</Label>
              <Select
                value={form.contact_id || "__none"}
                onValueChange={(v) =>
                  update("contact_id", v === "__none" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                        c.email ||
                        c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.deal.owner_id}</Label>
              <Select
                value={form.owner_id || "__none"}
                onValueChange={(v) =>
                  update("owner_id", v === "__none" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.deal.promised_delivery_date}</Label>
              <Input
                type="date"
                value={form.promised_delivery_date}
                onChange={(e) =>
                  update("promised_delivery_date", e.target.value)
                }
              />
            </div>
            <div>
              <Label>{t.deal.estimated_delivery_date}</Label>
              <Input
                type="date"
                value={form.estimated_delivery_date}
                onChange={(e) =>
                  update("estimated_delivery_date", e.target.value)
                }
              />
            </div>
            <div>
              <Label>{t.deal.invoice_status}</Label>
              <Select
                value={form.invoice_status}
                onValueChange={(v) =>
                  update("invoice_status", v as InvoiceStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t.invoiceStatus[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.deal.payment_status}</Label>
              <Select
                value={form.payment_status}
                onValueChange={(v) =>
                  update("payment_status", v as PaymentStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t.paymentStatus[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.deal.invoice_date}</Label>
              <Input
                type="date"
                value={form.invoice_date}
                onChange={(e) => update("invoice_date", e.target.value)}
              />
            </div>
            <div>
              <Label>{t.deal.payday_invoice_number}</Label>
              <Input
                value={form.payday_invoice_number}
                onChange={(e) =>
                  update("payday_invoice_number", e.target.value)
                }
              />
            </div>
            <div>
              <Label>{t.deal.amount_invoiced_isk}</Label>
              <Input
                type="number"
                value={form.amount_invoiced_isk}
                onChange={(e) =>
                  update("amount_invoiced_isk", e.target.value)
                }
              />
            </div>
            <div>
              <Label>{t.deal.amount_paid_isk}</Label>
              <Input
                type="number"
                value={form.amount_paid_isk}
                onChange={(e) => update("amount_paid_isk", e.target.value)}
              />
            </div>
            <div>
              <Label>{t.deal.paid_at}</Label>
              <Input
                type="date"
                value={form.paid_at}
                onChange={(e) => update("paid_at", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>{t.deal.notes}</Label>
              <Textarea
                rows={4}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              variant="ghost"
              onClick={requestClose}
              disabled={saving}
            >
              {t.actions.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {saving ? t.status.saving : t.actions.save}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.status.unsavedChanges}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.status.unsavedChangesBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={discardAndClose}>
              {t.status.discardChanges}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={saveFromConfirm}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {t.status.saveChanges}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
