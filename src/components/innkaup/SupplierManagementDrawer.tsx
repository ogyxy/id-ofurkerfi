import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, ArrowLeft, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { PO_CURRENCIES } from "@/lib/poConstants";
import { cn } from "@/lib/utils";

type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Called when drawer closes if the supplier list changed */
  onChanged?: () => void;
}

type Mode = { kind: "list" } | { kind: "edit"; supplier: Supplier } | { kind: "create" };

export function SupplierManagementDrawer({ open, onOpenChange, onChanged }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("suppliers").select("*").order("name");
    setSuppliers((data ?? []) as Supplier[]);
  };

  useEffect(() => {
    if (open) {
      void load();
      setMode({ kind: "list" });
      setDirty(false);
    }
  }, [open]);

  const handleClose = (o: boolean) => {
    onOpenChange(o);
    if (!o && dirty) onChanged?.();
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {mode.kind !== "list" && (
              <button
                type="button"
                onClick={() => setMode({ kind: "list" })}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {t.supplier.title}
          </SheetTitle>
        </SheetHeader>

        {mode.kind === "list" && (
          <div className="space-y-3 py-4">
            <Button
              onClick={() => setMode({ kind: "create" })}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              <Plus className="mr-1 h-4 w-4" />
              {t.supplier.addNew}
            </Button>

            {suppliers.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t.supplier.noSuppliers}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">{t.supplier.name}</th>
                    <th className="px-2 py-2 text-left">{t.supplier.default_currency}</th>
                    <th className="px-2 py-2 text-left">{t.supplier.active}</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setMode({ kind: "edit", supplier: s })}
                      className="cursor-pointer border-t border-border hover:bg-muted/40"
                    >
                      <td className="px-2 py-2 font-medium">{s.name}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {s.default_currency}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {s.active ? t.status.yes : t.status.no}
                      </td>
                      <td className="px-2 py-2 text-right text-muted-foreground">
                        <Pencil className="ml-auto h-3.5 w-3.5" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {mode.kind !== "list" && (
          <SupplierForm
            initial={mode.kind === "edit" ? mode.supplier : null}
            onSaved={async () => {
              setDirty(true);
              await load();
              setMode({ kind: "list" });
            }}
            onCancel={() => setMode({ kind: "list" })}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

interface FormProps {
  initial: Supplier | null;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}

function SupplierForm({ initial, onSaved, onCancel }: FormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [defaultCurrency, setDefaultCurrency] = useState(initial?.default_currency ?? "EUR");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contact_email ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      default_currency: defaultCurrency,
      website: website.trim() || null,
      contact_email: contactEmail.trim() || null,
      notes: notes.trim() || null,
      active,
    };
    const { error } = initial
      ? await supabase.from("suppliers").update(payload).eq("id", initial.id)
      : await supabase.from("suppliers").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    await onSaved();
  };

  return (
    <>
      <div className="space-y-3 py-4">
        <div>
          <Label>{t.supplier.name} *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>{t.supplier.default_currency}</Label>
          <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PO_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t.supplier.website}</Label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <div>
          <Label>{t.supplier.contact_email}</Label>
          <Input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </div>
        <div>
          <Label>{t.supplier.notes}</Label>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={active}
            onCheckedChange={(v) => setActive(Boolean(v))}
          />
          <span>{t.supplier.active}</span>
        </label>
      </div>

      <SheetFooter>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          {t.actions.cancel}
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className={cn("bg-ide-navy text-white hover:bg-ide-navy-hover")}
        >
          {saving ? t.status.saving : t.actions.save}
        </Button>
      </SheetFooter>
    </>
  );
}
