import { useState, useEffect, useMemo, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { X, ExternalLink, Plus, Check, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/sala_translations_is";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  fetchLinkedPos,
  findDuplicateTrackingPo,
  addTrackingNumber,
  removeTrackingNumber,
  type LinkedPo,
} from "@/lib/poSoSync";

interface Props {
  dealId: string;
  initial: string[];
}

function getTrackingUrl(trackingNumber: string): string {
  return `https://packageradar.com/${encodeURIComponent(trackingNumber)}`;
}

export function TrackingNumbersInline({ dealId, initial }: Props) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<LinkedPo[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  useEffect(() => setTags(initial), [initial]);

  const reloadPos = async () => {
    const next = await fetchLinkedPos(supabase, dealId);
    setPos(next);
    setSelectedPoId((prev) => {
      if (prev && next.some((p) => p.id === prev)) return prev;
      return next[0]?.id ?? null; // most recently created (already sorted desc)
    });
  };

  useEffect(() => {
    void reloadPos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  // Map each tag → the PO it belongs to (if any). Used for the sub-badge.
  const tagToPo = useMemo(() => {
    const m = new Map<string, LinkedPo>();
    for (const po of pos) {
      for (const tn of po.tracking_numbers ?? []) {
        if (!m.has(tn)) m.set(tn, po);
      }
    }
    return m;
  }, [pos]);

  const showPoBadge = pos.filter((p) => p.status !== "cancelled").length >= 2;
  const showPicker = showPoBadge; // only show picker when 2+ POs
  const noPos = pos.length === 0;

  const addTag = async (val: string) => {
    const v = val.trim();
    if (!v) {
      setDraft("");
      setAdding(false);
      setError(null);
      return;
    }
    if (tags.includes(v) && tagToPo.has(v)) {
      // already on this SO and on a PO — silent close
      setDraft("");
      setAdding(false);
      setError(null);
      return;
    }
    if (noPos) {
      setError(t.deal.trackingNoPoYet);
      return;
    }
    const targetPoId = selectedPoId ?? pos[0]?.id ?? null;
    if (!targetPoId) {
      setError(t.deal.trackingNoPoYet);
      return;
    }
    // Duplicate check across other POs of same SO
    const dupPo = findDuplicateTrackingPo(pos, v, targetPoId);
    if (dupPo) {
      setError(t.deal.trackingDuplicate.replace("{po}", dupPo));
      return;
    }
    // Optimistic update
    const next = tags.includes(v) ? tags : [...tags, v];
    setTags(next);
    setDraft("");
    setAdding(false);
    setError(null);

    const { error: err } = await addTrackingNumber(supabase, {
      dealId,
      poId: targetPoId,
      tracking: v,
    });
    if (err) {
      toast.error(t.status.somethingWentWrong);
      setTags(initial);
    }
    await reloadPos();
  };

  const removeTag = async (v: string) => {
    const next = tags.filter((x) => x !== v);
    setTags(next);
    const { error: err } = await removeTrackingNumber(supabase, {
      source: "so",
      dealId,
      tracking: v,
    });
    if (err) toast.error(t.status.somethingWentWrong);
    await reloadPos();
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

  const selectedPo = pos.find((p) => p.id === selectedPoId) ?? null;

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
        className="h-6 w-40 px-2 py-0 text-xs"
      />
      {showPicker && selectedPo && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px] font-mono"
            >
              {selectedPo.po_number}
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <div className="px-2 py-1 text-[11px] text-muted-foreground">
              {t.deal.trackingPickPo}
            </div>
            {pos
              .filter((p) => p.status !== "cancelled")
              .map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => setSelectedPoId(p.id)}
                  className="font-mono text-xs"
                >
                  {p.po_number}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <button
        type="button"
        onClick={() => void addTag(draft)}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-ide-navy hover:bg-muted"
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
        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        aria-label="cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );

  const addAffordance = (label: string) => {
    if (noPos) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex cursor-not-allowed items-center gap-1 text-xs text-muted-foreground/60"
                aria-disabled="true"
              >
                <Plus className="h-3 w-3" />
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{t.deal.trackingNoPoYet}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3 w-3" />
        {label}
      </button>
    );
  };

  if (tags.length === 0) {
    return (
      <div className="text-xs">
        {adding ? (
          <div className="flex flex-col gap-1">
            {inputBlock}
            {error && <span className="text-[11px] text-destructive">{error}</span>}
          </div>
        ) : (
          addAffordance(t.deal.tracking_numbers)
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => {
          const po = tagToPo.get(tag);
          return (
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
              {showPoBadge && po && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  · {po.po_number}
                </span>
              )}
              <button
                type="button"
                onClick={() => void removeTag(tag)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="remove"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        {adding ? inputBlock : addAffordance(t.actions.add)}
      </div>
      {adding && error && (
        <span className="text-[11px] text-destructive">{error}</span>
      )}
    </div>
  );
}
