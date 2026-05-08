import { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { t, formatIsk } from "@/lib/sala_translations_is";
import ideLogo from "@/assets/ide-logo.png";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Period = "month" | "ytd" | "lastyear";
type Lang = "is" | "en";

interface ExportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId?: string | null;
  ownerName?: string | null;
}

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STAGE_LABELS_EN: Record<string, string> = {
  inquiry: "Inquiry",
  quote_in_progress: "Quote in progress",
  quote_sent: "Quote sent",
  order_confirmed: "Order confirmed",
  delivered: "Delivered",
  defect_reorder: "Defect / reorder",
  cancelled: "Cancelled",
};

const NAVY: [number, number, number] = [26, 37, 64];
const GREEN: [number, number, number] = [22, 163, 74];
const RED: [number, number, number] = [220, 38, 38];
const AMBER: [number, number, number] = [217, 119, 6];
const MUTED_BG: [number, number, number] = [240, 242, 246];
const TEXT_MUTED: [number, number, number] = [115, 115, 115];

const MARGIN = 20; // mm

function buildMonthOptions(): Array<{ value: string; labelIs: string; labelEn: string }> {
  const opts: Array<{ value: string; labelIs: string; labelEn: string }> = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const value = `${y}-${String(m + 1).padStart(2, "0")}`;
    opts.push({
      value,
      labelIs: `${t.yfirlit.monthsLong[m]} ${y}`,
      labelEn: `${EN_MONTHS[m]} ${y}`,
    });
  }
  return opts;
}

function calcRange(period: Period, monthValue: string) {
  const now = new Date();
  if (period === "ytd") {
    const from = new Date(now.getFullYear(), 0, 1);
    return {
      from: from.toISOString().split("T")[0],
      to: now.toISOString().split("T")[0],
      labelIs: `${now.getFullYear()}`,
      labelEn: `${now.getFullYear()}`,
      slug: `${now.getFullYear()}-ytd`,
    };
  }
  if (period === "lastyear") {
    const y = now.getFullYear() - 1;
    return {
      from: `${y}-01-01`,
      to: `${y}-12-31`,
      labelIs: `${y}`,
      labelEn: `${y}`,
      slug: `${y}`,
    };
  }
  const [ys, ms] = monthValue.split("-").map((s) => Number(s));
  const from = new Date(ys, ms - 1, 1);
  const to = new Date(ys, ms, 0);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
    labelIs: `${capitalize(t.yfirlit.monthsLong[ms - 1])} ${ys}`,
    labelEn: `${EN_MONTHS[ms - 1]} ${ys}`,
    slug: `${ys}-${String(ms).padStart(2, "0")}`,
  };
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[áàä]/g, "a")
    .replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u")
    .replace(/[ý]/g, "y")
    .replace(/[ð]/g, "d")
    .replace(/[þ]/g, "th")
    .replace(/[æ]/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Compute a previous-period date range matching the given period type.
function prevRange(period: Period, monthValue: string) {
  if (period === "month") {
    const [ys, ms] = monthValue.split("-").map(Number);
    const from = new Date(ys - 1, ms - 1, 1);
    const to = new Date(ys - 1, ms, 0);
    return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
  }
  const now = new Date();
  if (period === "ytd") {
    const y = now.getFullYear() - 1;
    const to = new Date(y, now.getMonth(), now.getDate());
    return { from: `${y}-01-01`, to: to.toISOString().split("T")[0] };
  }
  // lastyear -> previous year
  const y = now.getFullYear() - 2;
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export function ExportReportDialog({ open, onOpenChange, ownerId = null, ownerName = null }: ExportReportDialogProps) {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [period, setPeriod] = useState<Period>("month");
  const [month, setMonth] = useState<string>(monthOptions[1]?.value ?? monthOptions[0].value);
  const [lang, setLang] = useState<Lang>("is");
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const range = calcRange(period, month);
      const prev = prevRange(period, month);
      const isIs = lang === "is";
      const L = (is: string, en: string) => (isIs ? is : en);
      const periodLabel = isIs ? range.labelIs : range.labelEn;
      const ownerDisplay = ownerName || L("Allt liðið", "Whole team");

      // ---------- Period delivered deals ----------
      let dealsQ = supabase
        .from("deals")
        .select("id, owner_id, so_number, name, amount_isk, total_margin_isk, refund_amount_isk, stage, delivered_at, company:companies(name)")
        .eq("archived", false)
        .gte("delivered_at", range.from)
        .lte("delivered_at", range.to);
      if (ownerId) dealsQ = dealsQ.eq("owner_id", ownerId);
      const { data: dealsRaw } = await dealsQ;
      const deals = dealsRaw ?? [];

      const net = (d: any) => (d.amount_isk || 0) - (d.refund_amount_isk || 0);
      const netMargin = (d: any) => (d.total_margin_isk || 0) - (d.refund_amount_isk || 0);
      const revenue = deals.reduce((s, d) => s + net(d), 0);
      const margin = deals.reduce((s, d) => s + netMargin(d), 0);
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
      const avg = deals.length ? revenue / deals.length : 0;

      // Previous period for YoY
      let prevQ = supabase
        .from("deals")
        .select("amount_isk, refund_amount_isk, total_margin_isk")
        .eq("archived", false)
        .gte("delivered_at", prev.from)
        .lte("delivered_at", prev.to);
      if (ownerId) prevQ = prevQ.eq("owner_id", ownerId);
      const { data: prevRaw } = await prevQ;
      const prevRevenue = (prevRaw ?? []).reduce((s, d: any) => s + net(d), 0);
      const prevCount = (prevRaw ?? []).length;
      const yoyPct = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

      // ---------- Profiles ----------
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, role, active")
        .eq("active", true)
        .in("role", ["admin", "sales"]);
      const profileMap: Record<string, { name: string; email: string }> = {};
      (profiles ?? []).forEach((p: any) => {
        profileMap[p.id] = { name: p.name ?? "", email: p.email ?? "" };
      });

      // ---------- Top customers ----------
      const byCompany: Record<string, { name: string; total: number; count: number }> = {};
      deals.forEach((d: any) => {
        const name = d.company?.name || "—";
        if (!byCompany[name]) byCompany[name] = { name, total: 0, count: 0 };
        byCompany[name].total += net(d);
        byCompany[name].count += 1;
      });
      const top5 = Object.values(byCompany).sort((a, b) => b.total - a.total).slice(0, 5);
      const topCustomersMax = top5[0]?.total ?? 0;

      // ---------- Sales targets vs actuals ----------
      const yearStart = range.from.slice(0, 4) + "-01-01";
      const { data: targetsRaw } = await supabase
        .from("sales_targets")
        .select("owner_id, period_type, period_start, target_isk")
        .eq("period_type", "year")
        .eq("period_start", yearStart);
      const targetByOwner: Record<string, number> = {};
      (targetsRaw ?? []).forEach((tt: any) => {
        targetByOwner[tt.owner_id] = (targetByOwner[tt.owner_id] || 0) + (tt.target_isk || 0);
      });

      // Per-owner actuals (year)
      let yearActQ = supabase
        .from("deals")
        .select("owner_id, amount_isk, refund_amount_isk")
        .eq("archived", false)
        .gte("delivered_at", yearStart)
        .lte("delivered_at", `${range.from.slice(0, 4)}-12-31`);
      const { data: yearActRaw } = await yearActQ;
      const actualByOwner: Record<string, number> = {};
      (yearActRaw ?? []).forEach((d: any) => {
        if (!d.owner_id) return;
        actualByOwner[d.owner_id] = (actualByOwner[d.owner_id] || 0) + net(d);
      });

      const ownerIdsSet = new Set([
        ...Object.keys(targetByOwner),
        ...Object.keys(actualByOwner),
      ]);
      let paceRows = Array.from(ownerIdsSet)
        .filter((id) => profileMap[id])
        .map((id) => ({
          id,
          name: profileMap[id]?.name || profileMap[id]?.email || "—",
          target: targetByOwner[id] || 0,
          actual: actualByOwner[id] || 0,
        }))
        .filter((r) => r.target > 0 || r.actual > 0)
        .sort((a, b) => b.actual - a.actual);
      if (ownerId) paceRows = paceRows.filter((r) => r.id === ownerId);

      // Expected pace (% of year elapsed)
      const yStart = new Date(`${range.from.slice(0, 4)}-01-01`).getTime();
      const yEnd = new Date(`${range.from.slice(0, 4)}-12-31`).getTime();
      const nowMs = Math.min(Date.now(), yEnd);
      const expectedPct = Math.max(0, Math.min(1, (nowMs - yStart) / (yEnd - yStart)));

      // ---------- Trend (last 6 months) ----------
      const trendStart = new Date();
      trendStart.setDate(1);
      trendStart.setMonth(trendStart.getMonth() - 5);
      const trendStartStr = trendStart.toISOString().split("T")[0];
      let trendQ = supabase
        .from("deals")
        .select("amount_isk, refund_amount_isk, total_margin_isk, delivered_at")
        .eq("archived", false)
        .gte("delivered_at", trendStartStr);
      if (ownerId) trendQ = trendQ.eq("owner_id", ownerId);
      const { data: trendRaw } = await trendQ;
      const trendMonths: Array<{ key: string; label: string; revenue: number; marginPct: number }> = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(trendStart);
        d.setMonth(trendStart.getMonth() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = isIs
          ? t.yfirlit.monthsShort[d.getMonth()]
          : EN_MONTHS[d.getMonth()].slice(0, 3);
        trendMonths.push({ key, label, revenue: 0, marginPct: 0 });
      }
      const trendAgg: Record<string, { rev: number; mar: number }> = {};
      (trendRaw ?? []).forEach((d: any) => {
        if (!d.delivered_at) return;
        const key = d.delivered_at.slice(0, 7);
        if (!trendAgg[key]) trendAgg[key] = { rev: 0, mar: 0 };
        trendAgg[key].rev += net(d);
        trendAgg[key].mar += netMargin(d);
      });
      trendMonths.forEach((m) => {
        const v = trendAgg[m.key];
        if (v) {
          m.revenue = v.rev;
          m.marginPct = v.rev > 0 ? (v.mar / v.rev) * 100 : 0;
        }
      });

      // ---------- Pipeline ----------
      let pipeQ = supabase
        .from("deals")
        .select("stage, amount_isk, owner_id")
        .eq("archived", false)
        .in("stage", ["inquiry", "quote_in_progress", "quote_sent", "order_confirmed"]);
      if (ownerId) pipeQ = pipeQ.eq("owner_id", ownerId);
      const { data: openRaw } = await pipeQ;
      const pipeline: Record<string, { count: number; total: number }> = {};
      (openRaw ?? []).forEach((d: any) => {
        if (!pipeline[d.stage]) pipeline[d.stage] = { count: 0, total: 0 };
        pipeline[d.stage].count += 1;
        pipeline[d.stage].total += d.amount_isk || 0;
      });

      // ============ BUILD PDF ============
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Helper: footer
      const drawFooter = (pageNum: number, totalPages: number) => {
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(`${periodLabel} · ${ownerDisplay}`, MARGIN, pageH - 8);
        doc.text(`${pageNum} / ${totalPages}`, pageW - MARGIN, pageH - 8, { align: "right" });
      };

      const sectionTitle = (title: string, y: number) => {
        doc.setFontSize(16);
        doc.setTextColor(...NAVY);
        doc.setFont("helvetica", "bold");
        doc.text(title, MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
      };

      // ---------- PAGE 1: COVER ----------
      // Logo
      try {
        doc.addImage(ideLogo, "PNG", MARGIN, MARGIN, 40, 16);
      } catch { /* ignore */ }

      // Period label
      doc.setFontSize(28);
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.text(periodLabel, MARGIN, MARGIN + 50);

      // Hero revenue
      doc.setFontSize(48);
      doc.setTextColor(20, 20, 20);
      doc.text(formatIsk(revenue), MARGIN, MARGIN + 80);

      // YoY chip
      const yoySign = yoyPct > 0 ? "↑" : yoyPct < 0 ? "↓" : "→";
      const yoyColor: [number, number, number] = yoyPct >= 0 ? GREEN : RED;
      const chipText = prevRevenue > 0
        ? `${yoySign} ${Math.abs(yoyPct).toFixed(0)}% ${L("vs. í fyrra", "vs. last year")}`
        : L("Engin samanburður", "No comparison");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(...(prevRevenue > 0 ? yoyColor : MUTED_BG));
      doc.setTextColor(...(prevRevenue > 0 ? [255, 255, 255] : TEXT_MUTED));
      const chipW = doc.getTextWidth(chipText) + 8;
      doc.roundedRect(MARGIN, MARGIN + 88, chipW, 9, 2, 2, "F");
      doc.text(chipText, MARGIN + 4, MARGIN + 94);
      doc.setFont("helvetica", "normal");

      // Subtitle
      doc.setFontSize(12);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(`${ownerDisplay} · IDÉ House of Brands`, MARGIN, MARGIN + 110);

      // Generated date at bottom
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(
        `${L("Útbúin", "Generated")}: ${new Date().toLocaleDateString(isIs ? "is-IS" : "en-GB")}`,
        MARGIN,
        pageH - MARGIN,
      );

      // ---------- PAGE 2: PACE ----------
      doc.addPage();
      let y = MARGIN + 5;
      sectionTitle(L("Sölumarkmið", "Sales targets"), y);
      y += 10;

      doc.setFontSize(10);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(
        L(
          `Árið ${range.from.slice(0, 4)} · væntanleg framvinda ${(expectedPct * 100).toFixed(0)}%`,
          `Year ${range.from.slice(0, 4)} · expected progress ${(expectedPct * 100).toFixed(0)}%`,
        ),
        MARGIN,
        y,
      );
      y += 8;

      if (paceRows.length === 0) {
        doc.setFontSize(11);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(L("Engin markmið skráð.", "No targets recorded."), MARGIN, y + 6);
      } else {
        const barW = pageW - 2 * MARGIN;
        const barH = 8;
        for (const row of paceRows) {
          if (y > pageH - 40) { doc.addPage(); y = MARGIN + 5; }
          // Name
          doc.setFontSize(11);
          doc.setTextColor(20, 20, 20);
          doc.setFont("helvetica", "bold");
          doc.text(row.name, MARGIN, y);
          doc.setFont("helvetica", "normal");

          // Right side: actual / target
          doc.setFontSize(10);
          doc.setTextColor(...TEXT_MUTED);
          const txt = row.target > 0
            ? `${formatIsk(row.actual)} / ${formatIsk(row.target)}`
            : formatIsk(row.actual);
          doc.text(txt, pageW - MARGIN, y, { align: "right" });

          y += 3;

          // Bullet bar background
          doc.setFillColor(...MUTED_BG);
          doc.roundedRect(MARGIN, y, barW, barH, 1.5, 1.5, "F");

          // Fill
          if (row.target > 0) {
            const pct = Math.max(0, Math.min(1.2, row.actual / row.target));
            const fillW = Math.min(barW, barW * pct);
            const ratio = row.actual / row.target;
            const targetRatio = expectedPct;
            let color: [number, number, number] = AMBER;
            if (ratio >= targetRatio) color = GREEN;
            else if (ratio < targetRatio * 0.85) color = RED;
            doc.setFillColor(...color);
            doc.roundedRect(MARGIN, y, fillW, barH, 1.5, 1.5, "F");

            // Expected pace tick
            const tickX = MARGIN + barW * expectedPct;
            doc.setDrawColor(60, 60, 60);
            doc.setLineWidth(0.5);
            doc.line(tickX, y - 1, tickX, y + barH + 1);

            // Pct label
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            const pctText = `${(ratio * 100).toFixed(0)}%`;
            if (fillW > 12) {
              doc.text(pctText, MARGIN + 2, y + barH - 2);
            } else {
              doc.setTextColor(...TEXT_MUTED);
              doc.text(pctText, MARGIN + fillW + 2, y + barH - 2);
            }
          }

          y += barH + 8;
        }
      }

      // ---------- PAGE 3: PULSE ----------
      doc.addPage();
      y = MARGIN + 5;
      sectionTitle(L("Lykiltölur tímabils", "Period KPIs"), y);
      y += 10;

      const pulseTiles = [
        { label: L("Tekjur", "Revenue"), value: formatIsk(revenue), delta: yoyPct, hasPrev: prevRevenue > 0, suffix: "%" },
        { label: L("Sölur", "Deals"), value: String(deals.length), delta: deals.length - prevCount, hasPrev: prevCount > 0, suffix: "", abs: true },
        { label: L("Meðalsala", "Avg deal"), value: formatIsk(avg), delta: prevRevenue > 0 && prevCount > 0 ? ((avg - (prevRevenue / prevCount)) / (prevRevenue / prevCount)) * 100 : 0, hasPrev: prevCount > 0, suffix: "%" },
        { label: L("Framlegð", "Margin"), value: `${marginPct.toFixed(1)}%`, delta: 0, hasPrev: false, suffix: "" },
      ];
      const tileGap = 4;
      const tileW = (pageW - 2 * MARGIN - tileGap) / 2;
      const tileH = 36;
      pulseTiles.forEach((tile, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const tx = MARGIN + col * (tileW + tileGap);
        const ty = y + row * (tileH + tileGap);
        // Background tint
        const tint: [number, number, number] = !tile.hasPrev
          ? [255, 255, 255]
          : tile.delta > 0
            ? [240, 253, 244]
            : tile.delta < 0
              ? [254, 242, 242]
              : [255, 255, 255];
        doc.setFillColor(...tint);
        doc.setDrawColor(220);
        doc.roundedRect(tx, ty, tileW, tileH, 2, 2, "FD");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(tile.label.toUpperCase(), tx + 5, ty + 8);
        doc.setFontSize(20);
        doc.setTextColor(20, 20, 20);
        doc.setFont("helvetica", "bold");
        doc.text(tile.value, tx + 5, ty + 22);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        if (tile.hasPrev && tile.delta !== 0) {
          const sign = tile.delta > 0 ? "↑" : "↓";
          const c: [number, number, number] = tile.delta > 0 ? GREEN : RED;
          doc.setTextColor(...c);
          const num = tile.abs ? Math.abs(tile.delta).toFixed(0) : Math.abs(tile.delta).toFixed(0);
          doc.text(`${sign} ${num}${tile.suffix} ${L("vs. í fyrra", "vs. last year")}`, tx + 5, ty + 30);
        } else {
          doc.setTextColor(...TEXT_MUTED);
          doc.text(L("engin samanburður", "no comparison"), tx + 5, ty + 30);
        }
      });

      // ---------- PAGE 4: TREND ----------
      doc.addPage();
      y = MARGIN + 5;
      sectionTitle(L("6 mánaða þróun", "6-month trend"), y);
      y += 12;

      // Draw chart manually
      const chartX = MARGIN;
      const chartY = y;
      const chartW = pageW - 2 * MARGIN;
      const chartH = 90;
      doc.setDrawColor(220);
      doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);
      doc.line(chartX, chartY, chartX, chartY + chartH);

      const maxRev = Math.max(...trendMonths.map((m) => m.revenue), 1);
      const barCount = trendMonths.length;
      const slotW = chartW / barCount;
      const barWidth = slotW * 0.55;

      trendMonths.forEach((m, idx) => {
        const x = chartX + idx * slotW + (slotW - barWidth) / 2;
        const h = (m.revenue / maxRev) * (chartH - 8);
        doc.setFillColor(...NAVY);
        doc.rect(x, chartY + chartH - h, barWidth, h, "F");
        // x label
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(m.label, x + barWidth / 2, chartY + chartH + 5, { align: "center" });
        // value above bar
        if (m.revenue > 0) {
          doc.setFontSize(7);
          doc.setTextColor(20, 20, 20);
          const v = m.revenue >= 1_000_000
            ? `${(m.revenue / 1_000_000).toFixed(1)}m`
            : `${(m.revenue / 1000).toFixed(0)}k`;
          doc.text(v, x + barWidth / 2, chartY + chartH - h - 1, { align: "center" });
        }
      });

      // Margin line overlay
      const maxMar = Math.max(...trendMonths.map((m) => m.marginPct), 1);
      doc.setDrawColor(...GREEN);
      doc.setLineWidth(0.7);
      let prevX: number | null = null;
      let prevY: number | null = null;
      trendMonths.forEach((m, idx) => {
        const cx = chartX + idx * slotW + slotW / 2;
        const cy = chartY + chartH - (m.marginPct / maxMar) * (chartH - 8);
        if (prevX !== null && prevY !== null) {
          doc.line(prevX, prevY, cx, cy);
        }
        doc.setFillColor(...GREEN);
        doc.circle(cx, cy, 1, "F");
        prevX = cx;
        prevY = cy;
      });
      doc.setLineWidth(0.2);

      // Legend
      const legY = chartY + chartH + 12;
      doc.setFillColor(...NAVY);
      doc.rect(chartX, legY, 4, 4, "F");
      doc.setFontSize(9);
      doc.setTextColor(20, 20, 20);
      doc.text(L("Tekjur", "Revenue"), chartX + 6, legY + 3.5);
      doc.setFillColor(...GREEN);
      doc.circle(chartX + 35, legY + 2, 1.5, "F");
      doc.text(L("Framlegð %", "Margin %"), chartX + 38, legY + 3.5);

      // Trend description
      y = legY + 12;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const first = trendMonths[0];
      const last = trendMonths[trendMonths.length - 1];
      const revChangePct = first?.revenue
        ? ((last.revenue - first.revenue) / first.revenue) * 100
        : 0;
      const dir = revChangePct >= 0
        ? L("jukust um", "increased by")
        : L("drógust saman um", "decreased by");
      const desc = L(
        `Tekjur ${dir} ${Math.abs(revChangePct).toFixed(0)}% milli ${first?.label} og ${last?.label}, framlegð endaði í ${last?.marginPct.toFixed(0)}%.`,
        `Revenue ${dir} ${Math.abs(revChangePct).toFixed(0)}% between ${first?.label} and ${last?.label}; margin ended at ${last?.marginPct.toFixed(0)}%.`,
      );
      doc.text(doc.splitTextToSize(desc, pageW - 2 * MARGIN) as string[], MARGIN, y);

      // ---------- PAGE 5: TOP CUSTOMERS ----------
      doc.addPage();
      y = MARGIN + 5;
      sectionTitle(L("Stærstu viðskiptavinir", "Top customers"), y);
      y += 12;

      if (top5.length === 0) {
        doc.setFontSize(11);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(L("Engir viðskiptavinir á tímabilinu.", "No customers in period."), MARGIN, y);
      } else {
        const rowH = 18;
        const labelW = 55;
        const barAreaX = MARGIN + labelW;
        const valueW = 55;
        const barAreaW = pageW - 2 * MARGIN - labelW - valueW;
        top5.forEach((c, idx) => {
          const ry = y + idx * rowH;
          // Customer name
          doc.setFontSize(10);
          doc.setTextColor(20, 20, 20);
          doc.setFont("helvetica", "bold");
          const name = c.name.length > 28 ? c.name.slice(0, 27) + "…" : c.name;
          doc.text(name, MARGIN, ry + 7);
          doc.setFont("helvetica", "normal");

          // Bar
          const barH2 = 8;
          doc.setFillColor(...MUTED_BG);
          doc.roundedRect(barAreaX, ry + 2, barAreaW, barH2, 1, 1, "F");
          const w = topCustomersMax > 0 ? (c.total / topCustomersMax) * barAreaW : 0;
          doc.setFillColor(...NAVY);
          doc.roundedRect(barAreaX, ry + 2, Math.max(w, 0.1), barH2, 1, 1, "F");

          // Value
          doc.setFontSize(9);
          doc.setTextColor(20, 20, 20);
          doc.text(formatIsk(c.total), pageW - MARGIN, ry + 5, { align: "right" });
          doc.setTextColor(...TEXT_MUTED);
          doc.setFontSize(8);
          doc.text(`${c.count} ${L("sölur", "deals")}`, pageW - MARGIN, ry + 10, { align: "right" });
        });
      }

      // ---------- PAGE 6: APPENDIX ----------
      doc.addPage();
      y = MARGIN + 5;
      sectionTitle(L("Viðauki — gögn", "Appendix — data"), y);
      y += 8;

      // Deals delivered
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.text(L("Sölur afhentar á tímabilinu", "Deals delivered in period"), MARGIN, y);
      doc.setFont("helvetica", "normal");
      autoTable(doc, {
        startY: y + 3,
        head: [[
          "SO",
          L("Viðskiptavinur", "Customer"),
          L("Sölumaður", "Rep"),
          L("Upphæð", "Amount"),
          L("Framlegð", "Margin"),
        ]],
        body: deals
          .slice()
          .sort((a: any, b: any) => net(b) - net(a))
          .slice(0, 30)
          .map((d: any) => [
            d.so_number ?? "—",
            d.company?.name ?? "—",
            (d.owner_id && profileMap[d.owner_id]?.name) || "—",
            formatIsk(net(d)),
            formatIsk(netMargin(d)),
          ]),
        headStyles: { fillColor: NAVY, textColor: 255 },
        styles: { fontSize: 8 },
        margin: { left: MARGIN, right: MARGIN },
      });
      // @ts-expect-error lastAutoTable
      y = (doc.lastAutoTable?.finalY ?? y) + 8;

      // Pipeline by stage
      if (Object.keys(pipeline).length > 0) {
        if (y > pageH - 50) { doc.addPage(); y = MARGIN + 5; }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(L("Pipeline eftir stigi", "Pipeline by stage"), MARGIN, y);
        doc.setFont("helvetica", "normal");
        autoTable(doc, {
          startY: y + 3,
          head: [[
            L("Stig", "Stage"),
            L("Fjöldi", "Count"),
            L("Verðmæti", "Value"),
          ]],
          body: Object.entries(pipeline).map(([stage, v]) => [
            isIs
              ? (t.dealStage as Record<string, string>)[stage] ?? stage
              : STAGE_LABELS_EN[stage] ?? stage,
            String(v.count),
            formatIsk(v.total),
          ]),
          headStyles: { fillColor: NAVY, textColor: 255 },
          styles: { fontSize: 9 },
          margin: { left: MARGIN, right: MARGIN },
        });
      }

      // ---------- Footers ----------
      const totalPages = doc.getNumberOfPages();
      for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
      }

      const ownerSlug = ownerName ? slugify(ownerName) : "team";
      doc.save(`IDE_yfirlit_${range.slug}_${ownerSlug}.pdf`);
      onOpenChange(false);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.yfirlit.exportDialog.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label>{t.yfirlit.exportDialog.period}</Label>
            <RadioGroup value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="month" id="p-month" />
                <Label htmlFor="p-month" className="font-normal">
                  {t.yfirlit.exportDialog.periodMonth}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ytd" id="p-ytd" />
                <Label htmlFor="p-ytd" className="font-normal">
                  {t.yfirlit.exportDialog.periodYTD}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="lastyear" id="p-ly" />
                <Label htmlFor="p-ly" className="font-normal">
                  {t.yfirlit.exportDialog.periodLastYear}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {period === "month" && (
            <div className="space-y-2">
              <Label>{t.yfirlit.exportDialog.selectMonth}</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.labelIs}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t.yfirlit.exportDialog.language}</Label>
            <RadioGroup value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="is" id="l-is" />
                <Label htmlFor="l-is" className="font-normal">
                  {t.yfirlit.exportDialog.languageIs}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="en" id="l-en" />
                <Label htmlFor="l-en" className="font-normal">
                  {t.yfirlit.exportDialog.languageEn}
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            {t.yfirlit.exportDialog.cancel}
          </Button>
          <Button
            onClick={handleDownload}
            disabled={generating}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {t.yfirlit.exportDialog.download}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
