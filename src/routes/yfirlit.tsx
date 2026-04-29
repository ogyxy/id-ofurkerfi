import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
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
import { t, formatIsk } from "@/lib/sala_translations_is";
import { ExportReportDialog } from "@/components/yfirlit/ExportReportDialog";

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
}

interface TaskItem {
  type: "overdue" | "uninvoiced" | "defect_pending" | "unpaid_old";
  deal: {
    id: string;
    so_number: string;
    name: string;
    company?: { id: string; name: string } | null;
  };
}

interface PulseStats {
  revenue: number;
  count: number;
  avgDeal: number;
  marginPct: number;
}

interface PipelineRow {
  stage: string;
  count: number;
  total: number;
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
  profile?: { id: string; name: string | null } | null;
  deal?: { id: string; so_number: string; name: string } | null;
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

function initials(name: string | null | undefined, email: string): string {
  const src = name?.trim() || email;
  return src
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function deltaArrow(curr: number, prev: number): { sign: "up" | "down" | "flat"; pct: number } {
  if (prev === 0 && curr === 0) return { sign: "flat", pct: 0 };
  if (prev === 0) return { sign: "up", pct: 100 };
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 0.5) return { sign: "flat", pct: 0 };
  return { sign: pct > 0 ? "up" : "down", pct: Math.abs(pct) };
}

const STAGE_COLORS: Record<string, string> = {
  inquiry: "#9ca3af",
  quote_in_progress: "#3b82f6",
  quote_sent: "#6366f1",
  order_confirmed: "#f59e0b",
};

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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [viewedUserId, setViewedUserId] = useState<string>(currentUserId);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);

  const [pulse, setPulse] = useState<PulseStats>({ revenue: 0, count: 0, avgDeal: 0, marginPct: 0 });
  const [prevPulse, setPrevPulse] = useState<PulseStats>({ revenue: 0, count: 0, avgDeal: 0, marginPct: 0 });

  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [marginTrend, setMarginTrend] = useState<Array<{ month: string; label: string; marginPct: number }>>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [exportOpen, setExportOpen] = useState(false);

  const viewedProfile = profiles.find((p) => p.id === viewedUserId);
  const viewedFirstName = viewedProfile
    ? firstName(viewedProfile.name, viewedProfile.email)
    : firstName(null, currentUserEmail);
  const isViewingOther = viewedUserId !== currentUserId;

  // Load profiles + initial me name
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("active", true)
        .order("name", { ascending: true });
      if (data) setProfiles(data as Profile[]);
    })();
  }, []);

  // Load my tasks for viewedUserId
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("deals")
        .select(
          `id, so_number, name, stage, amount_isk,
           promised_delivery_date, delivered_at,
           invoice_status, payment_status,
           defect_resolution, invoice_date,
           company:companies(id, name, payment_terms_days)`
        )
        .eq("owner_id", viewedUserId)
        .eq("archived", false);

      const out: TaskItem[] = [];
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
          d.promised_delivery_date < today
        ) {
          out.push({ type: "overdue", deal: dealRef });
        }
        if (d.stage === "delivered" && d.invoice_status === "not_invoiced") {
          out.push({ type: "uninvoiced", deal: dealRef });
        }
        if (d.stage === "defect_reorder" && d.defect_resolution === "pending") {
          out.push({ type: "defect_pending", deal: dealRef });
        }
        const invDate = d.invoice_date;
        if (
          d.invoice_status &&
          d.invoice_status !== "not_invoiced" &&
          d.payment_status === "unpaid" &&
          invDate
        ) {
          const days = Math.floor(
            (Date.now() - new Date(invDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (days > (d.company?.payment_terms_days || 14)) {
            out.push({ type: "unpaid_old", deal: dealRef });
          }
        }
      });
      setTasks(out);
    })();
  }, [viewedUserId]);

  // Load pulse + margin trend (company-wide, only once)
  useEffect(() => {
    (async () => {
      const today = new Date();
      const sixtyAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
      const thirtyAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixMoAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

      const { data: recent } = await supabase
        .from("deals")
        .select("id, amount_isk, total_margin_isk, refund_amount_isk, delivered_at")
        .eq("archived", false)
        .gte("delivered_at", sixtyAgo.toISOString().split("T")[0]);

      const calc = (rows: any[]): PulseStats => {
        const net = rows.reduce(
          (s, d) => s + ((d.amount_isk || 0) - (d.refund_amount_isk || 0)),
          0
        );
        const margin = rows.reduce(
          (s, d) => s + ((d.total_margin_isk || 0) - (d.refund_amount_isk || 0)),
          0
        );
        return {
          revenue: net,
          count: rows.length,
          avgDeal: rows.length ? net / rows.length : 0,
          marginPct: net > 0 ? (margin / net) * 100 : 0,
        };
      };

      const last30 = (recent ?? []).filter(
        (d: any) => d.delivered_at && new Date(d.delivered_at) >= thirtyAgo
      );
      const prev30 = (recent ?? []).filter(
        (d: any) =>
          d.delivered_at &&
          new Date(d.delivered_at) < thirtyAgo &&
          new Date(d.delivered_at) >= sixtyAgo
      );
      setPulse(calc(last30));
      setPrevPulse(calc(prev30));

      // Margin trend: last 6 months
      const { data: trendDeals } = await supabase
        .from("deals")
        .select("amount_isk, total_margin_isk, refund_amount_isk, delivered_at")
        .eq("archived", false)
        .gte("delivered_at", sixMoAgo.toISOString().split("T")[0]);

      const buckets: Record<string, { revenue: number; margin: number }> = {};
      // Seed 6 months
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets[key] = { revenue: 0, margin: 0 };
      }
      (trendDeals ?? []).forEach((d: any) => {
        if (!d.delivered_at) return;
        const key = d.delivered_at.slice(0, 7);
        if (!buckets[key]) return;
        buckets[key].revenue += (d.amount_isk || 0) - (d.refund_amount_isk || 0);
        buckets[key].margin += (d.total_margin_isk || 0) - (d.refund_amount_isk || 0);
      });
      const trend = Object.keys(buckets)
        .sort()
        .map((key) => {
          const m = Number(key.slice(5, 7)) - 1;
          return {
            month: key,
            label: t.yfirlit.monthsShort[m],
            marginPct: buckets[key].revenue > 0
              ? (buckets[key].margin / buckets[key].revenue) * 100
              : 0,
          };
        });
      setMarginTrend(trend);
    })();
  }, []);

  // Load pipeline
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("deals")
        .select("stage, amount_isk")
        .eq("archived", false)
        .in("stage", ["inquiry", "quote_in_progress", "quote_sent", "order_confirmed"]);

      const stages = ["inquiry", "quote_in_progress", "quote_sent", "order_confirmed"];
      const grouped: PipelineRow[] = stages.map((stage) => {
        const rows = (data ?? []).filter((d: any) => d.stage === stage);
        return {
          stage,
          count: rows.length,
          total: rows.reduce((s, d: any) => s + (d.amount_isk || 0), 0),
        };
      });
      setPipeline(grouped);
    })();
  }, []);

  // Load top customers
  useEffect(() => {
    (async () => {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1)
        .toISOString()
        .split("T")[0];
      const { data } = await supabase
        .from("deals")
        .select(
          "amount_isk, refund_amount_isk, delivered_at, company:companies(id, name)"
        )
        .eq("archived", false)
        .gte("delivered_at", startOfYear);

      const by: Record<string, CustomerRow> = {};
      (data ?? []).forEach((d: any) => {
        if (!d.company) return;
        const id = d.company.id;
        if (!by[id]) by[id] = { id, name: d.company.name, total: 0, count: 0 };
        by[id].total += (d.amount_isk || 0) - (d.refund_amount_isk || 0);
        by[id].count += 1;
      });
      setTopCustomers(
        Object.values(by)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)
      );
    })();
  }, []);

  // Load recent activity
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("activities")
        .select(
          `id, type, body, created_at,
           profile:profiles!created_by(id, name),
           deal:deals(id, so_number, name)`
        )
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setActivities(data as unknown as ActivityRow[]);
    })();
  }, []);

  const visibleTasks = showAllTasks ? tasks : tasks.slice(0, 5);
  const pipelineTotal = pipeline.reduce((s, p) => s + p.total, 0);
  const pipelineChartData = useMemo(
    () => [
      pipeline.reduce((acc, p) => {
        acc[p.stage] = p.total;
        return acc;
      }, { name: "" } as Record<string, any>),
    ],
    [pipeline]
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {t.yfirlit.pageTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isViewingOther
              ? `${t.yfirlit.viewingForLabel} ${viewedFirstName}`
              : `${greeting()}, ${viewedFirstName} 👋`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t.yfirlit.viewingFor}:</span>
            <Select value={viewedUserId} onValueChange={setViewedUserId}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => setExportOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            {t.yfirlit.exportButton}
          </Button>
        </div>
      </div>

      {/* My tasks */}
      <section
        className={`rounded-lg border bg-card p-5 shadow-sm ${
          isViewingOther ? "border-ide-navy/40" : "border-border"
        }`}
      >
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isViewingOther
            ? t.yfirlit.myTasksTitleOther.replace("{name}", viewedFirstName)
            : t.yfirlit.myTasksTitle}
        </h2>
        {tasks.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-emerald-600" />
            {t.yfirlit.myTasksEmpty}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {visibleTasks.map((task, i) => (
                <TaskRow key={`${task.deal.id}-${task.type}-${i}`} task={task} />
              ))}
            </ul>
            {tasks.length > 5 && !showAllTasks && (
              <button
                type="button"
                onClick={() => setShowAllTasks(true)}
                className="mt-3 text-sm text-ide-navy hover:underline"
              >
                + {t.yfirlit.showMore.replace("{count}", String(tasks.length - 5))}
              </button>
            )}
          </>
        )}
      </section>

      {/* Pulse */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t.yfirlit.pulseTitle}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PulseTile
            label={t.yfirlit.pulseRevenue}
            value={formatIsk(pulse.revenue)}
            delta={deltaArrow(pulse.revenue, prevPulse.revenue)}
            deltaSuffix="%"
          />
          <PulseTile
            label={t.yfirlit.pulseDeals}
            value={String(pulse.count)}
            delta={(() => {
              const diff = pulse.count - prevPulse.count;
              return {
                sign: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
                pct: Math.abs(diff),
              };
            })()}
            deltaSuffix=""
            deltaPrefix=""
            deltaIsAbsolute
          />
          <PulseTile
            label={t.yfirlit.pulseAvgDeal}
            value={formatIsk(pulse.avgDeal)}
            delta={deltaArrow(pulse.avgDeal, prevPulse.avgDeal)}
            deltaSuffix="%"
          />
          <PulseTile
            label={t.yfirlit.pulseMargin}
            value={`${pulse.marginPct.toFixed(1)}%`}
            delta={(() => {
              const diff = pulse.marginPct - prevPulse.marginPct;
              return {
                sign: diff > 0.05 ? "up" : diff < -0.05 ? "down" : "flat",
                pct: Math.abs(diff),
              };
            })()}
            deltaSuffix="pp"
            deltaIsAbsolute
            deltaDecimals={1}
          />
        </div>
      </section>

      {/* Pipeline */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t.yfirlit.pipelineTitle}
        </h2>
        {pipelineTotal === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t.yfirlit.noOpenDeals}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {t.yfirlit.pipelineTotal}
            </p>
            <p className="mb-3 text-2xl font-semibold text-foreground">
              {formatIsk(pipelineTotal)}
            </p>
            <div className="h-12 w-full">
              <ResponsiveContainer>
                <BarChart layout="vertical" data={pipelineChartData} stackOffset="none">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" hide />
                  <RTooltip
                    formatter={(value: number, key: string) =>
                      [formatIsk(value), (t.dealStage as Record<string, string>)[key] ?? key]
                    }
                  />
                  {pipeline.map((p) => (
                    <Bar
                      key={p.stage}
                      dataKey={p.stage}
                      stackId="a"
                      fill={STAGE_COLORS[p.stage]}
                      radius={0}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
              {pipeline.map((p) => (
                <div key={p.stage} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: STAGE_COLORS[p.stage] }}
                  />
                  <span className="text-foreground">
                    {(t.dealStage as Record<string, string>)[p.stage]}
                  </span>
                  <span className="text-muted-foreground">
                    {p.count} · {formatIsk(p.total)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Margin trend */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t.yfirlit.marginTrendTitle}
        </h2>
        <div className="h-52 w-full">
          <ResponsiveContainer>
            <LineChart data={marginTrend} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              />
              <RTooltip
                formatter={(v: number) => [`${v.toFixed(1)}%`, t.yfirlit.pulseMargin]}
              />
              <Line
                type="monotone"
                dataKey="marginPct"
                stroke="#1a2540"
                strokeWidth={2}
                dot={{ r: 3, fill: "#1a2540" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Two columns: Top customers + Recent activity */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Top customers */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.yfirlit.topCustomersTitle}
          </h2>
          {topCustomers.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              {t.yfirlit.noCustomersYet}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {topCustomers.map((c, idx) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-5 text-sm text-muted-foreground tabular-nums">
                      {idx + 1}
                    </span>
                    <Link
                      to="/companies/$id"
                      params={{ id: c.id }}
                      className="truncate text-sm font-medium text-foreground hover:underline"
                    >
                      {c.name}
                    </Link>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground tabular-nums">
                      {formatIsk(c.total)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.yfirlit.dealsCount.replace("{n}", String(c.count))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.yfirlit.recentActivityTitle}
          </h2>
          {activities.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              {t.yfirlit.noRecentActivity}
            </p>
          ) : (
            <ul className="space-y-3">
              {activities.map((a) => (
                <ActivityFeedRow key={a.id} a={a} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <ExportReportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}

// ---------- Subcomponents ----------
function TaskRow({ task }: { task: TaskItem }) {
  const navigate = useNavigate();
  const meta = TASK_META[task.type];
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate({ to: "/deals/$id", params: { id: task.deal.id } })}
        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${meta.bg}`}>
          <meta.icon className={`h-4 w-4 ${meta.fg}`} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-foreground">{task.deal.so_number}</span>
            {task.deal.company && (
              <span className="truncate text-sm text-muted-foreground">
                · {task.deal.company.name}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{meta.label}</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </li>
  );
}

const TASK_META: Record<
  TaskItem["type"],
  { label: string; icon: typeof AlertTriangle; bg: string; fg: string }
> = {
  overdue: {
    label: t.yfirlit.taskOverdue,
    icon: AlertTriangle,
    bg: "bg-red-100",
    fg: "text-red-600",
  },
  uninvoiced: {
    label: t.yfirlit.taskUninvoiced,
    icon: ClipboardList,
    bg: "bg-amber-100",
    fg: "text-amber-700",
  },
  defect_pending: {
    label: t.yfirlit.taskDefectPending,
    icon: AlertTriangle,
    bg: "bg-orange-100",
    fg: "text-orange-600",
  },
  unpaid_old: {
    label: t.yfirlit.taskUnpaidOld,
    icon: CircleDollarSign,
    bg: "bg-red-100",
    fg: "text-red-600",
  },
};

function PulseTile({
  label,
  value,
  delta,
  deltaSuffix,
  deltaPrefix,
  deltaIsAbsolute,
  deltaDecimals,
}: {
  label: string;
  value: string;
  delta: { sign: "up" | "down" | "flat"; pct: number };
  deltaSuffix?: string;
  deltaPrefix?: string;
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
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground tabular-nums">{value}</p>
      <p className={`mt-1 text-xs ${color}`}>
        {arrow} {deltaPrefix ?? ""}{num}{deltaSuffix ?? ""} {t.yfirlit.pulseVsPrevious}
      </p>
    </div>
  );
}

function ActivityFeedRow({ a }: { a: ActivityRow }) {
  const name = a.profile?.name || "—";
  const init = initials(a.profile?.name, "");
  const body = a.body ?? "";
  return (
    <li className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ide-navy text-xs font-medium text-white">
        {init || "·"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-medium text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground">{relativeTime(a.created_at)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {a.deal ? (
            <>
              <Link
                to="/deals/$id"
                params={{ id: a.deal.id }}
                className="font-mono text-foreground hover:underline"
              >
                {a.deal.so_number}
              </Link>{" "}
            </>
          ) : null}
          {body}
        </p>
      </div>
    </li>
  );
}

// Suppress unused-import lint if Cell ends up unused
void Cell;
