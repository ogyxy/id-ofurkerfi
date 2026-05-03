import { useState, useEffect, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { X, ExternalLink, Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/sala_translations_is";
import { Input } from "@/components/ui/input";
import {
  fetchLinkedPos,
  findDuplicateTrackingPo,
  addTrackingNumber,
  removeTrackingNumber,
  type LinkedPo,
} from "@/lib/poSoSync";

interface Props {
  poId: string;
  dealId: string | null;
  initial: string[];
}

function getTrackingUrl(trackingNumber: string): string {
  return `https://packageradar.com/${encodeURIComponent(trackingNumber)}`;
}

export function PoTrackingNumbersInline({ poId, dealId, initial }: Props) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siblingPos, setSiblingPos] = useState<LinkedPo[]>([]);

  useEffect(() => setTags(initial), [initial]);

  useEffect(() => {
    if (!dealId) return;
    void (async () => {
      const list = await fetchLinkedPos(supabase, dealId);
      setSiblingPos(list);
    })();
  }, [dealId, poId]);

  const addTag = async (val: string) => {
    const v = val.trim();
    if (!v || tags.includes(v)) {
      setDraft("");
      setAdding(false);
      setError(null);
      return;
    }
    // Dedup against sibling POs of same SO
    if (dealId) {
      const dupPo = findDuplicateTrackingPo(siblingPos, v, poId);
      if (dupPo) {
        setError(t.deal.trackingDuplicate.replace("{po}", dupPo));
        return;
      }
    }
    const next = [...tags, v];
    setTags(next);
    setDraft("");
    setAdding(false);
    setError(null);

    if (dealId) {
      const { error: err } = await addTrackingNumber(supabase, {
        dealId,
        poId,
        tracking: v,
      });
      if (err) {
        toast.error(t.status.somethingWentWrong);
        setTags(initial);
      }
      // refresh siblings (so future dedup is current)
      const list = await fetchLinkedPos(supabase, dealId);
      setSiblingPos(list);
    } else {
      // No linked deal: just write the PO directly
      const { error: err } = await supabase.from("purchase_orders").update({ tracking_numbers: next }).eq("id", poId);
      if (err) toast.error(t.status.somethingWentWrong);
    }
  };

  const removeTag = async (v: string) => {
    const next = tags.filter((x) => x !== v);
    setTags(next);
    if (dealId) {
      const { error: err } = await removeTrackingNumber(supabase, {
        source: "po",
        poId,
        dealId,
        tracking: v,
      });
      if (err) toast.error(t.status.somethingWentWrong);
      const list = await fetchLinkedPos(supabase, dealId);
      setSiblingPos(list);
    } else {
      const { error: err } = await supabase.from("purchase_orders").update({ tracking_numbers: next }).eq("id", poId);
      if (err) toast.error(t.status.somethingWentWrong);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void addTag(draft);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft("");
      setAdding(false);
      setError(null);
    }
  };

  const inputBlock = (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Input
        autoFocus
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={onKey}
        placeholder={t.deal.tracking_numbers}
        className="h-7 w-48 px-2 py-0 text-xs"
      />
      <button
        type="button"
        onClick={() => void addTag(draft)}
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
          setError(null);
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        aria-label="cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
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
              onClick={() => void removeTag(tag)}
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
      {adding && error && <span className="text-[11px] text-destructive">{error}</span>}
    </div>
  );
}
