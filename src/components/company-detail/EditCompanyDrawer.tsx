import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { maskKennitalaInput, stripKennitala, isValidKennitala } from "@/lib/formatters";
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

type Company = Database["public"]["Tables"]["companies"]["Row"];
type VskStatus = Database["public"]["Enums"]["vsk_status"];

const vskStatuses: VskStatus[] = ["standard", "reduced", "export_exempt", "none"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
  onSaved: () => void;
}

type FormState = {
  name: string;
  kennitala: string;
  vsk_number: string;
  vsk_status: VskStatus;
  email: string;
  phone: string;
  website: string;
  address_line_1: string;
  address_line_2: string;
  postcode: string;
  city: string;
  country: string;
  preferred_currency: string;
  payment_terms_days: string;
  notes: string;
};

function fromCompany(c: Company): FormState {
  return {
    name: c.name,
    kennitala: c.kennitala ? maskKennitalaInput(c.kennitala) : "",
    vsk_number: c.vsk_number ?? "",
    vsk_status: c.vsk_status,
    email: c.email ?? "",
    phone: c.phone ?? "",
    website: c.website ?? "",
    address_line_1: c.address_line_1 ?? "",
    address_line_2: c.address_line_2 ?? "",
    postcode: c.postcode ?? "",
    city: c.city ?? "",
    country: c.country ?? "",
    preferred_currency: c.preferred_currency,
    payment_terms_days: String(c.payment_terms_days),
    notes: c.notes ?? "",
  };
}

export function EditCompanyDrawer({ open, onOpenChange, company, onSaved }: Props) {
  const initialForm = useMemo(() => fromCompany(company), [company]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) setForm(fromCompany(company));
  }, [open, company]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const requestClose = () => {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleSheetOpenChange = (next: boolean) => {
    if (!next) {
      requestClose();
      return;
    }
    onOpenChange(next);
  };

  const discardAndClose = () => {
    setForm(initialForm);
    setConfirmOpen(false);
    onOpenChange(false);
  };

  const saveFromConfirm = async () => {
    setConfirmOpen(false);
    await handleSave();
  };

  const kennitalaError =
    form.kennitala.trim().length > 0 && !isValidKennitala(form.kennitala)
      ? "Kennitala verður að vera 10 tölustafir"
      : null;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    if (kennitalaError) {
      toast.error(kennitalaError);
      return;
    }
    setSaving(true);
    const terms = parseInt(form.payment_terms_days, 10);
    const cleanKennitala = stripKennitala(form.kennitala);
    const { error } = await supabase
      .from("companies")
      .update({
        name: form.name.trim(),
        kennitala: cleanKennitala || null,
        vsk_number: form.vsk_number.trim() || null,
        vsk_status: form.vsk_status,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        address_line_1: form.address_line_1.trim() || null,
        address_line_2: form.address_line_2.trim() || null,
        postcode: form.postcode.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        preferred_currency: form.preferred_currency.trim() || "ISK",
        payment_terms_days: Number.isFinite(terms) ? terms : 14,
        notes: form.notes.trim() || null,
      })
      .eq("id", company.id);
    setSaving(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    onOpenChange(false);
    onSaved();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {t.actions.edit} — {company.name}
          </SheetTitle>
        </SheetHeader>

        <div className="grid gap-3 py-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>
              {t.company.name} <span className="text-destructive">*</span>
            </Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <Label>{t.company.kennitala}</Label>
            <Input
              value={form.kennitala}
              onChange={(e) => update("kennitala", maskKennitalaInput(e.target.value))}
              placeholder="XXXXXX-XXXX"
              inputMode="numeric"
              maxLength={11}
            />
            {kennitalaError && (
              <p className="mt-1 text-xs text-destructive">{kennitalaError}</p>
            )}
          </div>
          <div>
            <Label>{t.company.vsk_number}</Label>
            <Input
              value={form.vsk_number}
              onChange={(e) => update("vsk_number", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>{t.company.vsk_status}</Label>
            <Select
              value={form.vsk_status}
              onValueChange={(v) => update("vsk_status", v as VskStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vskStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t.vskStatus[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t.company.email}</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
          <div>
            <Label>{t.company.phone}</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>{t.company.website}</Label>
            <Input
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>{t.company.address_line_1}</Label>
            <Input
              value={form.address_line_1}
              onChange={(e) => update("address_line_1", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>{t.company.address_line_2}</Label>
            <Input
              value={form.address_line_2}
              onChange={(e) => update("address_line_2", e.target.value)}
            />
          </div>
          <div>
            <Label>{t.company.postcode}</Label>
            <Input
              value={form.postcode}
              onChange={(e) => update("postcode", e.target.value)}
            />
          </div>
          <div>
            <Label>{t.company.city}</Label>
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
          </div>
          <div>
            <Label>{t.company.country}</Label>
            <CountrySelect
              value={form.country}
              onValueChange={(v) => update("country", v)}
            />
          </div>
          <div>
            <Label>{t.company.preferred_currency}</Label>
            <CurrencySelect
              value={form.preferred_currency || "ISK"}
              onValueChange={(v) => update("preferred_currency", v)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>{t.company.payment_terms_days}</Label>
            <Input
              type="number"
              value={form.payment_terms_days}
              onChange={(e) => update("payment_terms_days", e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>{t.company.notes}</Label>
            <Textarea
              rows={4}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="ghost" onClick={requestClose} disabled={saving}>
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
            <AlertDialogDescription>{t.status.unsavedChangesBody}</AlertDialogDescription>
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
