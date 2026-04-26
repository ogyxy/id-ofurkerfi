import { useState, useEffect, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/sala_translations_is";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  dealId: string;
  initial: string[];
}

export function TrackingNumbersField({ dealId, initial }: Props) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");

  useEffect(() => setTags(initial), [initial]);

  const persist = async (next: string[]) => {
    const { error } = await supabase
      .from("deals")
      .update({ tracking_numbers: next })
      .eq("id", dealId);
    if (error) {
      toast.error(t.status.somethingWentWrong);
    }
  };

  const addTag = (val: string) => {
    const v = val.trim();
    if (!v || tags.includes(v)) return;
    const next = [...tags, v];
    setTags(next);
    setDraft("");
    persist(next);
  };

  const removeTag = (v: string) => {
    const next = tags.filter((t) => t !== v);
    setTags(next);
    persist(next);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(draft);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">{t.deal.tracking_numbers}</Label>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-ide-navy/10 px-2 py-0.5 text-xs text-ide-navy"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-red-600"
              aria-label="remove"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => draft && addTag(draft)}
          placeholder="…"
          className="flex-1 min-w-[140px] border-0 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
