import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Search, Settings, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatDate, formatIsk, formatNumber } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  ALL_PO_STATUSES,
  HAPPY_PATH_PO_STATUSES,
  PO_STATUS_STYLES,
  type POStatus,
} from "@/lib/poConstants";
import { rememberDealReturnPath } from "@/lib/dealReturn";
import { CreatePoDrawer } from "./CreatePoDrawer";
import { SupplierManagementDrawer } from "./SupplierManagementDrawer";
import { logPoStatusChanged, logPoReceived, logPoPaid } from "@/lib/poActivityLog";

type PORow = Database["public"]["Tables"]["purchase_orders"]["Row"] & {
  supplier_record: { id: string; name: string; default_currency: string } | null;
  deal:
    | {
        id: string;
        so_number: string;
        name: string;
        company: { id: string; name: string } | null;
      }
    | null;
};

type SupplierLite = {
  id: string;
  name: string;
};

const NAVY = "#1a2540";

interface Props {
  currentProfileId: string;
}

export function InnkaupList({ currentProfileId }: Props) {
  const navigate = useNavigate();
  const [pos, setPos] = useState<PORow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [activeStatus, setActiveStatus] = useState<POStatus | null>(null);
  const [activeSupplierId, setActiveSupplierId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierMgmtOpen, setSupplierMgmtOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setSearchValue(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("active", true)
      .order("name");
    setSuppliers((data ?? []) as SupplierLite[]);
  };

  const load = async () => {
    setLoading(true);
    const term = searchValue ? `%${searchValue}%` : null;
    let q = supabase
      .from("purchase_orders")
      .select(
        `*,
         supplier_record:suppliers(id, name, default_currency),
         deal:deals(id, so_number, name, company:companies(id, name))`,
      )
      .order("order_date", { ascending: false, nullsFirst: false });
    if (term) {
      q = q.or(`po_number.ilike.${term},supplier_reference.ilike.${term}`);
    }
    const { data } = await q;
    let rows = (data ?? []) as PORow[];

    // Client-side filtering for supplier name + linked deal SO
    if (searchValue) {
      const lower = searchValue.toLowerCase();
      const { data: all } = await supabase
        .from("purchase_orders")
        .select(
          `*,
           supplier_record:suppliers(id, name, default_currency),
           deal:deals(id, so_number, name, company:companies(id, name))`,
        )
        .order("order_date", { ascending: false, nullsFirst: false })
        .limit(2000);
      const allRows = (all ?? []) as PORow[];
      rows = allRows.filter(
        (r) =>
          r.po_number.toLowerCase().includes(lower) ||
          r.supplier_reference?.toLowerCase().includes(lower) ||
          r.supplier_record?.name.toLowerCase().includes(lower) ||
          r.supplier?.toLowerCase().includes(lower) ||
          r.deal?.so_number.toLowerCase().includes(lower) ||
          r.deal?.name.toLowerCase().includes(lower),
      );
    }

    setPos(rows);
    setLoading(false);
  };

  useEffect(() => {
    void loadSuppliers();
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  // Counts: ALWAYS reflect true totals (ignore supplier filter for status counts? — apply both filters)
  const statusCounts = useMemo(() => {
    const counts: Record<POStatus, number> = {
      ordered: 0,
      received: 0,
      invoiced: 0,
      paid: 0,
      cancelled: 0,
    };
    pos.forEach((p) => {
      // Apply supplier filter to counts so they match what the user will see
      if (activeSupplierId && p.supplier_id !== activeSupplierId) return;
      counts[p.status] = (counts[p.status] ?? 0) + 1;
    });
    return counts;
  }, [pos, activeSupplierId]);

  const supplierCounts = useMemo(() => {
    const map = new Map<string, number>();
    pos.forEach((p) => {
      if (activeStatus) {
        if (p.status !== activeStatus) return;
      } else {
        if (p.status === "cancelled") return; // default view hides cancelled
      }
      if (!p.supplier_id) return;
      map.set(p.supplier_id, (map.get(p.supplier_id) ?? 0) + 1);
    });
    return map;
  }, [pos, activeStatus]);

  // Apply both filters
  const filtered = useMemo(() => {
    return pos.filter((p) => {
      if (activeSupplierId && p.supplier_id !== activeSupplierId) return false;
      if (activeStatus) {
        return p.status === activeStatus;
      }
      return p.status !== "cancelled";
    });
  }, [pos, activeStatus, activeSupplierId]);

  const grouped = useMemo(() => {
    if (activeStatus) return null;
    const order: POStatus[] = HAPPY_PATH_PO_STATUSES;
    const groups = new Map<POStatus, PORow[]>();
    order.forEach((s) => groups.set(s, []));
    filtered.forEach((p) => {
      const arr = groups.get(p.status);
      if (arr) arr.push(p);
    });
    return order
      .map((s) => ({ status: s, rows: groups.get(s) ?? [] }))
      .filter((g) => g.rows.length > 0);
  }, [filtered, activeStatus]);

  const handleRowClick = (po: PORow) => {
    rememberDealReturnPath("/innkaup");
    if (po.deal) {
      navigate({
        to: "/deals/$id",
        params: { id: po.deal.id },
        hash: `po-${po.id}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t.purchaseOrder.pageTitle}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setSupplierMgmtOpen(true)}
          >
            <Settings className="mr-1 h-4 w-4" />
            {t.purchaseOrder.manageSuppliers}
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            <Plus className="mr-1 h-4 w-4" />
            {t.purchaseOrder.create}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t.purchaseOrder.searchPlaceholder}
          className="pl-9 pr-9"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Supplier strip */}
      <div className="space-y-1">
        <div className="text-xs font-medium uppercase text-muted-foreground">
          {t.purchaseOrder.suppliersFilterLabel}
        </div>
        <div className="flex flex-wrap gap-2">
          {activeSupplierId
            ? (() => {
                const s = suppliers.find((x) => x.id === activeSupplierId);
                if (!s) return null;
                const count = supplierCounts.get(s.id) ?? 0;
                return (
                  <button
                    type="button"
                    onClick={() => setActiveSupplierId(null)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-ide-navy px-3 py-1 text-sm text-white"
                  >
                    {s.name} ({count})
                    <X className="h-3.5 w-3.5" />
                  </button>
                );
              })()
            : suppliers.map((s) => {
                const count = supplierCounts.get(s.id) ?? 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSupplierId(s.id)}
                    className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-sm hover:bg-muted"
                  >
                    {s.name} <span className="ml-1 text-muted-foreground">({count})</span>
                  </button>
                );
              })}
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_PO_STATUSES.map((s) => {
          const count = statusCounts[s] ?? 0;
          const isActive = activeStatus === s;
          const isHidden =
            !!activeStatus && !isActive
              ? false
              : !activeStatus && s === "cancelled" && count === 0
                ? false
                : false;
          if (isHidden) return null;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActiveStatus(isActive ? null : s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                isActive
                  ? "border-ide-navy bg-ide-navy text-white"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {t.poStatus[s]} <span className={cn("ml-0.5", isActive ? "text-white/80" : "text-muted-foreground")}>({count})</span>
              {isActive && <X className="h-3.5 w-3.5" />}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          {t.status.loading}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t.purchaseOrder.noOrders}
        </div>
      ) : grouped ? (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.status} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  {t.poStatus[g.status]}
                </div>
                <div className="h-px flex-1 bg-border" />
                <div className="text-xs text-muted-foreground">{g.rows.length}</div>
              </div>
              <div className="space-y-2">
                {g.rows.map((p) => (
                  <PoRow
                    key={p.id}
                    po={p}
                    onClick={() => handleRowClick(p)}
                    onStatusChange={async (next) => {
                      await changePoStatus(p, next, currentProfileId);
                      await load();
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <PoRow
              key={p.id}
              po={p}
              onClick={() => handleRowClick(p)}
              onStatusChange={async (next) => {
                await changePoStatus(p, next, currentProfileId);
                await load();
              }}
            />
          ))}
        </div>
      )}

      <CreatePoDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        currentProfileId={currentProfileId}
      />
      <SupplierManagementDrawer
        open={supplierMgmtOpen}
        onOpenChange={setSupplierMgmtOpen}
        onChanged={() => {
          void loadSuppliers();
          void load();
        }}
      />
    </div>
  );
}

async function changePoStatus(
  po: PORow,
  next: POStatus,
  currentProfileId: string,
) {
  const today = new Date().toISOString().split("T")[0];
  const patch: Partial<Database["public"]["Tables"]["purchase_orders"]["Update"]> = {
    status: next,
  };
  if (next === "received" && !po.received_date) patch.received_date = today;
  if (next === "paid" && !po.paid_date) patch.paid_date = today;
  await supabase.from("purchase_orders").update(patch).eq("id", po.id);
  await logPoStatusChanged({
    dealId: po.deal_id,
    poNumber: po.po_number,
    newStatus: next,
    createdBy: currentProfileId,
  });
  if (next === "received" && !po.received_date) {
    await logPoReceived({
      dealId: po.deal_id,
      poNumber: po.po_number,
      receivedDate: today,
      createdBy: currentProfileId,
    });
  }
  if (next === "paid" && !po.paid_date) {
    await logPoPaid({
      dealId: po.deal_id,
      poNumber: po.po_number,
      paidDate: today,
      createdBy: currentProfileId,
    });
  }
}

interface RowProps {
  po: PORow;
  onClick: () => void;
  onStatusChange: (next: POStatus) => Promise<void>;
}

function PoRow({ po, onClick, onStatusChange }: RowProps) {
  const style = PO_STATUS_STYLES[po.status];
  const supplierName = po.supplier_record?.name ?? po.supplier ?? "—";
  const total = (Number(po.amount ?? 0) + Number(po.shipping_cost ?? 0));
  const totalIsk = po.exchange_rate ? total * Number(po.exchange_rate) : null;

  // Date column — show received_date when status >= received
  const isPastReceived =
    po.status === "received" || po.status === "invoiced" || po.status === "paid";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expectedDate = po.expected_delivery_date
    ? new Date(po.expected_delivery_date)
    : null;
  const expectedOverdue =
    expectedDate && !isPastReceived && expectedDate < today;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
      className={cn(
        "group relative flex flex-wrap items-center gap-4 rounded-md border border-border p-3 text-sm transition-colors hover:brightness-95",
        style.muted && "text-muted-foreground",
      )}
      style={{
        borderLeft: `4px solid ${style.border}`,
        backgroundColor: style.bg,
      }}
    >
      {/* PO# + status badge */}
      <div className="min-w-[150px]">
        <div className="font-mono text-xs text-muted-foreground">
          {po.po_number}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "mt-0.5 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium hover:opacity-80",
                  style.badge,
                )}
              >
                {t.poStatus[po.status]}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="start">
              <div className="flex flex-col">
                {HAPPY_PATH_PO_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void onStatusChange(s)}
                    className={cn(
                      "rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                      po.status === s && "font-semibold",
                    )}
                    style={po.status === s ? { color: NAVY } : undefined}
                  >
                    {t.poStatus[s]}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Supplier */}
      <div className="min-w-[160px]">
        <div className="font-medium text-foreground">{supplierName}</div>
        {po.supplier_reference && (
          <div className="text-xs text-muted-foreground">{po.supplier_reference}</div>
        )}
      </div>

      {/* Linked deal */}
      <div className="min-w-[200px]" onClick={(e) => e.stopPropagation()}>
        {po.deal ? (
          <Link
            to="/deals/$id"
            params={{ id: po.deal.id }}
            onClick={() => rememberDealReturnPath("/innkaup")}
            className="block hover:underline"
          >
            <div className="text-xs font-mono text-muted-foreground">
              {po.deal.so_number}
            </div>
            <div className="text-sm font-medium text-foreground">{po.deal.name}</div>
            {po.deal.company && (
              <div className="text-xs text-muted-foreground">{po.deal.company.name}</div>
            )}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      {/* Order date */}
      <div className="min-w-[100px]">
        <div className="text-[10px] uppercase text-muted-foreground">{t.purchaseOrder.orderedShort}</div>
        <div className="text-sm">{formatDate(po.order_date) || "—"}</div>
      </div>

      {/* Expected / received */}
      <div className="min-w-[120px]">
        {isPastReceived ? (
          <>
            <div className="text-[10px] uppercase text-green-700">{t.purchaseOrder.received_date}</div>
            <div className="text-sm">{formatDate(po.received_date) || "—"}</div>
          </>
        ) : (
          <>
            <div className="text-[10px] uppercase text-muted-foreground">{t.purchaseOrder.expected_delivery_date}</div>
            <div className={cn("text-sm", expectedOverdue && "text-red-600 font-medium")}>
              {formatDate(po.expected_delivery_date) || "—"}
            </div>
          </>
        )}
      </div>

      {/* Amount */}
      <div className="ml-auto text-right">
        <div className="text-sm font-medium text-foreground tabular-nums">
          {totalIsk !== null ? formatIsk(totalIsk) : "—"}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {po.currency} {formatNumber(total, 2)}
        </div>
      </div>
    </div>
  );
}
