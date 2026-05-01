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
  notes: string;
};

function fromDeal(d: Deal): FormState {
  return {
    name: d.name,
    contact_id: d.contact_id ?? "",
    owner_id: d.owner_id ?? "",
    promised_delivery_date: d.promised_delivery_date ?? "",
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
          <div className="grid gap-4 py-4">
            <div>
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
