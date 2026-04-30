import { useState, useEffect, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { X, ExternalLink, Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/sala_translations_is";
import { Input } from "@/components/ui/input";

interface Props {
  poId: string;
  dealId: string | null;
  initial: string[];
}

function getTrackingUrl(trackingNumber: string): string {
  return `https://www.ordertracker.com/track/${encodeURIComponent(trackingNumber)}`;
}

export function PoTrackingNumbersInline({ poId, dealId, initial }: Props) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => setTags(initial), [initial]);

  const persist = async (next: string[], added?: string, removed?: string) => {
    const { error } = await supabase
      .from("purchase_orders")
      .update({ tracking_numbers: next })
      .eq("id", poId);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    // Union sync into deal: add to deal when added; never auto-remove from deal.
    if (dealId && added) {
      const { data: deal } = await supabase
        .from("deals")
        .select("tracking_numbers")
        .eq("id", dealId)
        .maybeSingle();
      const existing = (deal?.tracking_numbers ?? []) as string[];
      if (!existing.includes(added)) {
        await supabase
          .from("deals")
          .update({ tracking_numbers: [...existing, added] })
          .eq("id", dealId);
      }
    }
    void removed; // intentional: do not remove from deal on PO removal
  };

  const addTag = (val: string) => {
    const v = val.trim();
    if (!v || tags.includes(v)) {
      setDraft("");
      setAdding(false);
      return;
    }
    const next = [...tags, v];
    setTags(next);
    setDraft("");
    setAdding(false);
    void persist(next, v);
  };

  const removeTag = (v: string) => {
    const next = tags.filter((x) => x !== v);
    setTags(next);
    void persist(next, undefined, v);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft("");
      setAdding(false);
    }
  };

  const inputBlock = (
    <span className="inline-flex items-center gap-1">
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        placeholder={t.deal.tracking_numbers}
        className="h-7 w-48 px-2 py-0 text-xs"
      />
      <button
        type="button"
        onClick={() => addTag(draft)}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-ide-navy hover:bg-muted"
        aria-label="confirm"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          setDraft("");
          setAdding(false);
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        aria-label="cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
        >
          <a
            href={getTrackingUrl(tag)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-foreground hover:underline"
          >
            {tag}
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-muted-foreground hover:text-destructive"
            aria-label="remove"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {adding ? (
        inputBlock
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          {tags.length === 0 ? t.deal.tracking_numbers : t.actions.add}
        </button>
      )}
    </div>
  );
}
