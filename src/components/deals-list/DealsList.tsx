import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X, AlertTriangle, Check, Plus, ChevronDown, Clock, AlertCircle, Copy, Download } from "lucide-react";
import { exportDealsToXlsx } from "@/lib/exportDealsXlsx";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
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
  total_cost_isk: number | null;
  shipping_cost_isk: number | null;
  total_margin_isk: number | null;
  refund_amount_isk: number | null;
  promised_delivery_date: string | null;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
  invoice_status: InvoiceStatus;
  payment_status: PaymentStatus;
  defect_resolution: DefectResolution;
  tracking_numbers: string[];
  archived: boolean;
  created_at: string;
  company: { id: string; name: string } | null;
  contact: { id: string; first_name: string | null; last_name: string | null } | null;
  owner: { id: string; name: string | null } | null;
  childDeals?: { stage: DealStage }[];
};

type Profile = { id: string; name: string | null; email: string };

interface Props {
  currentUserId: string;
  initialStage?: DealStage | null;
}

// 3-step stepper grouping (mirrors /deals/:id stepper)
type StepKey = "inquiry" | "tilbod" | "pontun" | "afhent" | "defect_reorder" | "cancelled";

const STEP_PILLS: StepKey[] = [
  "inquiry",
  "tilbod",
  "pontun",
  "afhent",
  "defect_reorder",
  "cancelled",
];

// Sub-pills for the two grouped steps
const TILBOD_SUB: DealStage[] = ["quote_in_progress", "quote_sent"];
const PONTUN_SUB: DealStage[] = ["order_confirmed", "ready_for_pickup"];

function stageToStep(stage: DealStage): StepKey {
  switch (stage) {
    case "inquiry": return "inquiry";
    case "quote_in_progress":
    case "quote_sent": return "tilbod";
    case "order_confirmed":
    case "ready_for_pickup": return "pontun";
    case "delivered": return "afhent";
    case "defect_reorder": return "defect_reorder";
    case "cancelled": return "cancelled";
  }
}

function stepLabel(step: StepKey): string {
  switch (step) {
    case "inquiry": return t.dealStage.inquiry;
    case "tilbod": return t.deal.step1Tilbod;
    case "pontun": return t.deal.step2Pontun;
    case "afhent": return t.deal.step3Afhent;
    case "defect_reorder": return t.dealStage.defect_reorder;
    case "cancelled": return t.dealStage.cancelled;
  }
}

// Substep badge for a stage (shown inside the deal card stage button)
function stageSubstepLabel(stage: DealStage): string | null {
  if (stage === "quote_sent") return t.deal.substepSent;
  if (stage === "ready_for_pickup") return t.deal.substepInHouse;
  return null;
}

const STAGE_STYLES: Record<DealStage, { border: string; bg: string }> = {
  inquiry: { border: "border-l-gray-400", bg: "bg-white" },
  quote_in_progress: { border: "border-l-blue-500", bg: "bg-blue-50" },
  quote_sent: { border: "border-l-indigo-500", bg: "bg-indigo-50" },
  order_confirmed: { border: "border-l-amber-500", bg: "bg-amber-50" },
  ready_for_pickup: { border: "border-l-purple-500", bg: "bg-amber-50" },
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
  total_cost_isk,
  shipping_cost_isk,
  total_margin_isk,
  refund_amount_isk,
  promised_delivery_date,
  estimated_delivery_date,
  delivered_at,
  invoice_status,
  payment_status,
  defect_resolution,
  tracking_numbers,
  archived,
  created_at,
  company:companies(id, name),
  contact:contacts(id, first_name, last_name),
  owner:profiles(id, name)
`;

function isDefectResolved(deal: DealRow): boolean {
  if (deal.stage !== "defect_reorder") return false;
  if (deal.defect_resolution === "refund" && deal.refund_amount_isk != null) return true;
  if (deal.defect_resolution === "credit_note") return true;
  if (deal.defect_resolution === "resolved") return true;
  if (
    deal.defect_resolution === "reorder" &&
    (deal.childDeals?.length ?? 0) > 0 &&
    deal.childDeals!.every((c) => c.stage === "delivered")
  ) {
    return true;
  }
  return false;
}

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

export function DealsList({ currentUserId, initialStage = null }: Props) {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeStep, setActiveStep] = useState<StepKey | null>(
    initialStage ? stageToStep(initialStage) : null,
  );
  const [activeSubstage, setActiveSubstage] = useState<DealStage | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lineMatchedDealIds, setLineMatchedDealIds] = useState<Set<string>>(new Set());
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

  // Load available years (last 3 distinct years that have deals)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("deals")
        .select("created_at")
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (!data) return;
      const years = new Set<number>();
      for (const row of data as { created_at: string }[]) {
        const y = new Date(row.created_at).getFullYear();
        if (!Number.isNaN(y)) years.add(y);
      }
      const sorted = [...years].sort((a, b) => b - a).slice(0, 3);
      setAvailableYears(sorted);
    })();
  }, []);

  // Fetch deals — search bypasses year filter; otherwise filter by selectedYear server-side.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const searchTerm = debouncedSearch.trim();

      if (searchTerm) {
        // Server-side search (debounced 300ms, limit 200)
        const term = `%${searchTerm}%`;
        const dealsQuery = supabase
          .from("deals")
          .select(SELECT)
          .eq("archived", false)
          .or(
            `name.ilike.${term},so_number.ilike.${term},payday_invoice_number.ilike.${term},notes.ilike.${term},tracking_numbers.cs.{${searchTerm}}`,
          )
          .order("created_at", { ascending: false })
          .limit(200);

        const linesPromise = supabase
          .from("deal_lines")
          .select("deal_id")
          .or(
            `product_name.ilike.${term},product_supplier_sku.ilike.${term}`,
          );

        // Company name search → fetch ids then deals.in(...)
        const companiesPromise = supabase
          .from("companies")
          .select("id")
          .ilike("name", term)
          .limit(200);

        const [
          { data: dealsData, error: dealsErr },
          { data: matchingLines },
          { data: companyMatches },
        ] = await Promise.all([dealsQuery, linesPromise, companiesPromise]);

        if (cancelled) return;

        const matchedLineIds = new Set<string>(
          (matchingLines ?? []).map((l) => l.deal_id),
        );
        setLineMatchedDealIds(matchedLineIds);

        let rows = dealsErr ? [] : ((dealsData ?? []) as unknown as DealRow[]);
        const existingIds = new Set(rows.map((d) => d.id));

        // Pull deals matched by lines or by company name
        const extraIds = new Set<string>();
        matchedLineIds.forEach((id) => {
          if (!existingIds.has(id)) extraIds.add(id);
        });
        if (companyMatches && companyMatches.length) {
          const companyIds = companyMatches.map((c) => c.id);
          const { data: byCompany } = await supabase
            .from("deals")
            .select(SELECT)
            .eq("archived", false)
            .in("company_id", companyIds)
            .limit(200);
          if (byCompany) {
            for (const d of byCompany as unknown as DealRow[]) {
              if (!existingIds.has(d.id)) {
                rows.push(d);
                existingIds.add(d.id);
                extraIds.delete(d.id);
              }
            }
          }
        }
        if (extraIds.size) {
          const { data: additionalDeals } = await supabase
            .from("deals")
            .select(SELECT)
            .in("id", [...extraIds])
            .eq("archived", false);
          if (additionalDeals) {
            rows = [...rows, ...(additionalDeals as unknown as DealRow[])];
          }
        }

        rows = await attachChildDeals(rows);
        if (!cancelled) {
          // Sort by created_at desc
          rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
          setDeals(rows.slice(0, 200));
          setLoading(false);
        }
        return;
      }

      // No search → fetch all (or by year), sorted by created_at DESC
      let query = supabase
        .from("deals")
        .select(SELECT)
        .eq("archived", false);

      if (selectedYear !== null) {
        const start = `${selectedYear}-01-01T00:00:00Z`;
        const end = `${selectedYear + 1}-01-01T00:00:00Z`;
        query = query.gte("created_at", start).lt("created_at", end);
      }

      query = query
        .order("created_at", { ascending: false })
        .range(0, 9999);

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        setDeals([]);
        setLoading(false);
        return;
      }
      let rows = (data ?? []) as unknown as DealRow[];
      rows = await attachChildDeals(rows);
      if (!cancelled) {
        setDeals(rows);
        setLineMatchedDealIds(new Set());
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, selectedYear]);

  // Apply remaining client-side filters (step + substep, owner)
  const visibleDeals = useMemo(() => {
    let list = deals;
    if (activeStep === "defect_reorder") {
      list = list.filter(
        (d) => d.stage === "defect_reorder" && !isDefectResolved(d),
      );
    } else if (activeStep === "afhent") {
      list = list.filter(
        (d) =>
          d.stage === "delivered" ||
          (d.stage === "defect_reorder" && isDefectResolved(d)),
      );
    } else if (activeStep === "cancelled") {
      list = list.filter((d) => d.stage === "cancelled");
    } else if (activeStep === "inquiry") {
      list = list.filter((d) => d.stage === "inquiry");
    } else if (activeStep === "tilbod") {
      const sub = activeSubstage ?? null;
      list = list.filter((d) =>
        sub ? d.stage === sub : TILBOD_SUB.includes(d.stage),
      );
    } else if (activeStep === "pontun") {
      const sub = activeSubstage ?? null;
      list = list.filter((d) =>
        sub ? d.stage === sub : PONTUN_SUB.includes(d.stage),
      );
    }
    if (selectedOwners.size > 0) {
      list = list.filter((d) => d.owner && selectedOwners.has(d.owner.id));
    }
    return list;
  }, [deals, activeStep, activeSubstage, selectedOwners]);

  const stepCounts = useMemo(() => {
    const c: Record<StepKey, number> = {
      inquiry: 0,
      tilbod: 0,
      pontun: 0,
      afhent: 0,
      defect_reorder: 0,
      cancelled: 0,
    };
    const subC: Record<DealStage, number> = {
      inquiry: 0,
      quote_in_progress: 0,
      quote_sent: 0,
      order_confirmed: 0,
      ready_for_pickup: 0,
      delivered: 0,
      defect_reorder: 0,
      cancelled: 0,
    };
    deals.forEach((d) => {
      subC[d.stage]++;
      if (d.stage === "defect_reorder") {
        if (isDefectResolved(d)) c.afhent++;
        else c.defect_reorder++;
      } else {
        c[stageToStep(d.stage)]++;
      }
    });
    return { steps: c, sub: subC };
  }, [deals]);

  const ownersWithDeals = useMemo(() => {
    const ids = new Set<string>();
    deals.forEach((d) => {
      if (d.owner?.id) ids.add(d.owner.id);
    });
    return profiles.filter((p) => ids.has(p.id));
  }, [deals, profiles]);

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
    setActiveStep(null);
    setActiveSubstage(null);
    setSelectedOwners(new Set());
    setSelectedYear(null);
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

  // Window-based virtualizer (scrolls with the page, no inner container)
  const listRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useWindowVirtualizer({
    count: visibleDeals.length,
    estimateSize: () => 64,
    overscan: 8,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">{t.nav.deals}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={exporting || visibleDeals.length === 0}
            onClick={async () => {
              setExporting(true);
              try {
                const stageLabelMap: Record<StepKey, string> = {
                  inquiry: "Fyrirspurnir",
                  tilbod: "Tilboð",
                  pontun: "Í pöntun",
                  afhent: "Afhentar",
                  defect_reorder: "Gallar",
                  cancelled: "Hætt við",
                };
                let ownerName: string | null = null;
                if (selectedOwners.size === 1) {
                  const id = [...selectedOwners][0];
                  const p = profiles.find((x) => x.id === id);
                  const full = p?.name?.trim() || p?.email || "";
                  ownerName = full.split(/\s+/)[0] || null;
                }
                await exportDealsToXlsx(visibleDeals, {
                  stageLabel: activeStep ? stageLabelMap[activeStep] : null,
                  year: selectedYear,
                  ownerName,
                });
                toast.success(`${visibleDeals.length} sölur fluttar út`);
              } catch {
                toast.error(t.status.somethingWentWrong);
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download className="mr-1 h-4 w-4" />
            {exporting ? t.status.loading : "Excel"}
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {t.deal.createButton}
          </Button>
        </div>
      </div>

      {/* Year filter pills */}
      {availableYears.length > 0 && (
        <div className="mb-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            {t.deal.yearFilter}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {availableYears.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setSelectedYear((prev) => (prev === y ? null : y))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  selectedYear === y
                    ? "border-ide-navy bg-ide-navy text-white"
                    : "border-border bg-white text-muted-foreground hover:text-foreground",
                )}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

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
      {ownersWithDeals.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            {t.deal.owner}
          </div>
          <div className="flex flex-wrap items-center gap-2 py-1">
            {ownersWithDeals.map((p) => {
              const noneSelected = selectedOwners.size === 0;
              const active = selectedOwners.has(p.id);
              const filled = noneSelected || active;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleOwner(p.id)}
                  title={p.name ?? p.email}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition hover:scale-105",
                    filled
                      ? "bg-ide-navy text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {initials(p.name ?? p.email)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stage filter pills (3-step + extras) with sub-pills for tilboð / pöntun */}
      <div className="mb-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t.deal.stage}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STEP_PILLS.map((step) => {
            const isActive = activeStep === step;
            // When a step is active, hide the other top-level pills
            if (activeStep && !isActive) return null;
            return (
              <StagePill
                key={step}
                label={stepLabel(step)}
                count={stepCounts.steps[step]}
                active={isActive}
                onClick={() => {
                  if (isActive) {
                    setActiveStep(null);
                    setActiveSubstage(null);
                  } else {
                    setActiveStep(step);
                    setActiveSubstage(null);
                  }
                }}
                showClose={isActive}
              />
            );
          })}
          {/* Sub-pills for tilboð / pöntun */}
          {activeStep === "tilbod" &&
            TILBOD_SUB.map((s) => (
              <StagePill
                key={s}
                label={t.dealStage[s]}
                count={stepCounts.sub[s]}
                active={activeSubstage === s}
                onClick={() =>
                  setActiveSubstage((prev) => (prev === s ? null : s))
                }
                showClose={activeSubstage === s}
                variant="sub"
              />
            ))}
          {activeStep === "pontun" &&
            PONTUN_SUB.map((s) => (
              <StagePill
                key={s}
                label={t.dealStage[s]}
                count={stepCounts.sub[s]}
                active={activeSubstage === s}
                onClick={() =>
                  setActiveSubstage((prev) => (prev === s ? null : s))
                }
                showClose={activeSubstage === s}
                variant="sub"
              />
            ))}
        </div>
      </div>

      {/* Flat virtualized list */}
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
      ) : (
        <div ref={listRef} className="relative">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((vItem) => {
              const d = visibleDeals[vItem.index];
              return (
                <div
                  key={d.id}
                  ref={rowVirtualizer.measureElement}
                  data-index={vItem.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vItem.start - (listRef.current?.offsetTop ?? 0)}px)`,
                    paddingBottom: 6,
                  }}
                >
                  <DealCard
                    deal={d}
                    profiles={profiles}
                    onOpen={() => openDeal(d.id)}
                    onStageChange={(stage) => handleStageChange(d, stage)}
                    onOwnerChange={(ownerId) => handleOwnerChange(d, ownerId)}
                  />
                </div>
              );
            })}
          </div>
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

// Helper: fetch child deals for defect_reorder rows w/ reorder resolution
async function attachChildDeals(rows: DealRow[]): Promise<DealRow[]> {
  const defectReorderIds = rows
    .filter(
      (d) => d.stage === "defect_reorder" && d.defect_resolution === "reorder",
    )
    .map((d) => d.id);
  if (!defectReorderIds.length) return rows;
  const { data: children } = await supabase
    .from("deals")
    .select("parent_deal_id, stage")
    .in("parent_deal_id", defectReorderIds);
  if (!children) return rows;
  const byParent = new Map<string, { stage: DealStage }[]>();
  (children as { parent_deal_id: string; stage: DealStage }[]).forEach((c) => {
    const arr = byParent.get(c.parent_deal_id) ?? [];
    arr.push({ stage: c.stage });
    byParent.set(c.parent_deal_id, arr);
  });
  return rows.map((d) => ({
    ...d,
    childDeals: byParent.get(d.id) ?? [],
  }));
}

function StagePill({
  label,
  count,
  active,
  onClick,
  showClose = false,
  variant = "main",
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  showClose?: boolean;
  variant?: "main" | "sub";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border transition",
        variant === "sub"
          ? "border-dashed px-2.5 py-0.5 text-[11px]"
          : "px-3 py-1 text-xs",
        active
          ? "border-ide-navy bg-ide-navy text-white"
          : "border-border bg-white text-muted-foreground hover:text-foreground",
      )}
    >
      <span>
        {label} ({count})
      </span>
      {showClose && <X className="h-3 w-3" aria-hidden="true" />}
    </button>
  );
}

function CopySoButton({ soNumber, companyName }: { soNumber: string; companyName?: string | null }) {
  const [copied, setCopied] = useState(false);
  const text = companyName ? `${soNumber} ${companyName}` : soNumber;
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success(`${text} ${t.deal.soCopiedToast}`);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error(t.status.somethingWentWrong);
        }
      }}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={`Afrita ${text}`}
      title="Afrita sölunúmer"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export { CopySoButton };

function CopyTextButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success(`${text} ${t.deal.soCopiedToast}`);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error(t.status.somethingWentWrong);
        }
      }}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={label ? `Afrita ${label}` : `Afrita ${text}`}
      title={label ?? "Afrita"}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export { CopyTextButton };

// Stages selectable from the deal-card popover, grouped under their step.
const POPOVER_GROUPS: Array<{ step: StepKey; stages: DealStage[] }> = [
  { step: "inquiry", stages: ["inquiry"] },
  { step: "tilbod", stages: ["quote_in_progress", "quote_sent"] },
  { step: "pontun", stages: ["order_confirmed", "ready_for_pickup"] },
  { step: "afhent", stages: ["delivered"] },
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
  const sub = stageSubstepLabel(current);
  const triggerLabel = stepLabel(stageToStep(current));

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
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition hover:opacity-80",
            styles.border.replace("border-l-", "border-"),
            styles.bg,
          )}
        >
          <span>{triggerLabel}</span>
          {sub && (
            <span className="rounded-full bg-white/70 px-1.5 py-px text-[9px] font-normal text-muted-foreground">
              {sub}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-60 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {pending ? (
          <div className="space-y-3 px-1 py-2">
            <p className="text-sm">
              {t.deal.moveToStage} {t.dealStage[pending]}?
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={close} disabled={busy}>
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
        ) : (
          <div className="space-y-2">
            {POPOVER_GROUPS.map((group) => (
              <div key={group.step}>
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {stepLabel(group.step)}
                </div>
                <ul className="space-y-0.5">
                  {group.stages.map((s) => {
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
                              active
                                ? "bg-ide-navy border-ide-navy"
                                : "border-gray-400",
                            )}
                          />
                          {t.dealStage[s]}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function DealCard({
  deal,
  profiles,
  onOpen,
  onStageChange,
  onOwnerChange,
}: {
  deal: DealRow;
  profiles: Profile[];
  onOpen: () => void;
  onStageChange: (s: DealStage) => void | Promise<void>;
  onOwnerChange: (ownerId: string | null) => void | Promise<void>;
}) {
  const resolvedDefect = deal.stage === "defect_reorder" && isDefectResolved(deal);
  // Resolved defect deals are shown inside the delivered group with green tint + orange left border
  const styles = resolvedDefect
    ? { border: "border-l-orange-500", bg: "bg-green-50" }
    : STAGE_STYLES[deal.stage];
  const muted = deal.stage === "delivered" || resolvedDefect;
  const cancelled = deal.stage === "cancelled";
  const overdue = isOverdue(deal.promised_delivery_date, deal.stage);

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
        "grid cursor-pointer items-center gap-3 rounded-md border border-border border-l-4 px-3 py-2 transition hover:bg-muted/50",
        "grid-cols-[160px_1fr] md:grid-cols-[160px_minmax(0,1.5fr)_minmax(0,1.5fr)_180px_140px_120px]",
        styles.border,
        styles.bg,
        muted && "text-gray-400",
        cancelled && "italic",
      )}
      style={resolvedDefect ? { borderLeftWidth: "3px" } : undefined}
    >
      {/* SO number + stage + defect badge */}
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
          <span>{deal.so_number}</span>
          <CopySoButton soNumber={deal.so_number} companyName={deal.company?.name} />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <StagePopover current={deal.stage} onChange={onStageChange} />
        </div>
        {showDefectBadge && (
          <div className="flex flex-wrap gap-1">
            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-800">
              {t.defectResolution[deal.defect_resolution]}
            </span>
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
      <div className="hidden items-center gap-2 md:flex" onClick={(e) => e.stopPropagation()}>
        <OwnerPopover
          owner={deal.owner}
          profiles={profiles}
          onChange={onOwnerChange}
        />
        <span className="truncate text-xs text-muted-foreground">
          {deal.owner?.name ?? "—"}
        </span>
      </div>

      {/* Date */}
      <div className="hidden text-right md:block">
        {deal.stage === "delivered" || resolvedDefect ? (
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
      <div className="hidden text-right md:block" onClick={(e) => e.stopPropagation()}>
        <AmountCell deal={deal} />
      </div>
    </div>
  );
}

function AmountCell({ deal }: { deal: DealRow }) {
  const isAmber =
    deal.stage === "delivered" && deal.invoice_status === "not_invoiced";
  const isBlue =
    (deal.invoice_status === "partial" || deal.invoice_status === "full") &&
    (deal.payment_status === "unpaid" || deal.payment_status === "partial");

  const colorClass = isAmber
    ? "text-amber-600"
    : isBlue
    ? "text-blue-600"
    : "text-foreground";

  return (
    <span className={cn("inline-flex items-center justify-end gap-1 text-sm font-medium leading-none", colorClass)}>
      {isAmber && (
        <AlertCircle size={14} className="shrink-0 text-amber-600" aria-hidden="true" />
      )}
      {!isAmber && isBlue && (
        <Clock size={14} className="shrink-0 text-blue-600" aria-hidden="true" />
      )}
      <span>
        {formatIsk(
          deal.defect_resolution === "refund" && deal.refund_amount_isk != null
            ? (deal.amount_isk ?? 0) - (deal.refund_amount_isk ?? 0)
            : deal.amount_isk,
        )}
      </span>
    </span>
  );
}

function OwnerPopover({
  owner,
  profiles,
  onChange,
}: {
  owner: { id: string; name: string | null } | null;
  profiles: Profile[];
  onChange: (ownerId: string | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const trigger = owner ? (
    <button
      type="button"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ide-navy text-[10px] font-medium text-white transition hover:opacity-80"
      aria-label={owner.name ?? ""}
    >
      {initials(owner.name)}
    </button>
  ) : (
    <button
      type="button"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 bg-gray-50 text-gray-400 transition hover:border-ide-navy hover:text-ide-navy"
      aria-label="assign owner"
    >
      <Plus className="h-3 w-3" />
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {profiles.map((p) => {
            const active = owner?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={async () => {
                    if (!active) await onChange(p.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ide-navy text-[10px] font-medium text-white">
                    {initials(p.name ?? p.email)}
                  </span>
                  <span className="flex-1 truncate">{p.name || p.email}</span>
                  {active && <Check className="h-4 w-4 text-ide-navy" />}
                </button>
              </li>
            );
          })}
        </ul>
        {owner && (
          <>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={async () => {
                await onChange(null);
                setOpen(false);
              }}
              className="block w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
            >
              {t.deal.unassignOwner}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function StageGroup({
  stage,
  count,
  children,
}: {
  stage: DealStage;
  count: number;
  children: React.ReactNode;
}) {
  const storageKey = `deals_stage_collapsed_${stage}`;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (count === 0) return true;
    try {
      return JSON.parse(window.sessionStorage.getItem(storageKey) || "false");
    } catch {
      return false;
    }
  });

  // Auto-collapse if empty (even if storage says expanded)
  useEffect(() => {
    if (count === 0 && !collapsed) setCollapsed(true);
  }, [count, collapsed]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return (
    <section>
      <button
        type="button"
        onClick={toggle}
        className="mb-2 flex w-full items-center gap-2 text-gray-400 transition hover:text-gray-600"
        style={{ fontSize: "11px" }}
      >
        <span className="h-px flex-1 bg-border" />
        <span className="uppercase tracking-wider">
          {t.dealStage[stage]} ({count})
        </span>
        <span className="h-px flex-1 bg-border" />
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-transform",
            collapsed && "-rotate-90",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </section>
  );
}
