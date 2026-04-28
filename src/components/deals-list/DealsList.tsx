import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X, AlertTriangle, Check, Plus, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatIsk, formatDate } from "@/lib/sala_translations_is";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { rememberDealReturnPath, rememberCompanyReturnPath } from "@/lib/dealReturn";
import { toast } from "sonner";
import { CreateDealDrawer } from "./CreateDealDrawer";

type DealStage = Database["public"]["Enums"]["deal_stage"];
type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];
type DefectResolution = Database["public"]["Enums"]["defect_resolution"];

type DealRow = {
  id: string;
  so_number: string;
  name: string;
  stage: DealStage;
  amount_isk: number | null;
  promised_delivery_date: string | null;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
  invoice_status: InvoiceStatus;
  payment_status: PaymentStatus;
  defect_resolution: DefectResolution;
  tracking_numbers: string[];
  archived: boolean;
  company: { id: string; name: string } | null;
  contact: { id: string; first_name: string | null; last_name: string | null } | null;
  owner: { id: string; name: string | null } | null;
};

type Profile = { id: string; name: string | null; email: string };

interface Props {
  currentUserId: string;
}

const STAGE_ORDER: DealStage[] = [
  "inquiry",
  "quote_in_progress",
  "quote_sent",
  "order_confirmed",
  "delivered",
  "defect_reorder",
];

const STAGE_STYLES: Record<DealStage, { border: string; bg: string }> = {
  inquiry: { border: "border-l-gray-400", bg: "bg-white" },
  quote_in_progress: { border: "border-l-blue-500", bg: "bg-blue-50" },
  quote_sent: { border: "border-l-indigo-500", bg: "bg-indigo-50" },
  order_confirmed: { border: "border-l-amber-500", bg: "bg-amber-50" },
  delivered: { border: "border-l-green-500", bg: "bg-green-50" },
  defect_reorder: { border: "border-l-orange-500", bg: "bg-orange-50" },
  cancelled: { border: "border-l-gray-300", bg: "bg-gray-50" },
};

const SELECT = `
  id,
  so_number,
  name,
  stage,
  amount_isk,
  promised_delivery_date,
  estimated_delivery_date,
  delivered_at,
  invoice_status,
  payment_status,
  defect_resolution,
  tracking_numbers,
  archived,
  company:companies(id, name),
  contact:contacts(id, first_name, last_name),
  owner:profiles(id, name)
`;

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function isOverdue(date: string | null, stage: DealStage): boolean {
  if (!date) return false;
  if (stage === "delivered" || stage === "cancelled") return false;
  return new Date(date) < new Date(new Date().toDateString());
}

export function DealsList({ currentUserId }: Props) {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStages, setSelectedStages] = useState<Set<DealStage | "all">>(
    new Set(["all"]),
  );
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Load owners (active profiles)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("active", true);
      setProfiles((data ?? []) as Profile[]);
    })();
  }, []);

  // Fetch deals
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("deals")
        .select(SELECT)
        .eq("archived", false);

      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch}%`;
        query = query.or(
          `name.ilike.${term},so_number.ilike.${term},tracking_numbers.cs.{${debouncedSearch}}`,
        );
      } else {
        // Apply stage filter server-side
        if (selectedStages.has("all")) {
          // active = exclude cancelled
          query = query.neq("stage", "cancelled");
        } else {
          query = query.in("stage", Array.from(selectedStages) as DealStage[]);
        }
      }

      query = query.order("promised_delivery_date", {
        ascending: true,
        nullsFirst: false,
      });

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        setDeals([]);
      } else {
        setDeals((data ?? []) as unknown as DealRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, selectedStages]);

  // Client-side filtering: owner + company/contact name on search
  const visibleDeals = useMemo(() => {
    let list = deals;
    if (selectedOwners.size > 0 && !debouncedSearch.trim()) {
      list = list.filter((d) => d.owner && selectedOwners.has(d.owner.id));
    }
    if (debouncedSearch.trim()) {
      const s = debouncedSearch.toLowerCase();
      // Server already matched name/so_number/tracking. Add company/contact match.
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(s) ||
          d.so_number.toLowerCase().includes(s) ||
          (d.tracking_numbers ?? []).some((tn) => tn.toLowerCase().includes(s)) ||
          d.company?.name?.toLowerCase().includes(s) ||
          d.contact?.first_name?.toLowerCase().includes(s) ||
          d.contact?.last_name?.toLowerCase().includes(s),
      );
    }
    return list;
  }, [deals, selectedOwners, debouncedSearch]);

  const ownersWithDeals = useMemo(() => {
    const ids = new Set<string>();
    deals.forEach((d) => {
      if (d.owner?.id) ids.add(d.owner.id);
    });
    return profiles.filter((p) => ids.has(p.id));
  }, [deals, profiles]);

  // Counts per stage (respecting owner filter, ignoring stage selection)
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    STAGE_ORDER.concat(["cancelled"]).forEach((s) => (counts[s] = 0));
    // For counts we need a base set; reuse deals (which are pre-filtered by stage selection).
    // To get accurate counts across all stages, we'd need a separate query. For v1, count from current dataset.
    deals.forEach((d) => {
      if (selectedOwners.size > 0 && (!d.owner || !selectedOwners.has(d.owner.id))) return;
      counts[d.stage] = (counts[d.stage] ?? 0) + 1;
      if (d.stage !== "cancelled") counts.all += 1;
    });
    return counts;
  }, [deals, selectedOwners]);

  const toggleStage = (stage: DealStage | "all") => {
    setSelectedStages((prev) => {
      const next = new Set(prev);
      if (stage === "all") {
        return new Set(["all"]);
      }
      next.delete("all");
      if (next.has(stage)) {
        next.delete(stage);
        if (next.size === 0) next.add("all");
      } else {
        next.add(stage);
      }
      return next;
    });
  };

  const toggleOwner = (id: string) => {
    setSelectedOwners((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearAll = () => {
    setSearch("");
    setSelectedStages(new Set(["all"]));
    setSelectedOwners(new Set());
  };

  const openDeal = (id: string) => {
    rememberDealReturnPath("/deals");
    navigate({ to: "/deals/$id", params: { id } });
  };

  const handleStageChange = async (deal: DealRow, newStage: DealStage) => {
    const today = new Date().toISOString().split("T")[0];
    const patch =
      newStage === "delivered"
        ? { stage: newStage, delivered_at: today }
        : { stage: newStage };
    const { error } = await supabase.from("deals").update(patch).eq("id", deal.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    // Optimistic local update
    setDeals((prev) =>
      prev.map((d) =>
        d.id === deal.id
          ? {
              ...d,
              stage: newStage,
              delivered_at: newStage === "delivered" ? today : d.delivered_at,
            }
          : d,
      ),
    );
    toast.success(t.status.savedSuccessfully);
  };

  const handleOwnerChange = async (deal: DealRow, newOwnerId: string | null) => {
    const { error } = await supabase
      .from("deals")
      .update({ owner_id: newOwnerId })
      .eq("id", deal.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    const newOwner = newOwnerId
      ? profiles.find((p) => p.id === newOwnerId) ?? null
      : null;
    setDeals((prev) =>
      prev.map((d) =>
        d.id === deal.id
          ? {
              ...d,
              owner: newOwner
                ? { id: newOwner.id, name: newOwner.name }
                : null,
            }
          : d,
      ),
    );
    toast.success(t.status.savedSuccessfully);
  };

  const isSearching = debouncedSearch.trim().length > 0;
  const showGrouping = !isSearching && selectedStages.has("all");

  // Group deals by stage when default view
  const grouped = useMemo(() => {
    if (!showGrouping) return null;
    const map = new Map<DealStage, DealRow[]>();
    STAGE_ORDER.forEach((s) => map.set(s, []));
    visibleDeals.forEach((d) => {
      if (d.stage === "cancelled") return;
      const arr = map.get(d.stage);
      if (arr) arr.push(d);
    });
    return map;
  }, [visibleDeals, showGrouping]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">{t.nav.deals}</h1>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          {t.deal.createButton}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.deal.searchPlaceholder}
          className="pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isSearching && (
        <p className="mb-4 text-xs text-muted-foreground">{t.deal.searchingAll}</p>
      )}

      {/* Owner strip */}
      {!isSearching && ownersWithDeals.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            {t.deal.owner}
          </div>
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedOwners(new Set())}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                selectedOwners.size === 0
                  ? "border-ide-navy bg-ide-navy text-white"
                  : "border-border bg-white text-muted-foreground hover:text-foreground",
              )}
            >
              {t.deal.allOwners}
            </button>
            {ownersWithDeals.map((p) => {
              const active = selectedOwners.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleOwner(p.id)}
                  title={p.name ?? p.email}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full bg-ide-navy text-xs font-medium text-white transition hover:scale-105",
                    active && "ring-2 ring-ide-navy ring-offset-2",
                  )}
                >
                  {initials(p.name ?? p.email)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stage filter pills */}
      {!isSearching && (
        <div className="mb-6 flex flex-wrap items-center gap-2 overflow-x-auto">
          <StagePill
            label={t.deal.filterAll}
            count={stageCounts.all}
            active={selectedStages.has("all")}
            onClick={() => toggleStage("all")}
          />
          {STAGE_ORDER.map((s) => (
            <StagePill
              key={s}
              label={t.dealStage[s]}
              count={stageCounts[s] ?? 0}
              active={selectedStages.has(s)}
              onClick={() => toggleStage(s)}
            />
          ))}
          <StagePill
            label={t.dealStage.cancelled}
            count={stageCounts.cancelled ?? 0}
            active={selectedStages.has("cancelled")}
            onClick={() => toggleStage("cancelled")}
          />
        </div>
      )}

      {/* Deals list */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">{t.status.loading}</div>
      ) : visibleDeals.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">{t.deal.noDeals}</p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-2 text-sm text-ide-navy hover:underline"
          >
            {t.deal.clearFilters}
          </button>
        </div>
      ) : showGrouping && grouped ? (
        <div className="space-y-6">
          {STAGE_ORDER.map((s) => {
            const rows = grouped.get(s) ?? [];
            if (rows.length === 0) return null;
            return (
              <section key={s}>
                <div className="mb-2 flex items-center gap-2 text-gray-400" style={{ fontSize: "11px" }}>
                  <span className="h-px flex-1 bg-border" />
                  <span className="uppercase tracking-wider">
                    {t.dealStage[s]} ({rows.length})
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-2">
                  {rows.map((d) => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      onOpen={() => openDeal(d.id)}
                      onStageChange={(stage) => handleStageChange(d, stage)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleDeals.map((d) => (
            <DealCard
              key={d.id}
              deal={d}
              onOpen={() => openDeal(d.id)}
              onStageChange={(stage) => handleStageChange(d, stage)}
            />
          ))}
        </div>
      )}

      <CreateDealDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        currentUserId={currentUserId}
        profiles={profiles}
      />
    </div>
  );
}

function StagePill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition",
        active
          ? "border-ide-navy bg-ide-navy text-white"
          : "border-border bg-white text-muted-foreground hover:text-foreground",
      )}
    >
      {label} ({count})
    </button>
  );
}

const POPOVER_STAGES: DealStage[] = [
  "inquiry",
  "quote_in_progress",
  "quote_sent",
  "order_confirmed",
  "delivered",
];

function StagePopover({
  current,
  onChange,
}: {
  current: DealStage;
  onChange: (s: DealStage) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DealStage | null>(null);
  const [busy, setBusy] = useState(false);

  const styles = STAGE_STYLES[current];

  const close = () => {
    setOpen(false);
    setPending(null);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    await onChange(pending);
    setBusy(false);
    close();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setPending(null);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition hover:opacity-80",
            styles.border.replace("border-l-", "border-"),
            styles.bg,
          )}
        >
          {t.dealStage[current]}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {pending ? (
          pending === "defect_reorder" ? null : (
            <div className="space-y-3 px-1 py-2">
              <p className="text-sm">
                {t.deal.moveToStage} {t.dealStage[pending]}?
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={close}
                  disabled={busy}
                >
                  {t.actions.cancel}
                </Button>
                <Button
                  size="sm"
                  onClick={confirm}
                  disabled={busy}
                  className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                >
                  {t.status.yes}
                </Button>
              </div>
            </div>
          )
        ) : (
          <ul className="space-y-1">
            {POPOVER_STAGES.map((s) => {
              const active = s === current;
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => {
                      if (active) return;
                      setPending(s);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition hover:bg-muted",
                      active && "font-medium",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-2.5 w-2.5 rounded-full border",
                        active ? "bg-ide-navy border-ide-navy" : "border-gray-400",
                      )}
                    />
                    {t.dealStage[s]}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function DealCard({
  deal,
  onOpen,
  onStageChange,
}: {
  deal: DealRow;
  onOpen: () => void;
  onStageChange: (s: DealStage) => void | Promise<void>;
}) {
  const styles = STAGE_STYLES[deal.stage];
  const muted = deal.stage === "delivered";
  const cancelled = deal.stage === "cancelled";
  const overdue = isOverdue(deal.promised_delivery_date, deal.stage);

  const showInvoiceBadge =
    deal.invoice_status === "not_invoiced" && deal.stage === "delivered";
  const showPaymentBadge =
    deal.payment_status === "unpaid" && deal.invoice_status !== "not_invoiced";
  const showDefectBadge = deal.stage === "defect_reorder";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
      className={cn(
        "grid cursor-pointer items-center gap-4 rounded-md border border-border border-l-4 px-4 py-3 transition hover:bg-muted/50",
        "grid-cols-[160px_1fr] md:grid-cols-[160px_minmax(0,1.5fr)_minmax(0,1.5fr)_180px_140px_120px]",
        styles.border,
        styles.bg,
        muted && "text-gray-400",
        cancelled && "italic",
      )}
    >
      {/* SO number + stage + badges */}
      <div className="min-w-0 space-y-1">
        <div className="font-mono text-xs text-muted-foreground">{deal.so_number}</div>
        <div onClick={(e) => e.stopPropagation()}>
          <StagePopover current={deal.stage} onChange={onStageChange} />
        </div>
        {(showInvoiceBadge || showPaymentBadge || showDefectBadge) && (
          <div className="flex flex-wrap gap-1">
            {showInvoiceBadge && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                {t.invoiceStatus.not_invoiced}
              </span>
            )}
            {showPaymentBadge && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                {t.paymentStatus.unpaid}
              </span>
            )}
            {showDefectBadge && (
              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-800">
                {t.defectResolution[deal.defect_resolution]}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Deal name */}
      <div className="min-w-0">
        <div className={cn("truncate font-medium", muted ? "text-gray-400" : "text-foreground")}>
          {deal.name}
        </div>
      </div>

      {/* Company / Contact */}
      <div className="hidden min-w-0 md:block">
        {deal.company ? (
          <Link
            to="/companies/$id"
            params={{ id: deal.company.id }}
            onClick={(e) => {
              e.stopPropagation();
              rememberCompanyReturnPath();
            }}
            className="block truncate text-sm text-foreground hover:underline"
          >
            {deal.company.name}
          </Link>
        ) : (
          <div className="text-sm text-muted-foreground">—</div>
        )}
        {deal.contact ? (
          <div className="truncate text-xs text-muted-foreground">
            {[deal.contact.first_name, deal.contact.last_name].filter(Boolean).join(" ") || "—"}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">—</div>
        )}
      </div>

      {/* Owner — always reserves space */}
      <div className="hidden items-center gap-2 md:flex">
        {deal.owner ? (
          <>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ide-navy text-[10px] font-medium text-white">
              {initials(deal.owner.name)}
            </div>
            <span className="truncate text-xs text-muted-foreground">{deal.owner.name}</span>
          </>
        ) : (
          <>
            <div className="h-6 w-6 shrink-0 rounded-full border border-dashed border-gray-300 bg-gray-50" />
            <span className="text-xs text-muted-foreground">—</span>
          </>
        )}
      </div>

      {/* Date */}
      <div className="hidden text-right md:block">
        {deal.stage === "delivered" ? (
          <>
            <div className="text-[10px] uppercase tracking-wide text-green-700/70">
              {t.deal.deliveredOn}
            </div>
            <div className="text-sm">{formatDate(deal.delivered_at) || "—"}</div>
          </>
        ) : (
          <>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t.deal.estimatedDelivery}
            </div>
            <div
              className={cn(
                "flex items-center justify-end gap-1 text-sm",
                overdue && "text-red-600",
              )}
            >
              {overdue && <AlertTriangle className="h-3 w-3" />}
              {deal.promised_delivery_date ? formatDate(deal.promised_delivery_date) : "—"}
            </div>
          </>
        )}
      </div>

      {/* Amount */}
      <div className="hidden text-right text-sm font-medium md:block">
        {formatIsk(deal.amount_isk)}
      </div>
    </div>
  );
}
