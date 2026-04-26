import { useState } from "react";
import { toast } from "sonner";
import { ImageIcon, MoreVertical, Plus } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "./EmptyState";

type Design = Pick<
  Database["public"]["Tables"]["designs"]["Row"],
  "id" | "name" | "thumbnail_url" | "tags" | "notes" | "created_at"
>;

interface Props {
  companyId: string;
  designs: Design[];
  onChanged: () => void;
}

type FormState = {
  name: string;
  tags: string;
  notes: string;
  thumbnail_url: string;
};

const emptyForm: FormState = { name: "", tags: "", notes: "", thumbnail_url: "" };

export function DesignsTab({ companyId, designs, onChanged }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDrawerOpen(true);
  };

  const openEdit = (d: Design) => {
    setEditingId(d.id);
    setForm({
      name: d.name,
      tags: (d.tags ?? []).join(", "),
      notes: d.notes ?? "",
      thumbnail_url: d.thumbnail_url ?? "",
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    setSaving(true);
    const tags = form.tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      company_id: companyId,
      name: form.name.trim(),
      tags,
      notes: form.notes.trim() || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from("designs").update(payload).eq("id", editingId)
      : await supabase.from("designs").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    setDrawerOpen(false);
    onChanged();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`${t.status.areYouSure} ${t.status.cannotBeUndone}`)) return;
    const { error } = await supabase.from("designs").delete().eq("id", id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    onChanged();
  };

  const drawer = (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {editingId ? t.actions.edit : t.actions.add} {t.nav.designs.toLowerCase()}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-3 py-4">
          <div>
            <Label>
              {t.design.name} <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>{t.design.tags}</Label>
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="merki1, merki2"
            />
          </div>
          <div>
            <Label>{t.design.thumbnail_url}</Label>
            <Input
              value={form.thumbnail_url}
              onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
            />
          </div>
          <div>
            <Label>{t.design.notes}</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={4}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>
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
  );

  if (designs.length === 0) {
    return (
      <>
        <EmptyState label={t.nav.designs} onAdd={openAdd} />
        {drawer}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          onClick={openAdd}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          <Plus className="mr-1 h-4 w-4" />
          {t.actions.add} {t.nav.designs.toLowerCase()}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {designs.map((d) => (
          <div
            key={d.id}
            className="overflow-hidden rounded-md border border-border bg-card"
          >
            {d.thumbnail_url ? (
              <img
                src={d.thumbnail_url}
                alt={d.name}
                className="h-40 w-full object-cover"
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center bg-muted text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
              </div>
            )}
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground">{d.name}</h3>
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
                    <DropdownMenuItem onClick={() => openEdit(d)}>
                      {t.actions.edit}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(d.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      {t.actions.delete}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {d.tags && d.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {d.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {d.notes && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {d.notes}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {formatDate(d.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {drawer}
    </div>
  );
}
