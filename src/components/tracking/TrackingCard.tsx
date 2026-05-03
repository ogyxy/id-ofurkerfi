import { useState, useEffect, useMemo, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { X, ExternalLink, Plus, Check, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/sala_translations_is";
import { cn } from "@/lib/utils";
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

function getTrackingUrl(trackingNumber: string): string {
  return `https://www.ordertracker.com/track/${encodeURIComponent(trackingNumber)}`;
}

type Props = (
  | {
      mode: "deal";
      dealId: string;
      initial: string[];
    }
  | {
      mode: "po";
      poId: string;
      dealId: string | null;
      initial: string[];
    }
) & {
  /** When true, render without the outer card chrome (for embedding inside another card). */
  bare?: boolean;
  /** When true, render the section title and the "+ add" affordance on the same line to save vertical space. */
  inlineHeader?: boolean;
  /** Called after a successful add/remove so parent state can refetch. */
  onChanged?: () => void | Promise<void>;
  /** When false, the X-remove button next to each tracking number is hidden. */
  canRemove?: boolean;
};

/**
 * Shared tracking-numbers card used by both the SO and PO detail pages.
 * - SO mode: multi-PO picker (when 2+ POs) and per-row PO suffix.
 * - PO mode: scoped to one PO; still de-duplicates against sibling POs of same SO.
 */
export function TrackingCard(props: Props) {
  const isPo = props.mode === "po";
  const dealId = props.dealId;

  const [tags, setTags] = useState<string[]>(props.initial);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<LinkedPo[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(
    isPo ? props.poId : null,
  );

  useEffect(() => setTags(props.initial), [props.initial]);

  const reloadPos = async () => {
    if (!dealId) {
      setPos([]);
      return;
    }
    const next = await fetchLinkedPos(supabase, dealId);
    setPos(next);
    if (!isPo) {
      setSelectedPoId((prev) => {
        if (prev && next.some((p) => p.id === prev)) return prev;
        return next[0]?.id ?? null;
      });
    }
  };

  useEffect(() => {
    void reloadPos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, isPo ? props.poId : null]);

  const tagToPo = useMemo(() => {
    const m = new Map<string, LinkedPo>();
    for (const po of pos) {
      for (const tn of po.tracking_numbers ?? []) {
        if (!m.has(tn)) m.set(tn, po);
      }
    }
    return m;
  }, [pos]);

  const activePos = pos.filter((p) => p.status !== "cancelled");
  const showPoBadge = !isPo && activePos.length >= 2;
  const showPicker = showPoBadge;
  const noPos = !isPo && pos.length === 0;

  const addTag = async (val: string) => {
    const v = val.trim();
    if (!v) {
      setDraft("");
      setAdding(false);
      setError(null);
      return;
    }
    if (tags.includes(v) && (isPo || tagToPo.has(v))) {
      setDraft("");
      setAdding(false);
      setError(null);
      return;
    }

    let targetPoId: string | null;
    if (isPo) {
      targetPoId = props.poId;
    } else {
      if (noPos) {
        setError(t.deal.trackingNoPoYet);
        return;
      }
      targetPoId = selectedPoId ?? pos[0]?.id ?? null;
      if (!targetPoId) {
        setError(t.deal.trackingNoPoYet);
        return;
      }
    }

    if (dealId) {
      const dupPo = findDuplicateTrackingPo(pos, v, targetPoId ?? undefined);
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

    if (dealId && targetPoId) {
      const { error: err } = await addTrackingNumber(supabase, {
        dealId,
        poId: targetPoId,
        tracking: v,
      });
      if (err) {
        toast.error(t.status.somethingWentWrong);
        setTags(props.initial);
      }
      await reloadPos();
      await props.onChanged?.();
    } else if (isPo) {
      // PO with no linked deal: write directly
      const { error: err } = await supabase
        .from("purchase_orders")
        .update({ tracking_numbers: next })
        .eq("id", props.poId);
      if (err) toast.error(t.status.somethingWentWrong);
      else await props.onChanged?.();
    }
  };

  const removeTag = async (v: string) => {
    const next = tags.filter((x) => x !== v);
    setTags(next);
    if (isPo) {
      if (dealId) {
        const { error: err } = await removeTrackingNumber(supabase, {
          source: "po",
          poId: props.poId,
          dealId,
          tracking: v,
        });
        if (err) toast.error(t.status.somethingWentWrong);
        await reloadPos();
        await props.onChanged?.();
      } else {
        const { error: err } = await supabase
          .from("purchase_orders")
          .update({ tracking_numbers: next })
          .eq("id", props.poId);
        if (err) toast.error(t.status.somethingWentWrong);
        else await props.onChanged?.();
      }
    } else if (dealId) {
      const { error: err } = await removeTrackingNumber(supabase, {
        source: "so",
        dealId,
        tracking: v,
      });
      if (err) toast.error(t.status.somethingWentWrong);
      await reloadPos();
      await props.onChanged?.();
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

  const selectedPo = pos.find((p) => p.id === selectedPoId) ?? null;

  const inputBlock = (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        autoFocus
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={onKey}
        placeholder={t.deal.tracking_numbers}
        className="h-8 w-56 text-sm"
      />
      {showPicker && selectedPo && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
            >
              <span className="font-mono">{selectedPo.po_number}</span>
              {(selectedPo.supplier_record?.name ?? selectedPo.supplier) && (
                <span className="ml-1.5 text-muted-foreground">
                  · {selectedPo.supplier_record?.name ?? selectedPo.supplier}
                </span>
              )}
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <div className="px-2 py-1 text-[11px] text-muted-foreground">
              {t.deal.trackingPickPo}
            </div>
            {activePos.map((p) => {
              const sup = p.supplier_record?.name ?? p.supplier;
              return (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => setSelectedPoId(p.id)}
                  className="text-xs"
                >
                  <span className="font-mono">{p.po_number}</span>
                  {sup && (
                    <span className="ml-1.5 text-muted-foreground">· {sup}</span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={() => void addTag(draft)}
        aria-label="confirm"
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-muted-foreground"
        onClick={() => {
          setDraft("");
          setAdding(false);
          setError(null);
        }}
        aria-label="cancel"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  const addAffordance = noPos ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex cursor-not-allowed items-center gap-1 text-sm text-muted-foreground/60"
            aria-disabled="true"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.purchaseOrder.trackingAddButton}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{t.deal.trackingNoPoYet}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <Plus className="h-3.5 w-3.5" />
      {t.purchaseOrder.trackingAddButton}
    </button>
  );

  const inline = props.inlineHeader === true;
  // In PO mode we only allow a single tracking number per PO.
  // (The "add" affordance disappears as soon as one is set.)
  const singleSlot = props.mode === "po";
  const canAddMore = !singleSlot || tags.length === 0;

  const headerRow = inline ? null : (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-foreground">
        {t.purchaseOrder.trackingSectionTitle}
      </h2>
    </div>
  );

  const body = (
    <>
      {headerRow}

      {tags.length === 0 ? (
        <div>
          {adding ? (
            <div className="flex flex-col gap-1">
              {inputBlock}
              {error && <span className="text-xs text-destructive">{error}</span>}
            </div>
          ) : (
            addAffordance
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tags.map((tag) => {
            const po = tagToPo.get(tag);
            return (
              <div
                key={tag}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
              >
                <a
                  href={getTrackingUrl(tag)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-mono text-sm text-foreground hover:underline"
                >
                  <span>{tag}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  {showPoBadge && po && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      · {po.po_number}
                      {(po.supplier_record?.name ?? po.supplier) && (
                        <span className="font-sans"> · {po.supplier_record?.name ?? po.supplier}</span>
                      )}
                    </span>
                  )}
                </a>
                <button
                  type="button"
                  onClick={() => void removeTag(tag)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {canAddMore && (
            <div className="pt-1">{adding ? inputBlock : addAffordance}</div>
          )}
          {adding && error && (
            <span className="text-xs text-destructive">{error}</span>
          )}
        </div>
      )}
    </>
  );

  if (props.bare) return <div>{body}</div>;
  return (
    <div className="rounded-md border border-border bg-card p-6 shadow-sm">
      {body}
    </div>
  );
}
