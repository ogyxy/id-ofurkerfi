import { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
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

      // Period deals
      const { data: dealsRaw } = await supabase
        .from("deals")
        .select(
          "id, so_number, name, amount_isk, total_margin_isk, refund_amount_isk, defect_resolution, stage, delivered_at, company:companies(name)"
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

      // Top customers
      const byCompany: Record<string, { name: string; total: number; count: number }> = {};
      deals.forEach((d: any) => {
        const name = d.company?.name || "—";
        if (!byCompany[name]) byCompany[name] = { name, total: 0, count: 0 };
        byCompany[name].total += net(d);
        byCompany[name].count += 1;
      });
      const top = Object.values(byCompany).sort((a, b) => b.total - a.total).slice(0, 5);

      // Defects
      const defects = deals.filter(
        (d: any) => d.stage === "defect_reorder" || (d.refund_amount_isk || 0) > 0
      );

      // Pipeline (current state)
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

      const isIs = lang === "is";
      const L = (is: string, en: string) => (isIs ? is : en);
      const periodLabel = isIs ? range.labelIs : range.labelEn;

      const doc = new jsPDF();
      let y = 20;

      doc.setFontSize(16);
      doc.text(
        `${L("IDÉ House of Brands Ísland", "IDÉ House of Brands Iceland")} — ${L(
          "Skýrsla",
          "Report"
        )} — ${periodLabel}`,
        14,
        y
      );
      y += 10;

      doc.setFontSize(11);
      doc.text(`${L("Tímabil", "Period")}: ${range.from} — ${range.to}`, 14, y);
      y += 10;

      // Summary
      doc.setFontSize(13);
      doc.text(L("Yfirlit", "Summary"), 14, y);
      y += 6;
      doc.setFontSize(11);
      const lines = [
        `${L("Tekjur", "Revenue")}: ${formatIsk(revenue)}`,
        `${L("Sölur kláraðar", "Deals delivered")}: ${deals.length}`,
        `${L("Meðalsala", "Average deal")}: ${formatIsk(avg)}`,
        `${L("Framlegð", "Margin")}: ${marginPct.toFixed(1)}%`,
      ];
      lines.forEach((line) => {
        doc.text(line, 14, y);
        y += 6;
      });
      y += 4;

      // Top customers
      autoTable(doc, {
        startY: y,
        head: [[
          L("Viðskiptavinur", "Customer"),
          L("Tekjur (ISK)", "Revenue (ISK)"),
          L("Sölur", "Deals"),
        ]],
        body: top.map((c) => [c.name, formatIsk(c.total), String(c.count)]),
        headStyles: { fillColor: [26, 37, 64] },
      });
      // @ts-expect-error lastAutoTable injected by plugin
      y = (doc.lastAutoTable?.finalY ?? y) + 10;

      // Pipeline
      doc.setFontSize(13);
      doc.text(L("Pipeline (núverandi)", "Pipeline (current)"), 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
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
        headStyles: { fillColor: [26, 37, 64] },
      });
      // @ts-expect-error lastAutoTable injected by plugin
      y = (doc.lastAutoTable?.finalY ?? y) + 10;

      // Defects
      doc.setFontSize(13);
      doc.text(L("Gallar á tímabilinu", "Defects in period"), 14, y);
      y += 4;
      if (defects.length === 0) {
        doc.setFontSize(11);
        doc.text(L("Engir gallar.", "No defects."), 14, y + 4);
      } else {
        autoTable(doc, {
          startY: y,
          head: [[
            L("SO", "SO"),
            L("Viðskiptavinur", "Customer"),
            L("Endurgreiðsla (ISK)", "Refund (ISK)"),
          ]],
          body: defects.map((d: any) => [
            d.so_number,
            d.company?.name ?? "—",
            formatIsk(d.refund_amount_isk || 0),
          ]),
          headStyles: { fillColor: [26, 37, 64] },
        });
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
