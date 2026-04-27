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

type ActivityType = Database["public"]["Enums"]["activity_type"];
type Activity = Pick<
  Database["public"]["Tables"]["activities"]["Row"],
  "id" | "type" | "subject" | "body" | "created_at" | "due_date" | "completed"
>;

interface Props {
  dealId: string;
  companyId: string;
  activities: Activity[];
  onChanged: () => Promise<void>;
}

const TYPES: ActivityType[] = ["note", "call", "email", "meeting", "task"];
const ICONS: Record<ActivityType, string> = {
  note: "📝",
  call: "📞",
  email: "📧",
  meeting: "👥",
  task: "✅",
  defect_note: "⚠️",
};

export function DealActivitiesTab({
  dealId,
  companyId,
  activities,
  onChanged,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<ActivityType>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("activities").insert({
      deal_id: dealId,
      company_id: companyId,
      type,
      subject: subject.trim() || null,
      body: body.trim() || null,
      due_date: due ? new Date(due).toISOString() : null,
    });
    setSaving(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    setShowForm(false);
    setSubject("");
    setBody("");
    setDue("");
    setType("note");
    await onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {t.nav.activities} ({activities.length})
        </h2>
        <Button
          onClick={() => setShowForm((s) => !s)}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          <Plus className="mr-1 h-4 w-4" />
          {t.actions.add}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>{t.activity.type}</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as ActivityType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>
                      {ICONS[tp]} {t.activityType[tp]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.activity.due_date}</Label>
              <Input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>{t.activity.subject}</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>{t.activity.body}</Label>
              <Textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowForm(false)}
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
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t.status.noDataYet}
        </div>
      ) : (
        <ol className="space-y-3 border-l-2 border-border pl-4">
          {activities.map((a) => {
            const isDefect = a.type === "defect_note";
            return (
            <li
              key={a.id}
              className={`rounded-md border bg-card p-4 ${
                isDefect
                  ? "border-l-4 border-l-orange-500 border-orange-200"
                  : "border-border"
              } ${a.completed ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl">{ICONS[a.type]}</span>
                  <div className="space-y-1">
                    <div className="text-xs uppercase text-muted-foreground">
                      {t.activityType[a.type]}
                    </div>
                    {a.subject && (
                      <div className="font-semibold">{a.subject}</div>
                    )}
                    {a.body && (
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {a.body}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{formatDate(a.created_at)}</span>
                      {a.due_date && (
                        <span>
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
          );})}
        </ol>
      )}
    </div>
  );
}
