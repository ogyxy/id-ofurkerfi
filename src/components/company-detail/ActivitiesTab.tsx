import { useState } from "react";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatDate } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "./EmptyState";

type ActivityType = Database["public"]["Enums"]["activity_type"];
type Activity = Pick<
  Database["public"]["Tables"]["activities"]["Row"],
  "id" | "type" | "subject" | "body" | "created_at" | "due_date" | "completed"
>;

interface Props {
  companyId: string;
  activities: Activity[];
  onChanged: () => void;
}

const activityTypes: ActivityType[] = ["note", "call", "email", "meeting", "task"];

const typeIcons: Record<ActivityType, string> = {
  note: "📝",
  call: "📞",
  email: "📧",
  meeting: "👥",
  task: "✅",
};

type FormState = {
  type: ActivityType;
  subject: string;
  body: string;
  due_date: string;
};

const emptyForm: FormState = { type: "note", subject: "", body: "", due_date: "" };

function dueClass(dueDate: string | null, completed: boolean): string {
  if (!dueDate || completed) return "";
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d <= today) return "text-amber-600 font-medium";
  return "";
}

export function ActivitiesTab({ companyId, activities, onChanged }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("activities").insert({
      company_id: companyId,
      type: form.type,
      subject: form.subject.trim() || null,
      body: form.body.trim() || null,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
    });
    setSaving(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    setShowForm(false);
    setForm(emptyForm);
    onChanged();
  };

  if (activities.length === 0 && !showForm) {
    return <EmptyState label={t.nav.activities} onAdd={openAdd} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <Button
          onClick={openAdd}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          <Plus className="mr-1 h-4 w-4" />
          {t.actions.add} {t.nav.activities.toLowerCase()}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>{t.activity.type}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as ActivityType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activityTypes.map((tp) => (
                    <SelectItem key={tp} value={tp}>
                      {typeIcons[tp]} {t.activityType[tp]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.activity.due_date}</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>{t.activity.subject}</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>{t.activity.body}</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={saving}>
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

      <ol className="space-y-3 border-l-2 border-border pl-4">
        {activities.map((a) => (
          <li
            key={a.id}
            className={`rounded-md border border-border bg-card p-4 ${
              a.completed ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-xl" aria-hidden>
                  {typeIcons[a.type]}
                </span>
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t.activityType[a.type]}
                  </div>
                  {a.subject && (
                    <div className="font-semibold text-foreground">{a.subject}</div>
                  )}
                  {a.body && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {a.body}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{formatDate(a.created_at)}</span>
                    {a.due_date && !a.completed && (
                      <span className={dueClass(a.due_date, a.completed)}>
                        {t.activity.due_date}: {formatDate(a.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {a.completed && (
                <Check className="h-5 w-5 flex-shrink-0 text-green-600" />
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
