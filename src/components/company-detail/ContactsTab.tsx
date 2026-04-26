import { useState } from "react";
import { toast } from "sonner";
import { MoreVertical, Plus, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "./EmptyState";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

interface Props {
  companyId: string;
  contacts: Contact[];
  onChanged: () => void;
}

type FormState = {
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone: string;
  is_primary: boolean;
  notes: string;
};

const emptyForm: FormState = {
  first_name: "",
  last_name: "",
  title: "",
  email: "",
  phone: "",
  is_primary: false,
  notes: "",
};

function getInitials(c: Contact): string {
  const f = (c.first_name ?? "").trim();
  const l = (c.last_name ?? "").trim();
  return ((f[0] ?? "") + (l[0] ?? "")).toUpperCase() || "?";
}

export function ContactsTab({ companyId, contacts, onChanged }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (c: Contact) => {
    setEditingId(c.id);
    setForm({
      first_name: c.first_name ?? "",
      last_name: c.last_name ?? "",
      title: c.title ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      is_primary: c.is_primary,
      notes: c.notes ?? "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      company_id: companyId,
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      title: form.title.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      is_primary: form.is_primary,
      notes: form.notes.trim() || null,
    };

    const { error } = editingId
      ? await supabase.from("contacts").update(payload).eq("id", editingId)
      : await supabase.from("contacts").insert(payload);

    setSaving(false);

    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    closeForm();
    onChanged();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`${t.status.areYouSure} ${t.status.cannotBeUndone}`)) return;
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    onChanged();
  };

  if (contacts.length === 0 && !showForm) {
    return <EmptyState label={t.nav.contactSingle} onAdd={openAdd} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          onClick={openAdd}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          <Plus className="mr-1 h-4 w-4" />
          {t.actions.add} {t.nav.contactSingle}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>{t.contact.first_name}</Label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </div>
            <div>
              <Label>{t.contact.last_name}</Label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
            <div>
              <Label>{t.contact.title}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label>{t.contact.email}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>{t.contact.phone}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="is_primary"
                checked={form.is_primary}
                onCheckedChange={(v) => setForm({ ...form, is_primary: v === true })}
              />
              <Label htmlFor="is_primary" className="cursor-pointer">
                {t.contact.is_primary}
              </Label>
            </div>
            <div className="md:col-span-2">
              <Label>{t.contact.notes}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={closeForm} disabled={saving}>
              {t.actions.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {saving ? t.status.saving : t.actions.save}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {contacts.map((c) => (
          <div
            key={c.id}
            className="flex items-start justify-between rounded-md border border-border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ide-navy text-sm font-medium text-white">
                {getInitials(c)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                  </span>
                  {c.is_primary && (
                    <span className="inline-flex items-center rounded-full bg-ide-navy px-2 py-0.5 text-xs text-white">
                      {t.contact.is_primary}
                    </span>
                  )}
                </div>
                {c.title && (
                  <div className="text-sm text-muted-foreground">{c.title}</div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="hidden flex-col gap-1 text-right text-sm sm:flex">
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="inline-flex items-center justify-end gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {c.email}
                  </a>
                )}
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center justify-end gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {c.phone}
                  </a>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="menu"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(c)}>
                    {t.actions.edit}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDelete(c.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    {t.actions.delete}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
