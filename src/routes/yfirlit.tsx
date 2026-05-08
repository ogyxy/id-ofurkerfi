import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Coffee,
  Download,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { AppMain } from "@/components/AppMain";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { filterVisibleProfiles } from "@/lib/hiddenUsers";
import { t, formatIsk } from "@/lib/sala_translations_is";
import { ExportReportDialog } from "@/components/yfirlit/ExportReportDialog";
import { BulletBar } from "@/components/yfirlit/BulletBar";
import {
  computePaceState,
  daysBetween,
  formatIcelandicDate,
  getQuarterRange,
  getYearRange,
  
  paceColor,
  type PaceState,
} from "@/components/yfirlit/paceHelpers";
import { useCurrentRole } from "@/hooks/useCurrentProfile";
import { canSeeFinancials } from "@/lib/role";
import { UserAvatar } from "@/components/UserAvatar";

export const Route = createFileRoute("/yfirlit")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${t.yfirlit.pageTitle} — ${t.brand.name}` }],
  }),
  component: YfirlitPage,
});

// ---------- Types ----------
interface Profile {
  id: string;
  name: string | null;
  email: string;
  role: string;
  avatar_url?: string | null;
}

type TaskTier = "critical" | "urgent" | "advisory";
type TaskType =
  | "overdue"
  | "defect_pending"
  | "unpaid_old"
  | "delivery_mismatch"
  | "po_invoice_approval"
  | "delivered_uninvoiced";

interface TaskItem {
  type: TaskType;
  tier: TaskTier;
  staleDays: number;
  staleLabel: string;
  deal: {
    id: string;
    so_number: string;
    name: string;
    company?: { id: string; name: string } | null;
  };
  poId?: string;
  poNumber?: string;
}

interface PulseStats {
  revenue: number;
  count: number;
  avgDeal: number;
  marginPct: number;
}

interface CustomerRow {
  id: string;
  name: string;
  total: number;
  count: number;
}

interface ActivityRow {
  id: string;
  type: string;
  body: string | null;
  created_at: string;
  profile?: { id: string; name: string | null; email?: string | null; avatar_url?: string | null } | null;
  deal?: {
    id: string;
    so_number: string;
    name: string;
    company?: { id: string; name: string } | null;
  } | null;
}

interface TargetRow {
  owner_id: string;
  period_type: "quarter" | "year";
  period_start: string;
  period_end: string;
  target_isk: number;
}

interface TrendPoint {
  month: string;
  label: string;
  revenue: number;
  margin: number;
  marginPct: number;
}

// ---------- Helpers ----------
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return t.yfirlit.greetingMorning;
  if (h < 17) return t.yfirlit.greetingAfter;
  return t.yfirlit.greetingEvening;
}

function firstName(name: string | null | undefined, email: string): string {
  if (name && name.trim()) return name.trim().split(/\s+/)[0];
  return email.split("@")[0];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "núna";
  if (min < 60) return `${min} mín síðan`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} klst síðan`;
  const d = Math.floor(h / 24);
  return `${d} d síðan`;
}

function deltaArrow(curr: number, prev: number): { sign: "up" | "down" | "flat"; pct: number } {
  if (prev === 0 && curr === 0) return { sign: "flat", pct: 0 };
  if (prev === 0) return { sign: "up", pct: 100 };
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 0.5) return { sign: "flat", pct: 0 };
  return { sign: pct > 0 ? "up" : "down", pct: Math.abs(pct) };
}

function staleLabelFor(type: TaskType, days: number): string {
  if (type === "unpaid_old") return t.yfirlit.tasksStaleOverdue.replace("{n}", String(days));
  if (type === "delivered_uninvoiced") return t.yfirlit.tasksStaleUninvoiced.replace("{n}", String(days));
  if (type === "defect_pending") return t.yfirlit.tasksStaleDefect.replace("{n}", String(days));
  return t.yfirlit.tasksStaleGeneric.replace("{n}", String(days));
}

function tierFor(type: TaskType): TaskTier {
  if (type === "unpaid_old" || type === "defect_pending" || type === "delivery_mismatch") return "critical";
  if (type === "delivered_uninvoiced" || type === "po_invoice_approval") return "urgent";
  return "advisory";
}

function staleColor(days: number): string {
  if (days > 30) return "text-red-600";
  if (days >= 8) return "text-amber-600";
  return "text-muted-foreground";
}

function paceStateLabel(s: PaceState): string {
  if (s === "ahead") return t.yfirlit.paceAhead;
  if (s === "behind") return t.yfirlit.paceBehind;
  return t.yfirlit.paceOnTrack;
}

function paceChipClass(s: PaceState): string {
  if (s === "ahead") return "bg-emerald-100 text-emerald-700";
  if (s === "behind") return "bg-amber-100 text-amber-700";
  return "bg-muted text-muted-foreground";
}

// ---------- Page ----------
function YfirlitPage() {
  return (
    <ProtectedRoute>
      {(session) => (
        <div className="min-h-screen bg-background">
          <Sidebar activeKey="dashboard" userEmail={session.user.email ?? ""} />
          <AppMain>
            <YfirlitContent
              currentUserId={session.user.id}
              currentUserEmail={session.user.email ?? ""}
            />
          </AppMain>
        </div>
      )}
    </ProtectedRoute>
  );
}

function YfirlitContent({
  currentUserId,
  currentUserEmail,
}: {
  currentUserId: string;
  currentUserEmail: string;
}) {
  const role = useCurrentRole();
  const showFinancials = canSeeFinancials(role);
  const isAdmin = role === "admin";
  const [profiles, setProfiles] = useState<Profile[]>([]);
  // Owner filter for the Flagged Deals section (independent of admin "view as")
  const [tasksOwnerId, setTasksOwnerId] = useState<string>(currentUserId);
  // Admin-only "view dashboard as" — empty string = "all team"
  const [viewAsId, setViewAsId] = useState<string>(currentUserId);

  const dashboardUserId = isAdmin ? viewAsId : currentUserId;
  const isAllTeam = isAdmin && viewAsId === "";

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [showAdvisory, setShowAdvisory] = useState(false);
  const [paceMode, setPaceMode] = useState<"quarter" | "year">("quarter");

  const [pulse, setPulse] = useState<PulseStats>({ revenue: 0, count: 0, avgDeal: 0, marginPct: 0 });
  const [prevYearPulse, setPrevYearPulse] = useState<PulseStats>({ revenue: 0, count: 0, avgDeal: 0, marginPct: 0 });
  const [pulseSparks, setPulseSparks] = useState<{ revenue: number[]; count: number[]; avgDeal: number[]; marginPct: number[] }>({
    revenue: [], count: [], avgDeal: [], marginPct: [],
  });

  const [marginTrend, setMarginTrend] = useState<TrendPoint[]>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [exportOpen, setExportOpen] = useState(false);

  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [quarterDeals, setQuarterDeals] = useState<Array<{ owner_id: string; net: number; delivered_at: string; margin: number; amount: number; company?: { id: string; name: string } | null }>>([]);
  const [yearDeals, setYearDeals] = useState<Array<{ owner_id: string; net: number; delivered_at: string }>>([]);
  const [spotlightWeekData, setSpotlightWeekData] = useState<Array<{ owner_id: string; net: number; delivered_at: string; amount: number; margin: number; company?: { id: string; name: string } | null }>>([]);

  // Warnings state
  const [marginDrops, setMarginDrops] = useState<Array<{ id: string; name: string; prev: number; curr: number }>>([]);
  const [dormant, setDormant] = useState<Array<{ id: string; name: string; days: number; avg: number }>>([]);
  const [pipelineValue, setPipelineValue] = useState(0);

  // Admin extras
  const [longestStuck, setLongestStuck] = useState<Array<{ id: string; so_number: string; company: string; stage: string; days: number }>>([]);
  const [marginHigh, setMarginHigh] = useState<Array<{ id: string; so_number: string; company: string; pct: number }>>([]);
  const [marginLow, setMarginLow] = useState<Array<{ id: string; so_number: string; company: string; pct: number }>>([]);
  const [concentration, setConcentration] = useState<{ top5Pct: number } | null>(null);

  const dashboardProfile = profiles.find((p) => p.id === dashboardUserId);
  const dashboardFirstName = dashboardProfile
    ? firstName(dashboardProfile.name, dashboardProfile.email)
    : firstName(null, currentUserEmail);

  const tasksOwnerProfile = profiles.find((p) => p.id === tasksOwnerId);
  const tasksOwnerFirstName = tasksOwnerProfile
    ? firstName(tasksOwnerProfile.name, tasksOwnerProfile.email)
    : firstName(null, currentUserEmail);

  // Today / period anchors
  const today = useMemo(() => new Date(), []);
  const dateLabel = formatIcelandicDate(today, t.yfirlit.weekdaysLong, t.yfirlit.monthsLong);

  // Load profiles
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, email, role, avatar_url")
        .eq("active", true)
        .order("name", { ascending: true });
      if (data) setProfiles(filterVisibleProfiles(data as Profile[]));
    })();
  }, []);

  // Load Flagged Deals tasks (uses tasksOwnerId)
  useEffect(() => {
    (async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("deals")
        .select(
          `id, so_number, name, stage, amount_isk,
           promised_delivery_date, delivered_at,
           estimated_delivery_date,
           invoice_status, payment_status,
           defect_resolution, invoice_date, updated_at,
           company:companies(id, name, payment_terms_days)`,
        )
        .eq("owner_id", tasksOwnerId)
        .eq("archived", false);

      const out: TaskItem[] = [];
      const pushTask = (type: TaskType, dealRef: TaskItem["deal"], staleDays: number, extra?: Partial<TaskItem>) => {
        out.push({
          type,
          tier: tierFor(type),
          staleDays,
          staleLabel: staleLabelFor(type, staleDays),
          deal: dealRef,
          ...extra,
        });
      };

      (data ?? []).forEach((d: any) => {
        const dealRef = {
          id: d.id,
          so_number: d.so_number,
          name: d.name,
          company: d.company ? { id: d.company.id, name: d.company.name } : null,
        };
        if (
          d.stage !== "delivered" &&
          d.stage !== "cancelled" &&
          d.stage !== "defect_reorder" &&
          d.promised_delivery_date &&
          d.promised_delivery_date < todayStr
        ) {
          const days = daysBetween(new Date(d.promised_delivery_date), new Date());
          pushTask("overdue", dealRef, days);
        }
        if (d.stage === "delivered" && d.invoice_status === "not_invoiced") {
          const days = d.delivered_at ? daysBetween(new Date(d.delivered_at), new Date()) : 0;
          pushTask("delivered_uninvoiced", dealRef, days);
        }
        if (d.stage === "defect_reorder" && d.defect_resolution === "pending") {
          const days = d.updated_at ? daysBetween(new Date(d.updated_at), new Date()) : 0;
          pushTask("defect_pending", dealRef, days);
        }
        if (
          d.stage !== "delivered" &&
          d.stage !== "cancelled" &&
          d.promised_delivery_date &&
          d.estimated_delivery_date &&
          d.estimated_delivery_date > d.promised_delivery_date
        ) {
          const days = daysBetween(new Date(d.promised_delivery_date), new Date(d.estimated_delivery_date));
          pushTask("delivery_mismatch", dealRef, days);
        }
        const invDate = d.invoice_date;
        if (
          d.invoice_status &&
          d.invoice_status !== "not_invoiced" &&
          d.payment_status === "unpaid" &&
          invDate
        ) {
          const days = daysBetween(new Date(invDate), new Date());
          const terms = d.company?.payment_terms_days || 14;
          if (days > terms) {
            pushTask("unpaid_old", dealRef, days - terms);
          }
        }
      });

      const { data: pendingPos } = await supabase
        .from("purchase_orders")
        .select(
          `id, po_number, invoice_received_date, invoice_approved_at, status, archived,
           deal:deals!inner(id, so_number, name, owner_id, archived,
             company:companies(id, name))`,
        )
        .not("invoice_received_date", "is", null)
        .is("invoice_approved_at", null)
        .neq("status", "cancelled")
        .eq("archived", false);
      (pendingPos ?? []).forEach((p: any) => {
        const d = p.deal;
        if (!d || d.archived) return;
        if (d.owner_id !== tasksOwnerId) return;
        const days = p.invoice_received_date ? daysBetween(new Date(p.invoice_received_date), new Date()) : 0;
        pushTask(
          "po_invoice_approval",
          {
            id: d.id,
            so_number: d.so_number,
            name: d.name,
            company: d.company ? { id: d.company.id, name: d.company.name } : null,
          },
          days,
          { poId: p.id, poNumber: p.po_number },
        );
      });

      setTasks(out);
    })();
  }, [tasksOwnerId]);

  // Load pulse + 6-week sparklines + YoY (for dashboardUserId or all)
  useEffect(() => {
    (async () => {
      const now = new Date();
      const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const yoyEnd = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const yoyStart = new Date(yoyEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sparkStart = new Date(now.getTime() - 6 * 7 * 24 * 60 * 60 * 1000);
      const sixMoAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const earliest = new Date(Math.min(yoyStart.getTime(), sparkStart.getTime(), sixMoAgo.getTime()));

      let q = supabase
        .from("deals")
        .select("id, owner_id, amount_isk, total_margin_isk, refund_amount_isk, delivered_at, total_price_isk")
        .eq("archived", false)
        .gte("delivered_at", earliest.toISOString().split("T")[0]);
      if (!isAllTeam) q = q.eq("owner_id", dashboardUserId);
      const { data: rows } = await q;

      const calc = (xs: any[]): PulseStats => {
        const net = xs.reduce((s, d) => s + ((d.amount_isk || 0) - (d.refund_amount_isk || 0)), 0);
        const margin = xs.reduce((s, d) => s + ((d.total_margin_isk || 0) - (d.refund_amount_isk || 0)), 0);
        return {
          revenue: net,
          count: xs.length,
          avgDeal: xs.length ? net / xs.length : 0,
          marginPct: net > 0 ? (margin / net) * 100 : 0,
        };
      };

      const inWin = (d: any, a: Date, b: Date) =>
        d.delivered_at && new Date(d.delivered_at) >= a && new Date(d.delivered_at) < b;

      const last30 = (rows ?? []).filter((d) => inWin(d, thirtyAgo, new Date(now.getTime() + 86400000)));
      const yoy = (rows ?? []).filter((d) => inWin(d, yoyStart, yoyEnd));
      setPulse(calc(last30));
      setPrevYearPulse(calc(yoy));

      // 6-week sparklines: bucket by week
      const sparks = { revenue: [] as number[], count: [] as number[], avgDeal: [] as number[], marginPct: [] as number[] };
      for (let i = 5; i >= 0; i--) {
        const a = new Date(now.getTime() - (i + 1) * 7 * 86400000);
        const b = new Date(now.getTime() - i * 7 * 86400000);
        const xs = (rows ?? []).filter((d) => inWin(d, a, b));
        const s = calc(xs);
        sparks.revenue.push(s.revenue);
        sparks.count.push(s.count);
        sparks.avgDeal.push(s.avgDeal);
        sparks.marginPct.push(s.marginPct);
      }
      setPulseSparks(sparks);

      // 6-month margin trend (same scoping)
      const buckets: Record<string, { revenue: number; margin: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets[key] = { revenue: 0, margin: 0 };
      }
      (rows ?? []).forEach((d: any) => {
        if (!d.delivered_at) return;
        const key = String(d.delivered_at).slice(0, 7);
        if (!buckets[key]) return;
        buckets[key].revenue += (d.amount_isk || 0) - (d.refund_amount_isk || 0);
        buckets[key].margin += (d.total_margin_isk || 0) - (d.refund_amount_isk || 0);
      });
      const trend = Object.keys(buckets).sort().map((key) => {
        const m = Number(key.slice(5, 7)) - 1;
        const b = buckets[key];
        return {
          month: key,
          label: t.yfirlit.monthsShort[m],
          revenue: b.revenue,
          margin: b.margin,
          marginPct: b.revenue > 0 ? (b.margin / b.revenue) * 100 : 0,
        };
      });
      setMarginTrend(trend);
    })();
  }, [dashboardUserId, isAllTeam]);

  // Load top customers (year)
  useEffect(() => {
    (async () => {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
      let q = supabase
        .from("deals")
        .select("amount_isk, refund_amount_isk, delivered_at, owner_id, company:companies(id, name)")
        .eq("archived", false)
        .gte("delivered_at", startOfYear);
      if (!isAllTeam) q = q.eq("owner_id", dashboardUserId);
      const { data } = await q;
      const by: Record<string, CustomerRow> = {};
      (data ?? []).forEach((d: any) => {
        if (!d.company) return;
        const id = d.company.id;
        if (!by[id]) by[id] = { id, name: d.company.name, total: 0, count: 0 };
        by[id].total += (d.amount_isk || 0) - (d.refund_amount_isk || 0);
        by[id].count += 1;
      });
      setTopCustomers(Object.values(by).sort((a, b) => b.total - a.total).slice(0, 5));
    })();
  }, [dashboardUserId, isAllTeam]);

  // Activities (always team-wide)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("activities")
        .select(
          `id, type, body, created_at,
           profile:profiles!created_by(id, name, email, avatar_url),
           deal:deals(id, so_number, name, company:companies(id, name))`,
        )
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setActivities(data as unknown as ActivityRow[]);
    })();
  }, []);

  // Targets (all)
  useEffect(() => {
    (async () => {
      const yr = today.getFullYear();
      const { data } = await supabase
        .from("sales_targets")
        .select("owner_id, period_type, period_start, period_end, target_isk")
        .gte("period_start", `${yr}-01-01`)
        .lte("period_start", `${yr}-12-31`);
      setTargets((data ?? []) as TargetRow[]);
    })();
  }, [today]);

  // Quarter + year deals (for pace; team-wide so we can render team pace)
  useEffect(() => {
    (async () => {
      const qr = getQuarterRange(today);
      const yr = getYearRange(today);
      const weekAgo = new Date(today.getTime() - 7 * 86400000);
      const twoWeekAgo = new Date(today.getTime() - 14 * 86400000);
      const earliest = new Date(Math.min(yr.start.getTime(), twoWeekAgo.getTime()));
      const { data } = await supabase
        .from("deals")
        .select("owner_id, amount_isk, refund_amount_isk, total_margin_isk, delivered_at, total_price_isk, company:companies(id, name)")
        .eq("archived", false)
        .gte("delivered_at", earliest.toISOString().split("T")[0]);

      const map = (d: any) => ({
        owner_id: d.owner_id,
        net: (d.amount_isk || 0) - (d.refund_amount_isk || 0),
        margin: (d.total_margin_isk || 0) - (d.refund_amount_isk || 0),
        amount: d.amount_isk || 0,
        delivered_at: d.delivered_at,
        company: d.company ? { id: d.company.id, name: d.company.name } : null,
      });

      const all = (data ?? []).map(map);
      const inRange = (s: string, a: Date, b: Date) => {
        const d = new Date(s);
        return d >= a && d <= b;
      };
      setQuarterDeals(all.filter((d) => d.delivered_at && inRange(d.delivered_at, qr.start, qr.end)));
      setYearDeals(all.filter((d) => d.delivered_at && inRange(d.delivered_at, yr.start, yr.end)));
      setSpotlightWeekData(all.filter((d) => d.delivered_at && new Date(d.delivered_at) >= twoWeekAgo));
    })();
  }, [today]);

  // Warnings: margin drops + dormant (scoped to dashboardUserId or all)
  useEffect(() => {
    (async () => {
      if (!showFinancials) return;
      const now = new Date();
      const ninetyAgo = new Date(now.getTime() - 90 * 86400000);
      const oneEightyAgo = new Date(now.getTime() - 180 * 86400000);
      const oneYearAgo = new Date(now.getTime() - 365 * 86400000);
      let q = supabase
        .from("deals")
        .select("id, amount_isk, total_margin_isk, refund_amount_isk, delivered_at, owner_id, company:companies(id, name)")
        .eq("archived", false)
        .gte("delivered_at", oneYearAgo.toISOString().split("T")[0]);
      if (!isAllTeam) q = q.eq("owner_id", dashboardUserId);
      const { data } = await q;
      const rows = (data ?? []) as any[];

      // Margin drop per company
      const byCo: Record<string, { name: string; prev: { rev: number; margin: number }; curr: { rev: number; margin: number } }> = {};
      rows.forEach((d) => {
        if (!d.company || !d.delivered_at) return;
        const dt = new Date(d.delivered_at);
        const net = (d.amount_isk || 0) - (d.refund_amount_isk || 0);
        const margin = (d.total_margin_isk || 0) - (d.refund_amount_isk || 0);
        const id = d.company.id;
        if (!byCo[id]) byCo[id] = { name: d.company.name, prev: { rev: 0, margin: 0 }, curr: { rev: 0, margin: 0 } };
        if (dt >= ninetyAgo) {
          byCo[id].curr.rev += net;
          byCo[id].curr.margin += margin;
        } else if (dt >= oneEightyAgo) {
          byCo[id].prev.rev += net;
          byCo[id].prev.margin += margin;
        }
      });
      const drops: Array<{ id: string; name: string; prev: number; curr: number }> = [];
      Object.entries(byCo).forEach(([id, v]) => {
        if (v.prev.rev <= 0 || v.curr.rev <= 0) return;
        const prevPct = (v.prev.margin / v.prev.rev) * 100;
        const currPct = (v.curr.margin / v.curr.rev) * 100;
        if (prevPct - currPct >= 8) {
          drops.push({ id, name: v.name, prev: prevPct, curr: currPct });
        }
      });
      drops.sort((a, b) => (b.prev - b.curr) - (a.prev - a.curr));
      setMarginDrops(drops.slice(0, 3));

      // Dormant detection
      const cadence: Record<string, { name: string; dates: Date[] }> = {};
      rows.forEach((d) => {
        if (!d.company || !d.delivered_at) return;
        const id = d.company.id;
        if (!cadence[id]) cadence[id] = { name: d.company.name, dates: [] };
        cadence[id].dates.push(new Date(d.delivered_at));
      });
      const sixtyAgo = new Date(now.getTime() - 60 * 86400000);
      const dormantList: Array<{ id: string; name: string; days: number; avg: number }> = [];
      Object.entries(cadence).forEach(([id, v]) => {
        if (v.dates.length < 3) return;
        const sorted = v.dates.sort((a, b) => a.getTime() - b.getTime());
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) intervals.push(daysBetween(sorted[i - 1], sorted[i]));
        const avg = intervals.reduce((s, n) => s + n, 0) / intervals.length;
        const last = sorted[sorted.length - 1];
        if (last >= sixtyAgo) return;
        const daysSince = daysBetween(last, now);
        const threshold = Math.min(2 * avg, 180);
        if (daysSince > threshold) {
          dormantList.push({ id, name: v.name, days: daysSince, avg: Math.round(avg) });
        }
      });
      dormantList.sort((a, b) => b.days - a.days);
      setDormant(dormantList.slice(0, 3));

      // Pipeline value
      let pq = supabase
        .from("deals")
        .select("total_price_isk, owner_id")
        .eq("archived", false)
        .in("stage", ["quote_in_progress", "quote_sent"]);
      if (!isAllTeam) pq = pq.eq("owner_id", dashboardUserId);
      const { data: pipe } = await pq;
      setPipelineValue((pipe ?? []).reduce((s: number, d: any) => s + (d.total_price_isk || 0), 0));
    })();
  }, [dashboardUserId, isAllTeam, showFinancials]);

  // Admin extras
  useEffect(() => {
    if (!isAdmin || !isAllTeam) return;
    (async () => {
      // Longest stuck (open stages): rough heuristic — days since updated_at
      const { data: stuck } = await supabase
        .from("deals")
        .select("id, so_number, stage, updated_at, company:companies(id, name)")
        .eq("archived", false)
        .in("stage", ["inquiry", "quote_in_progress", "quote_sent", "order_confirmed"])
        .order("updated_at", { ascending: true })
        .limit(5);
      setLongestStuck(
        (stuck ?? []).map((d: any) => ({
          id: d.id,
          so_number: d.so_number,
          company: d.company?.name ?? "—",
          stage: (t.dealStage as Record<string, string>)[d.stage] ?? d.stage,
          days: d.updated_at ? daysBetween(new Date(d.updated_at), new Date()) : 0,
        })),
      );

      // Margin outliers (last 90 days)
      const ninety = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
      const { data: m } = await supabase
        .from("deals")
        .select("id, so_number, amount_isk, total_margin_isk, refund_amount_isk, delivered_at, company:companies(id, name)")
        .eq("archived", false)
        .gte("delivered_at", ninety);
      const scored = (m ?? [])
        .map((d: any) => {
          const net = (d.amount_isk || 0) - (d.refund_amount_isk || 0);
          const mg = (d.total_margin_isk || 0) - (d.refund_amount_isk || 0);
          return {
            id: d.id,
            so_number: d.so_number,
            company: d.company?.name ?? "—",
            pct: net > 0 ? (mg / net) * 100 : 0,
            net,
          };
        })
        .filter((d) => d.net > 0);
      scored.sort((a, b) => b.pct - a.pct);
      setMarginHigh(scored.slice(0, 3));
      setMarginLow([...scored].sort((a, b) => a.pct - b.pct).slice(0, 3));

      // Concentration: trailing 12 months
      const { data: y } = await supabase
        .from("deals")
        .select("amount_isk, refund_amount_isk, delivered_at, company:companies(id, name)")
        .eq("archived", false)
        .gte("delivered_at", new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0]);
      const byCustomer: Record<string, number> = {};
      let total = 0;
      (y ?? []).forEach((d: any) => {
        if (!d.company) return;
        const v = (d.amount_isk || 0) - (d.refund_amount_isk || 0);
        byCustomer[d.company.id] = (byCustomer[d.company.id] ?? 0) + v;
        total += v;
      });
      const sorted = Object.values(byCustomer).sort((a, b) => b - a);
      const top5 = sorted.slice(0, 5).reduce((s, n) => s + n, 0);
      setConcentration({ top5Pct: total > 0 ? (top5 / total) * 100 : 0 });
    })();
  }, [isAdmin, isAllTeam]);

  // ---------- Pace computations ----------
  const qr = getQuarterRange(today);
  const yr = getYearRange(today);
  const totalDaysQ = daysBetween(qr.start, qr.end) + 1;
  const elapsedQ = Math.max(daysBetween(qr.start, today) + 1, 1);
  const remainingQ = Math.max(totalDaysQ - elapsedQ, 0);
  const expectedPctQ = Math.min(elapsedQ / totalDaysQ, 1);
  const totalDaysY = daysBetween(yr.start, yr.end) + 1;
  const elapsedY = Math.max(daysBetween(yr.start, today) + 1, 1);
  const expectedPctY = Math.min(elapsedY / totalDaysY, 1);

  const targetForUser = (userId: string, type: "quarter" | "year"): number => {
    const ps = type === "quarter" ? qr.start.toISOString().split("T")[0] : yr.start.toISOString().split("T")[0];
    const t0 = targets.find((x) => x.owner_id === userId && x.period_type === type && x.period_start === ps);
    return t0 ? Number(t0.target_isk) : 0;
  };

  const myQuarterRev = quarterDeals.filter((d) => d.owner_id === dashboardUserId).reduce((s, d) => s + d.net, 0);
  const myYearRev = yearDeals.filter((d) => d.owner_id === dashboardUserId).reduce((s, d) => s + d.net, 0);
  const myQuarterTarget = isAllTeam
    ? targets.filter((t) => t.period_type === "quarter" && t.period_start === qr.start.toISOString().split("T")[0]).reduce((s, t) => s + Number(t.target_isk), 0)
    : targetForUser(dashboardUserId, "quarter");
  const myYearTarget = isAllTeam
    ? targets.filter((t) => t.period_type === "year" && t.period_start === yr.start.toISOString().split("T")[0]).reduce((s, t) => s + Number(t.target_isk), 0)
    : targetForUser(dashboardUserId, "year");
  const teamQuarterRev = isAllTeam ? quarterDeals.reduce((s, d) => s + d.net, 0) : myQuarterRev;

  const myPaceState = computePaceState(myQuarterRev, myQuarterTarget, expectedPctQ);
  const myPaceFillPct = myQuarterTarget > 0 ? (myQuarterRev / myQuarterTarget) * 100 : 0;
  const myYearState = computePaceState(myYearRev, myYearTarget, expectedPctY);

  // Team pace (sales+admin only)
  const salesPeople = profiles.filter((p) => (p.role === "admin" || p.role === "sales"));

  // Spotlight
  const spotlight = useMemo(() => computeSpotlight(spotlightWeekData, salesPeople), [spotlightWeekData, salesPeople]);

  // Tasks grouping
  const groupedTasks = useMemo(() => {
    const g: Record<TaskTier, TaskItem[]> = { critical: [], urgent: [], advisory: [] };
    tasks.forEach((t) => g[t.tier].push(t));
    (Object.keys(g) as TaskTier[]).forEach((k) =>
      g[k].sort((a, b) => b.staleDays - a.staleDays),
    );
    return g;
  }, [tasks]);

  const totalTasks = tasks.length;

  // Coverage
  const remainingTarget = Math.max(myQuarterTarget - myQuarterRev, 0);
  const coverageRatio = remainingTarget > 0 ? pipelineValue / remainingTarget : pipelineValue > 0 ? 99 : 0;
  const coverageState: "healthy" | "weak" | "risky" =
    myQuarterTarget === 0 ? "weak" : coverageRatio >= 2.5 ? "healthy" : coverageRatio >= 1.5 ? "weak" : "risky";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {greeting()}, {firstName(dashboardProfile?.name, currentUserEmail)} 👋
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">{dateLabel}</p>
          {isAdmin && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t.yfirlit.viewDashboardAs}:</span>
              <Select value={viewAsId === "" ? "__all__" : viewAsId} onValueChange={(v) => setViewAsId(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-7 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t.yfirlit.viewDashboardAll}</SelectItem>
                  {profiles
                    .filter((p) => p.role === "admin" || p.role === "sales")
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name || p.email}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button variant="outline" onClick={() => setExportOpen(true)}>
          <Download className="mr-2 h-4 w-4" />
          {t.yfirlit.exportButton}
        </Button>
      </div>

      {/* Flagged Deals — always visible */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.yfirlit.myTasksTitle}
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t.yfirlit.tasksFilterFor}</span>
            <Select value={tasksOwnerId} onValueChange={setTasksOwnerId}>
              <SelectTrigger className="h-7 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {totalTasks === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <Coffee className="h-12 w-12 opacity-40" />
            <p className="text-sm">{t.yfirlit.tasksAllClear}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedTasks.critical.length > 0 && (
              <TaskTier
                title={t.yfirlit.tasksTierCritical}
                count={groupedTasks.critical.length}
                color="bg-red-500"
                tasks={groupedTasks.critical}
              />
            )}
            {groupedTasks.urgent.length > 0 && (
              <TaskTier
                title={t.yfirlit.tasksTierUrgent}
                count={groupedTasks.urgent.length}
                color="bg-amber-500"
                tasks={groupedTasks.urgent}
              />
            )}
            {groupedTasks.advisory.length > 0 && (
              <div>
                {!showAdvisory ? (
                  <button
                    type="button"
                    onClick={() => setShowAdvisory(true)}
                    className="text-sm text-ide-navy hover:underline"
                  >
                    {t.yfirlit.tasksAdvisoryShow.replace("{n}", String(groupedTasks.advisory.length))}
                  </button>
                ) : (
                  <TaskTier
                    title={t.yfirlit.tasksTierAdvisory}
                    count={groupedTasks.advisory.length}
                    color="bg-muted-foreground/60"
                    tasks={groupedTasks.advisory}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Pace section — sales/admin only */}
      {showFinancials && (
        <section className="space-y-3">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Personal pace */}
            {(() => {
              const isYear = paceMode === "year";
              const personalRev = isAllTeam
                ? (isYear ? yearDeals.reduce((s, d) => s + d.net, 0) : teamQuarterRev)
                : (isYear ? myYearRev : myQuarterRev);
              const personalTarget = isYear ? myYearTarget : myQuarterTarget;
              const expectedPct = isYear ? expectedPctY : expectedPctQ;
              const state = isYear ? myYearState : myPaceState;
              const fillPct = personalTarget > 0 ? (personalRev / personalTarget) * 100 : 0;
              const daysLeft = isYear
                ? Math.max(totalDaysY - elapsedY, 0)
                : remainingQ;
              return (
                <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {isAllTeam ? t.yfirlit.adminTeamAggregate : t.yfirlit.paceTitle}
                    </p>
                    <PaceModeToggle value={paceMode} onChange={setPaceMode} />
                  </div>
                  {personalTarget === 0 && !isAllTeam ? (
                    <p className="mt-4 text-sm text-muted-foreground">{t.yfirlit.paceNoTarget}</p>
                  ) : (
                    <>
                      <p className="mt-2 text-2xl font-semibold text-foreground tabular-nums">
                        {formatIsk(personalRev)}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          / {formatIsk(personalTarget)}
                        </span>
                      </p>
                      <div className="mt-3">
                        <BulletBar
                          achieved={personalRev}
                          target={personalTarget}
                          expectedPct={expectedPct}
                          state={state}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {t.yfirlit.paceOfTarget.replace("{pct}", String(Math.round(fillPct)))}
                        </span>
                        <span className="text-muted-foreground">
                          {t.yfirlit.paceDaysLeft.replace("{n}", String(daysLeft))}
                        </span>
                      </div>
                      <span className={`mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${paceChipClass(state)}`}>
                        {paceStateLabel(state)}
                      </span>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Team pace */}
            {(() => {
              const isYear = paceMode === "year";
              const expectedPct = isYear ? expectedPctY : expectedPctQ;
              const teamRows = salesPeople
                .map((p) => {
                  const rev = isYear
                    ? yearDeals.filter((d) => d.owner_id === p.id).reduce((s, d) => s + d.net, 0)
                    : quarterDeals.filter((d) => d.owner_id === p.id).reduce((s, d) => s + d.net, 0);
                  const tgt = targetForUser(p.id, isYear ? "year" : "quarter");
                  return {
                    profile: p,
                    rev,
                    target: tgt,
                    state: computePaceState(rev, tgt, expectedPct),
                  };
                })
                .filter((x) => x.target > 0 || x.profile.id === currentUserId)
                .sort((a, b) =>
                  (firstName(a.profile.name, a.profile.email) || "").localeCompare(
                    firstName(b.profile.name, b.profile.email) || "",
                  ),
                );
              return (
                <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t.yfirlit.teamPaceTitle}
                    </p>
                    <PaceModeToggle value={paceMode} onChange={setPaceMode} />
                  </div>
                  {teamRows.length <= 1 && teamRows.every((x) => x.target === 0) ? (
                    <p className="text-sm text-muted-foreground">{t.yfirlit.teamPaceEmpty}</p>
                  ) : (
                    <ul className="space-y-2">
                      {teamRows.map((row) => {
                        const isMe = row.profile.id === currentUserId;
                        const fill = row.target > 0 ? (row.rev / row.target) * 100 : 0;
                        return (
                          <li
                            key={row.profile.id}
                            className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
                              isMe ? "border-l-2 border-ide-navy bg-muted/40" : ""
                            }`}
                          >
                            <UserAvatar
                              name={row.profile.name}
                              email={row.profile.email}
                              avatarUrl={row.profile.avatar_url ?? null}
                              size={24}
                            />
                            <span className="w-20 truncate text-xs text-foreground">
                              {firstName(row.profile.name, row.profile.email)}
                            </span>
                            <div className="flex-1">
                              {row.target > 0 ? (
                                <BulletBar
                                  achieved={row.rev}
                                  target={row.target}
                                  expectedPct={expectedPct}
                                  state={row.state}
                                  height="sm"
                                />
                              ) : (
                                <div className="h-1.5 w-full rounded-full bg-muted" />
                              )}
                            </div>
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${paceChipClass(row.state)}`}>
                              {row.target > 0 ? `${Math.round(fill)}%` : "—"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })()}

            {/* Spotlight */}
            <div className="rounded-lg border border-ide-navy/40 bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.yfirlit.spotlightTitle}
              </p>
              {spotlight.length === 0 ? (
                <p className="text-sm text-foreground leading-snug">{t.yfirlit.spotlightFallback}</p>
              ) : (
                <ul className="space-y-3">
                  {spotlight.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      {item.profile && (
                        <UserAvatar
                          name={item.profile.name}
                          email={item.profile.email}
                          avatarUrl={item.profile.avatar_url ?? null}
                          size={32}
                        />
                      )}
                      <p className="text-sm text-foreground leading-snug">{item.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Pulse */}
      {showFinancials && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.yfirlit.pulseTitleNew}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PulseTile
              label={t.yfirlit.pulseRevenue}
              value={formatIsk(pulse.revenue)}
              delta={deltaArrow(pulse.revenue, prevYearPulse.revenue)}
              hasYoY={prevYearPulse.revenue > 0 || prevYearPulse.count > 0}
              spark={pulseSparks.revenue}
              deltaSuffix="%"
            />
            <PulseTile
              label={t.yfirlit.pulseDeals}
              value={String(pulse.count)}
              delta={(() => {
                const diff = pulse.count - prevYearPulse.count;
                return { sign: diff > 0 ? "up" : diff < 0 ? "down" : "flat", pct: Math.abs(diff) };
              })()}
              hasYoY={prevYearPulse.count > 0}
              spark={pulseSparks.count}
              deltaSuffix=""
              deltaIsAbsolute
            />
            <PulseTile
              label={t.yfirlit.pulseAvgDeal}
              value={formatIsk(pulse.avgDeal)}
              delta={deltaArrow(pulse.avgDeal, prevYearPulse.avgDeal)}
              hasYoY={prevYearPulse.avgDeal > 0}
              spark={pulseSparks.avgDeal}
              deltaSuffix="%"
            />
            <PulseTile
              label={t.yfirlit.pulseMargin}
              value={`${pulse.marginPct.toFixed(1)}%`}
              delta={(() => {
                const diff = pulse.marginPct - prevYearPulse.marginPct;
                return { sign: diff > 0.05 ? "up" : diff < -0.05 ? "down" : "flat", pct: Math.abs(diff) };
              })()}
              hasYoY={prevYearPulse.marginPct > 0}
              spark={pulseSparks.marginPct}
              deltaSuffix="pp"
              deltaIsAbsolute
              deltaDecimals={1}
            />
          </div>
        </section>
      )}

      {/* Trend chart */}
      {showFinancials && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.yfirlit.marginTrendTitle}
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <ComposedChart data={marginTrend} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                {/* Quarter shading */}
                {(() => {
                  const bands: React.ReactElement[] = [];
                  let bandStart: string | null = null;
                  let curQ = -1;
                  marginTrend.forEach((p, i) => {
                    const m = Number(p.month.slice(5, 7)) - 1;
                    const q = Math.floor(m / 3);
                    if (q !== curQ) {
                      if (bandStart && curQ % 2 === 0) {
                        bands.push(
                          <ReferenceArea
                            key={`band-${i}`}
                            x1={bandStart}
                            x2={marginTrend[i - 1].label}
                            fill="hsl(var(--muted))"
                            fillOpacity={0.3}
                          />,
                        );
                      }
                      curQ = q;
                      bandStart = p.label;
                    }
                  });
                  if (bandStart && curQ % 2 === 0 && marginTrend.length > 0) {
                    bands.push(
                      <ReferenceArea
                        key="band-end"
                        x1={bandStart}
                        x2={marginTrend[marginTrend.length - 1].label}
                        fill="hsl(var(--muted))"
                        fillOpacity={0.3}
                      />,
                    );
                  }
                  return bands;
                })()}
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}m` : `${(v / 1000).toFixed(0)}k`
                  }
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                />
                <RTooltip
                  formatter={(v: number, name: string) => {
                    if (name === "marginPct") return [`${v.toFixed(1)}%`, t.yfirlit.pulseMargin];
                    if (name === "revenue") return [formatIsk(v), t.yfirlit.pulseRevenue];
                    return [String(v), name];
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="revenue"
                  radius={[4, 4, 0, 0]}
                  // Click navigates to deals filtered by month (deals page may ignore params)
                  onClick={(d: any) => {
                    if (!d?.payload?.month) return;
                    const [yy, mm] = d.payload.month.split("-").map(Number);
                    const from = `${yy}-${String(mm).padStart(2, "0")}-01`;
                    const to = new Date(yy, mm, 0).toISOString().split("T")[0];
                    // Navigate via window — keeps types simple if /deals doesn't accept params
                    window.location.href = `/deals?delivered_from=${from}&delivered_to=${to}`;
                  }}
                >
                  {marginTrend.map((row) => (
                    <Cell key={row.month} fill="#1a2540" cursor="pointer" />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="marginPct"
                  strokeWidth={2}
                  stroke="#16a34a"
                  dot={{ r: 4, fill: "#16a34a" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Early-warning panel */}
      {showFinancials && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.yfirlit.warningsTitle}
          </h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* Margin drops */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <p className="text-sm font-medium text-foreground">{t.yfirlit.warningsMarginDrop}</p>
              </div>
              {marginDrops.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.yfirlit.warningsMarginAllClear}</p>
              ) : (
                <ul className="space-y-2">
                  {marginDrops.map((d) => (
                    <li key={d.id} className="text-sm">
                      <Link to="/companies/$id" params={{ id: d.id }} className="font-medium text-foreground hover:underline">
                        {d.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {t.yfirlit.warningsMarginDropDetail
                          .replace("{prev}", d.prev.toFixed(0))
                          .replace("{curr}", d.curr.toFixed(0))}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Dormant */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-medium text-foreground">{t.yfirlit.warningsDormant}</p>
              </div>
              {dormant.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.yfirlit.warningsDormantAllClear}</p>
              ) : (
                <ul className="space-y-2">
                  {dormant.map((d) => (
                    <li key={d.id} className="text-sm">
                      <Link to="/companies/$id" params={{ id: d.id }} className="font-medium text-foreground hover:underline">
                        {d.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {t.yfirlit.warningsDormantDetail
                          .replace("{days}", String(d.days))
                          .replace("{avg}", String(d.avg))}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Coverage */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-ide-navy" />
                <p className="text-sm font-medium text-foreground">{t.yfirlit.warningsCoverage}</p>
              </div>
              {myQuarterTarget === 0 ? (
                <p className="text-sm text-muted-foreground">{t.yfirlit.warningsCoverageNoTarget}</p>
              ) : (
                <>
                  <p className="text-2xl font-semibold tabular-nums">{coverageRatio.toFixed(1)}×</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      coverageState === "healthy"
                        ? "bg-emerald-100 text-emerald-700"
                        : coverageState === "weak"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {coverageState === "healthy"
                      ? t.yfirlit.warningsCoverageHealthy
                      : coverageState === "weak"
                        ? t.yfirlit.warningsCoverageWeak
                        : t.yfirlit.warningsCoverageRisky}
                  </span>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t.yfirlit.warningsCoverageDetail
                      .replace("{pipeline}", formatIsk(pipelineValue))
                      .replace("{remaining}", formatIsk(remainingTarget))}
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Top customers + Recent activity */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {showFinancials && (
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.yfirlit.topCustomersTitle}
            </h2>
            {topCustomers.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{t.yfirlit.noCustomersYet}</p>
            ) : (
              <ul className="divide-y divide-border">
                {topCustomers.map((c, idx) => (
                  <li key={c.id} className="flex items-center justify-between py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-5 text-sm tabular-nums text-muted-foreground">{idx + 1}</span>
                      <Link
                        to="/companies/$id"
                        params={{ id: c.id }}
                        className="truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {c.name}
                      </Link>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums text-foreground">{formatIsk(c.total)}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.yfirlit.dealsCount.replace("{n}", String(c.count))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.yfirlit.recentActivityTitle}
          </h2>
          {activities.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{t.yfirlit.noRecentActivity}</p>
          ) : (
            <ul className="space-y-3">
              {activities.map((a) => (
                <ActivityFeedRow key={a.id} a={a} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Admin extras */}
      {isAdmin && isAllTeam && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.yfirlit.adminTitle}
          </h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-medium text-foreground">{t.yfirlit.adminTeamAggregate}</p>
              <p className="text-2xl font-semibold tabular-nums">{formatIsk(teamQuarterRev)}</p>
              <p className="text-xs text-muted-foreground">/ {formatIsk(myQuarterTarget)}</p>
              <div className="mt-3">
                <BulletBar
                  achieved={teamQuarterRev}
                  target={myQuarterTarget}
                  expectedPct={expectedPctQ}
                  state={computePaceState(teamQuarterRev, myQuarterTarget, expectedPctQ)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-medium text-foreground">{t.yfirlit.adminLongestStuck}</p>
              {longestStuck.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="divide-y divide-border">
                  {longestStuck.map((d) => (
                    <li key={d.id} className="py-2 text-sm">
                      <Link to="/deals/$id" params={{ id: d.id }} className="hover:underline">
                        <span className="font-mono text-xs">{d.so_number}</span>
                        {" · "}
                        <span className="text-foreground">{d.company}</span>
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {t.yfirlit.adminStageDays.replace("{n}", String(d.days)).replace("{stage}", d.stage)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-medium text-foreground">{t.yfirlit.adminMarginOutliers}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-emerald-700">{t.yfirlit.adminMarginHigh}</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {marginHigh.map((d) => (
                      <li key={d.id}>
                        <Link to="/deals/$id" params={{ id: d.id }} className="hover:underline">
                          {d.company} <span className="text-muted-foreground">{d.pct.toFixed(0)}%</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-red-700">{t.yfirlit.adminMarginLow}</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {marginLow.map((d) => (
                      <li key={d.id}>
                        <Link to="/deals/$id" params={{ id: d.id }} className="hover:underline">
                          {d.company}{" "}
                          <span className={d.pct < 20 ? "text-red-600" : "text-muted-foreground"}>
                            {d.pct.toFixed(0)}%
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-medium text-foreground">{t.yfirlit.adminConcentration}</p>
              {concentration ? (
                <>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-ide-navy"
                      style={{ width: `${Math.min(concentration.top5Pct, 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm">
                    {t.yfirlit.adminConcentrationLine.replace("{pct}", concentration.top5Pct.toFixed(0))}
                  </p>
                  {concentration.top5Pct > 50 && (
                    <p className="mt-1 text-xs text-amber-600">{t.yfirlit.adminConcentrationWarning}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          </div>
        </section>
      )}

      <ExportReportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}

// ---------- Spotlight ----------
function computeSpotlight(
  weekData: Array<{ owner_id: string; net: number; delivered_at: string; amount: number; margin: number; company?: { id: string; name: string } | null }>,
  salesPeople: Profile[],
): Array<{ text: string; profile: Profile | null }> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeekAgo = new Date(now.getTime() - 14 * 86400000);
  const results: Array<{ text: string; profile: Profile | null }> = [];

  // movement
  {
    const byUser: Record<string, { last: number; prev: number }> = {};
    weekData.forEach((d) => {
      const dt = new Date(d.delivered_at);
      if (!byUser[d.owner_id]) byUser[d.owner_id] = { last: 0, prev: 0 };
      if (dt >= weekAgo) byUser[d.owner_id].last += d.net;
      else if (dt >= twoWeekAgo) byUser[d.owner_id].prev += d.net;
    });
    let best: { id: string; pct: number } | null = null;
    Object.entries(byUser).forEach(([id, v]) => {
      if (v.prev <= 0 || v.last <= 0) return;
      const pct = ((v.last - v.prev) / v.prev) * 100;
      if (pct > 0 && (!best || pct > best.pct)) best = { id, pct };
    });
    if (best) {
      const p = salesPeople.find((x) => x.id === (best as { id: string; pct: number }).id);
      if (p) results.push({
        text: t.yfirlit.spotlightMovement
          .replace("{name}", firstName(p.name, p.email))
          .replace("{pct}", (best as { id: string; pct: number }).pct.toFixed(0)),
        profile: p,
      });
    }
  }

  // biggest
  {
    const lastWeek = weekData.filter((d) => new Date(d.delivered_at) >= weekAgo);
    const top = [...lastWeek].sort((a, b) => b.amount - a.amount)[0];
    if (top) {
      const p = salesPeople.find((x) => x.id === top.owner_id);
      if (p) results.push({
        text: t.yfirlit.spotlightBiggest
          .replace("{name}", firstName(p.name, p.email))
          .replace("{company}", top.company?.name ?? "—")
          .replace("{amount}", formatIsk(top.amount)),
        profile: p,
      });
    }
  }

  // margin
  {
    const thirtyAgo = new Date(now.getTime() - 30 * 86400000);
    const recent = weekData.filter((d) => new Date(d.delivered_at) >= thirtyAgo);
    const byUser: Record<string, { net: number; margin: number; n: number }> = {};
    recent.forEach((d) => {
      if (!byUser[d.owner_id]) byUser[d.owner_id] = { net: 0, margin: 0, n: 0 };
      byUser[d.owner_id].net += d.net;
      byUser[d.owner_id].margin += d.margin;
      byUser[d.owner_id].n += 1;
    });
    let best: { id: string; pct: number } | null = null;
    Object.entries(byUser).forEach(([id, v]) => {
      if (v.n < 3 || v.net <= 0) return;
      const pct = (v.margin / v.net) * 100;
      if (!best || pct > best.pct) best = { id, pct };
    });
    if (best) {
      const p = salesPeople.find((x) => x.id === (best as { id: string; pct: number }).id);
      if (p) results.push({
        text: t.yfirlit.spotlightMargin
          .replace("{name}", firstName(p.name, p.email))
          .replace("{pct}", (best as { id: string; pct: number }).pct.toFixed(0)),
        profile: p,
      });
    }
  }

  // streak
  {
    const byUser: Record<string, Set<string>> = {};
    weekData.forEach((d) => {
      if (!byUser[d.owner_id]) byUser[d.owner_id] = new Set();
      byUser[d.owner_id].add(String(d.delivered_at).slice(0, 10));
    });
    let best: { id: string; days: number } | null = null;
    Object.entries(byUser).forEach(([id, set]) => {
      let streak = 0;
      for (let i = 0; i < 14; i++) {
        const d = new Date(now.getTime() - i * 86400000).toISOString().split("T")[0];
        if (set.has(d)) streak += 1;
        else break;
      }
      if (streak > 1 && (!best || streak > best.days)) best = { id, days: streak };
    });
    if (best) {
      const p = salesPeople.find((x) => x.id === (best as { id: string; days: number }).id);
      if (p) results.push({
        text: t.yfirlit.spotlightStreak
          .replace("{name}", firstName(p.name, p.email))
          .replace("{days}", String((best as { id: string; days: number }).days)),
        profile: p,
      });
    }
  }

  return results;
}

// ---------- Pace mode toggle ----------
function PaceModeToggle({
  value,
  onChange,
}: {
  value: "quarter" | "year";
  onChange: (v: "quarter" | "year") => void;
}) {
  const base = "px-2 py-0.5 text-[10px] font-medium rounded-full transition-colors";
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted p-0.5">
      <button
        type="button"
        onClick={() => onChange("quarter")}
        className={`${base} ${value === "quarter" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
      >
        {t.yfirlit.paceToggleQuarter}
      </button>
      <button
        type="button"
        onClick={() => onChange("year")}
        className={`${base} ${value === "year" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
      >
        {t.yfirlit.paceToggleYear}
      </button>
    </div>
  );
}

// ---------- Subcomponents ----------
function TaskTier({
  title,
  count,
  color,
  tasks,
}: {
  title: string;
  count: number;
  color: string;
  tasks: TaskItem[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title} · {count}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {tasks.map((task, i) => (
          <TaskRow key={`${task.deal.id}-${task.type}-${i}`} task={task} />
        ))}
      </ul>
    </div>
  );
}

function TaskRow({ task }: { task: TaskItem }) {
  const navigate = useNavigate();
  const meta = TASK_META[task.type];
  const handleClick = () => {
    if (task.type === "po_invoice_approval" && task.poId) {
      navigate({ to: "/deals/$id", params: { id: task.deal.id }, hash: `po-${task.poId}` });
    } else {
      navigate({ to: "/deals/$id", params: { id: task.deal.id } });
    }
  };
  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${meta.bg}`}>
          <meta.icon className={`h-4 w-4 ${meta.fg}`} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-foreground">
              {task.type === "po_invoice_approval" && task.poNumber ? task.poNumber : task.deal.so_number}
            </span>
            {task.deal.company && (
              <span className="truncate text-sm text-muted-foreground">· {task.deal.company.name}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{meta.label}</div>
        </div>
        <span className={`text-xs ${staleColor(task.staleDays)}`}>{task.staleLabel}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </li>
  );
}

const TASK_META: Record<TaskType, { label: string; icon: typeof AlertTriangle; bg: string; fg: string }> = {
  overdue: { label: t.yfirlit.taskOverdue, icon: AlertTriangle, bg: "bg-muted", fg: "text-muted-foreground" },
  defect_pending: { label: t.yfirlit.taskDefectPending, icon: AlertTriangle, bg: "bg-red-100", fg: "text-red-600" },
  unpaid_old: { label: t.yfirlit.taskUnpaidOld, icon: CircleDollarSign, bg: "bg-red-100", fg: "text-red-600" },
  delivery_mismatch: { label: t.yfirlit.taskDeliveryMismatch, icon: AlertTriangle, bg: "bg-red-100", fg: "text-red-600" },
  po_invoice_approval: { label: t.yfirlit.taskPoInvoiceApproval, icon: ClipboardList, bg: "bg-amber-100", fg: "text-amber-700" },
  delivered_uninvoiced: { label: t.yfirlit.taskUninvoiced, icon: CircleDollarSign, bg: "bg-amber-100", fg: "text-amber-700" },
};

function PulseTile({
  label,
  value,
  delta,
  hasYoY,
  spark,
  deltaSuffix,
  deltaIsAbsolute,
  deltaDecimals,
}: {
  label: string;
  value: string;
  delta: { sign: "up" | "down" | "flat"; pct: number };
  hasYoY: boolean;
  spark: number[];
  deltaSuffix?: string;
  deltaIsAbsolute?: boolean;
  deltaDecimals?: number;
}) {
  const arrow = delta.sign === "up" ? "↑" : delta.sign === "down" ? "↓" : "→";
  const color =
    delta.sign === "up"
      ? "text-emerald-600"
      : delta.sign === "down"
        ? "text-red-600"
        : "text-muted-foreground";
  const num = deltaIsAbsolute
    ? deltaDecimals !== undefined
      ? delta.pct.toFixed(deltaDecimals)
      : String(Math.round(delta.pct))
    : delta.pct.toFixed(0);
  const sparkData = spark.map((v, i) => ({ i, v }));
  const sparkColor = delta.sign === "down" ? "#dc2626" : "#16a34a";
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className={`mt-1 text-xs ${color}`}>
        {t.yfirlit.pulseVsLastYear}: {hasYoY ? `${arrow} ${num}${deltaSuffix ?? ""}` : t.yfirlit.pulseNoYoY}
      </p>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 opacity-25">
        <ResponsiveContainer>
          <LineChart data={sparkData}>
            <Line type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ActivityFeedRow({ a }: { a: ActivityRow }) {
  const name = a.profile?.name || "—";
  const rawBody = a.body ?? "";
  let displayBody: string = rawBody;
  if (a.type === "stage_change") {
    const stageLabel = (t.dealStage as Record<string, string>)[rawBody] ?? rawBody;
    displayBody = `${t.log.stageChanged} ${stageLabel}`;
  }
  const typeLabel = (t.activityType as Record<string, string>)[a.type];
  return (
    <li className="flex gap-3">
      <UserAvatar
        name={a.profile?.name}
        email={a.profile?.email}
        avatarUrl={a.profile?.avatar_url ?? null}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-medium text-foreground">{name}</span>
          {typeLabel && a.type !== "note" && (
            <span className="text-xs text-muted-foreground">· {typeLabel}</span>
          )}
          <span className="text-xs text-muted-foreground">{relativeTime(a.created_at)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {a.deal ? (
            <>
              <Link
                to="/deals/$id"
                params={{ id: a.deal.id }}
                className="font-medium text-foreground hover:underline"
              >
                {a.deal.company ? `${a.deal.company.name} · ` : ""}
                {a.deal.name}
              </Link>{" "}
            </>
          ) : null}
          {displayBody}
        </p>
      </div>
    </li>
  );
}

void Cell;
void paceColor;
void Check;
