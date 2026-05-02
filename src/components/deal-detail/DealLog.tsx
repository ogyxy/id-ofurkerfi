import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatDate, formatTime } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type DealStage = Database["public"]["Enums"]["deal_stage"];

export type LogEntry = {
  id: string;
  type: "note" | "stage_change" | "defect_note";
  body: string | null;
  created_at: string;
  profile: { id: string; name: string | null } | null;
};

interface Props {
  dealId: string;
  companyId: string;
  entries: LogEntry[];
  currentProfile: { id: string; name: string | null } | null;
  onChanged: () => Promise<void> | void;
  onLocalAppend?: (entry: LogEntry) => void;
}

const NAVY = "#1a2540";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, size = 36 }: { name: string | null | undefined; size?: number }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: NAVY,
        fontSize: size <= 28 ? 11 : 13,
      }}
    >
      {initials(name)}
    </div>
  );
}

const STAGE_TONES: Record<DealStage, string> = {
  inquiry: "bg-gray-100 text-gray-800 border-gray-300",
  quote_in_progress: "bg-blue-100 text-blue-800 border-blue-300",
  quote_sent: "bg-indigo-100 text-indigo-800 border-indigo-300",
  order_confirmed: "bg-amber-100 text-amber-800 border-amber-300",
  delivered: "bg-green-100 text-green-800 border-green-300",
  ready_for_pickup: "bg-teal-100 text-teal-800 border-teal-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
  defect_reorder: "bg-orange-100 text-orange-800 border-orange-300",
};

function StageBadge({ stage }: { stage: string }) {
  const known = stage as DealStage;
  const tone = STAGE_TONES[known] ?? "bg-gray-100 text-gray-800 border-gray-300";
  const label = t.dealStage[known] ?? stage;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      {label}
    </span>
  );
}

function timestamp(iso: string) {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function DealLog({
  dealId,
  companyId,
  entries,
  currentProfile,
  onChanged,
  onLocalAppend,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [localEntries, setLocalEntries] = useState<LogEntry[]>([]);

  // Reset local entries whenever server-provided entries change
  useEffect(() => {
    setLocalEntries([]);
  }, [entries]);

  const merged = [...localEntries, ...entries];

  const submit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("activities")
      .insert({
        deal_id: dealId,
        company_id: companyId,
        type: "note",
        body,
        created_by: currentProfile?.id ?? null,
      })
      .select("id, type, body, created_at")
      .single();
    setSending(false);
    if (error || !data) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    const optimistic: LogEntry = {
      id: data.id,
      type: "note",
      body: data.body,
      created_at: data.created_at,
      profile: currentProfile,
    };
    setLocalEntries((p) => [optimistic, ...p]);
    onLocalAppend?.(optimistic);
    setText("");
    void onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t.log.title}</h2>
      </div>

      {/* Input */}
      <div className="rounded-md border border-border bg-card p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Avatar name={currentProfile?.name} />
          <div className="flex-1 space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder={t.log.placeholder}
              className="resize-none"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                onClick={() => void submit()}
                disabled={!text.trim() || sending}
                className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                size="sm"
              >
                {t.log.send}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed */}
      {merged.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t.log.noEntries}
        </div>
      ) : (
        <ul className="space-y-3">
          {merged.map((entry) => {
            if (entry.type === "stage_change") {
              return (
                <li key={entry.id} className="flex items-center gap-3 px-1">
                  <span className="h-px flex-1 bg-border" />
                  <span
                    className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: NAVY }}
                  />
                  <span className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <span>{t.log.stageChanged}</span>
                    {entry.body && <StageBadge stage={entry.body} />}
                    {entry.profile?.name && (
                      <>
                        <span>{t.log.by}</span>
                        <span>{entry.profile.name}</span>
                      </>
                    )}
                    <span>{t.log.by}</span>
                    <span>{timestamp(entry.created_at)}</span>
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </li>
              );
            }

            const isMine =
              currentProfile && entry.profile?.id === currentProfile.id;
            const isDefect = entry.type === "defect_note";

            return (
              <li
                key={entry.id}
                className={cn(
                  "rounded-md border p-3",
                  isDefect
                    ? "border-l-4 border-l-amber-400 border-amber-200 bg-amber-50/40"
                    : isMine
                      ? "border-blue-200 bg-blue-50"
                      : "border-gray-200 bg-card",
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={entry.profile?.name} />
                  <div className="min-w-0 flex-1">
                    {isDefect && (
                      <div className="mb-0.5 flex items-center gap-1 text-xs font-medium text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t.log.defectEntry}
                      </div>
                    )}
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="font-semibold text-foreground">
                        {entry.profile?.name ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {timestamp(entry.created_at)}
                      </span>
                    </div>
                    {entry.body && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                        {entry.body}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
