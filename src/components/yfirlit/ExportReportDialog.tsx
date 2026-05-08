import { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { filterVisibleProfiles } from "@/lib/hiddenUsers";
import { t, formatIsk } from "@/lib/sala_translations_is";
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
}

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
    labelIs: `${t.yfirlit.monthsLong[ms - 1]} ${ys}`,
    labelEn: `${EN_MONTHS[ms - 1]} ${ys}`,
    slug: `${ys}-${String(ms).padStart(2, "0")}`,
  };
}

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

export function ExportReportDialog({ open, onOpenChange }: ExportReportDialogProps) {
  const monthOptions = useMemo(buildMonthOptions, []);
  const [period, setPeriod] = useState<Period>("month");
  const [month, setMonth] = useState<string>(monthOptions[1]?.value ?? monthOptions[0].value);
  const [lang, setLang] = useState<Lang>("is");
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const range = calcRange(period, month);
      const isIs = lang === "is";
      const L = (is: string, en: string) => (isIs ? is : en);
      const periodLabel = isIs ? range.labelIs : range.labelEn;

      // ---------- Period delivered deals ----------
      const { data: dealsRaw } = await supabase
        .from("deals")
        .select(
          "id, owner_id, so_number, name, amount_isk, total_margin_isk, refund_amount_isk, defect_resolution, stage, delivered_at, company:companies(name)"
        )
        .eq("archived", false)
        .gte("delivered_at", range.from)
        .lte("delivered_at", range.to);

      const deals = dealsRaw ?? [];
      const net = (d: any) => (d.amount_isk || 0) - (d.refund_amount_isk || 0);
      const netMargin = (d: any) => (d.total_margin_isk || 0) - (d.refund_amount_isk || 0);
      const revenue = deals.reduce((s, d) => s + net(d), 0);
      const margin = deals.reduce((s, d) => s + netMargin(d), 0);
      const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
      const avg = deals.length ? revenue / deals.length : 0;

      // ---------- Per-owner performance ----------
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email");
      const profileMap: Record<string, { name: string; email: string }> = {};
      (profiles ?? []).forEach((p: any) => {
        profileMap[p.id] = { name: p.name ?? "", email: p.email ?? "" };
      });
      const byOwner: Record<string, { rev: number; mar: number; n: number }> = {};
      deals.forEach((d: any) => {
        if (!d.owner_id) return;
        if (!byOwner[d.owner_id]) byOwner[d.owner_id] = { rev: 0, mar: 0, n: 0 };
        byOwner[d.owner_id].rev += net(d);
        byOwner[d.owner_id].mar += netMargin(d);
        byOwner[d.owner_id].n += 1;
      });
      const ownerRows = Object.entries(byOwner)
        .map(([id, v]) => ({
          name: profileMap[id]?.name || profileMap[id]?.email || "—",
          rev: v.rev,
          mar: v.mar,
          n: v.n,
          pct: v.rev > 0 ? (v.mar / v.rev) * 100 : 0,
        }))
        .sort((a, b) => b.rev - a.rev);

      // ---------- Top customers ----------
      const byCompany: Record<string, { name: string; total: number; count: number }> = {};
      deals.forEach((d: any) => {
        const name = d.company?.name || "—";
        if (!byCompany[name]) byCompany[name] = { name, total: 0, count: 0 };
        byCompany[name].total += net(d);
        byCompany[name].count += 1;
      });
      const top = Object.values(byCompany).sort((a, b) => b.total - a.total).slice(0, 10);

      // ---------- Sales targets vs actuals (only for ytd/lastyear) ----------
      let targetRows: Array<{ name: string; target: number; actual: number; pct: number }> = [];
      if (period !== "month") {
        const yearStart = range.from.slice(0, 4) + "-01-01";
        const { data: targetsRaw } = await supabase
          .from("sales_targets")
          .select("owner_id, period_type, period_start, target_isk")
          .eq("period_type", "year")
          .eq("period_start", yearStart);
        const targetByOwner: Record<string, number> = {};
        (targetsRaw ?? []).forEach((t: any) => {
          targetByOwner[t.owner_id] = (targetByOwner[t.owner_id] || 0) + (t.target_isk || 0);
        });
        const allOwnerIds = new Set([...Object.keys(targetByOwner), ...Object.keys(byOwner)]);
        targetRows = Array.from(allOwnerIds)
          .map((id) => {
            const target = targetByOwner[id] || 0;
            const actual = byOwner[id]?.rev || 0;
            return {
              name: profileMap[id]?.name || profileMap[id]?.email || "—",
              target,
              actual,
              pct: target > 0 ? (actual / target) * 100 : 0,
            };
          })
          .filter((r) => r.target > 0 || r.actual > 0)
          .sort((a, b) => b.actual - a.actual);
      }

      // ---------- Pipeline (current state) ----------
      const { data: openRaw } = await supabase
        .from("deals")
        .select("stage, amount_isk")
        .eq("archived", false)
        .in("stage", ["inquiry", "quote_in_progress", "quote_sent", "order_confirmed"]);

      const pipeline: Record<string, { count: number; total: number }> = {};
      (openRaw ?? []).forEach((d: any) => {
        if (!pipeline[d.stage]) pipeline[d.stage] = { count: 0, total: 0 };
        pipeline[d.stage].count += 1;
        pipeline[d.stage].total += d.amount_isk || 0;
      });

      // ---------- Flagged deals (current state) ----------
      const { data: flaggedRaw } = await supabase
        .from("deals")
        .select("so_number, name, stage, amount_isk, defect_resolution, paid, delivered_at, company:companies(name)")
        .eq("archived", false)
        .or("stage.eq.defect_reorder,and(stage.eq.delivered,paid.eq.false)");
      const flagged = (flaggedRaw ?? []).slice(0, 20);

      // ============ BUILD PDF ============
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      let y = 18;

      // Header band
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pageW, 28, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.text(L("IDÉ House of Brands Ísland", "IDÉ House of Brands Iceland"), 14, 13);
      doc.setFontSize(11);
      doc.text(`${L("Sölu­skýrsla", "Sales report")} — ${periodLabel}`, 14, 21);
      doc.setTextColor(0, 0, 0);
      y = 38;

      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text(`${L("Tímabil", "Period")}: ${range.from} — ${range.to}`, 14, y);
      doc.text(
        `${L("Útbúin", "Generated")}: ${new Date().toISOString().slice(0, 10)}`,
        pageW - 14,
        y,
        { align: "right" },
      );
      doc.setTextColor(0, 0, 0);
      y += 10;

      // KPI cards
      const kpis = [
        { label: L("Tekjur", "Revenue"), val: formatIsk(revenue) },
        { label: L("Sölur", "Deals"), val: String(deals.length) },
        { label: L("Meðalsala", "Avg deal"), val: formatIsk(avg) },
        { label: L("Framlegð", "Margin"), val: `${marginPct.toFixed(1)}%` },
      ];
      const cardW = (pageW - 28 - 12) / 4;
      kpis.forEach((k, i) => {
        const x = 14 + i * (cardW + 4);
        doc.setDrawColor(220);
        doc.setFillColor(248, 249, 251);
        doc.roundedRect(x, y, cardW, 22, 2, 2, "FD");
        doc.setFontSize(8);
        doc.setTextColor(110, 110, 110);
        doc.text(k.label.toUpperCase(), x + 4, y + 7);
        doc.setFontSize(12);
        doc.setTextColor(20, 20, 20);
        doc.text(k.val, x + 4, y + 17);
      });
      y += 30;

      // Sales rep performance
      if (ownerRows.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(20, 20, 20);
        doc.text(L("Frammistaða sölufólks", "Sales rep performance"), 14, y);
        y += 3;
        autoTable(doc, {
          startY: y + 2,
          head: [[
            L("Sölumaður", "Rep"),
            L("Tekjur", "Revenue"),
            L("Framlegð", "Margin"),
            L("%", "%"),
            L("Sölur", "Deals"),
          ]],
          body: ownerRows.map((r) => [
            r.name,
            formatIsk(r.rev),
            formatIsk(r.mar),
            `${r.pct.toFixed(1)}%`,
            String(r.n),
          ]),
          headStyles: { fillColor: NAVY },
          styles: { fontSize: 9 },
        });
        // @ts-expect-error lastAutoTable injected by plugin
        y = (doc.lastAutoTable?.finalY ?? y) + 8;
      }

      // Targets vs actuals
      if (targetRows.length > 0) {
        if (y > 230) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.text(L("Markmið vs raunin", "Targets vs actuals"), 14, y);
        autoTable(doc, {
          startY: y + 4,
          head: [[
            L("Sölumaður", "Rep"),
            L("Markmið", "Target"),
            L("Raun", "Actual"),
            L("Framvinda", "Progress"),
          ]],
          body: targetRows.map((r) => [
            r.name,
            r.target > 0 ? formatIsk(r.target) : "—",
            formatIsk(r.actual),
            r.target > 0 ? `${r.pct.toFixed(0)}%` : "—",
          ]),
          headStyles: { fillColor: NAVY },
          styles: { fontSize: 9 },
        });
        // @ts-expect-error lastAutoTable
        y = (doc.lastAutoTable?.finalY ?? y) + 8;
      }

      // Top customers
      if (top.length > 0) {
        if (y > 230) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.text(L("Stærstu viðskiptavinir", "Top customers"), 14, y);
        autoTable(doc, {
          startY: y + 4,
          head: [[
            L("Viðskiptavinur", "Customer"),
            L("Tekjur (ISK)", "Revenue (ISK)"),
            L("Sölur", "Deals"),
          ]],
          body: top.map((c) => [c.name, formatIsk(c.total), String(c.count)]),
          headStyles: { fillColor: NAVY },
          styles: { fontSize: 9 },
        });
        // @ts-expect-error lastAutoTable
        y = (doc.lastAutoTable?.finalY ?? y) + 8;
      }

      // Pipeline
      if (Object.keys(pipeline).length > 0) {
        if (y > 230) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.text(L("Pipeline (núverandi)", "Pipeline (current)"), 14, y);
        autoTable(doc, {
          startY: y + 4,
          head: [[
            L("Stig", "Stage"),
            L("Fjöldi", "Count"),
            L("Verðmæti (ISK)", "Value (ISK)"),
          ]],
          body: Object.entries(pipeline).map(([stage, v]) => [
            isIs
              ? (t.dealStage as Record<string, string>)[stage] ?? stage
              : STAGE_LABELS_EN[stage] ?? stage,
            String(v.count),
            formatIsk(v.total),
          ]),
          headStyles: { fillColor: NAVY },
          styles: { fontSize: 9 },
        });
        // @ts-expect-error lastAutoTable
        y = (doc.lastAutoTable?.finalY ?? y) + 8;
      }

      // Flagged deals
      if (flagged.length > 0) {
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.text(L("Sölur sem þurfa athygli", "Deals needing attention"), 14, y);
        autoTable(doc, {
          startY: y + 4,
          head: [[
            "SO",
            L("Viðskiptavinur", "Customer"),
            L("Stig", "Stage"),
            L("Upphæð", "Amount"),
          ]],
          body: flagged.map((d: any) => [
            d.so_number ?? "—",
            d.company?.name ?? "—",
            isIs
              ? (t.dealStage as Record<string, string>)[d.stage] ?? d.stage
              : STAGE_LABELS_EN[d.stage] ?? d.stage,
            formatIsk(d.amount_isk || 0),
          ]),
          headStyles: { fillColor: NAVY },
          styles: { fontSize: 9 },
        });
      }

      // Page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(
          `${i} / ${pageCount}`,
          pageW - 14,
          doc.internal.pageSize.getHeight() - 8,
          { align: "right" },
        );
      }

      doc.save(`sala-skyrsla-${range.slug}.pdf`);
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
