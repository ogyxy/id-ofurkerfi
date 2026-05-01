import ExcelJS from "exceljs";
import { t } from "@/lib/sala_translations_is";
import type { Database } from "@/integrations/supabase/types";

type DealStage = Database["public"]["Enums"]["deal_stage"];
type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export interface ExportableDeal {
  so_number: string;
  name: string;
  stage: DealStage;
  amount_isk: number | null;
  total_cost_isk?: number | null;
  shipping_cost_isk?: number | null;
  margin_isk?: number | null;
  total_margin_isk?: number | null;
  refund_amount_isk?: number | null;
  defect_resolution?: Database["public"]["Enums"]["defect_resolution"] | null;
  promised_delivery_date: string | null;
  delivered_at: string | null;
  invoice_status: InvoiceStatus;
  payment_status: PaymentStatus;
  tracking_numbers: string[] | null;
  created_at: string;
  company: { name: string } | null;
  contact: { first_name: string | null; last_name: string | null } | null;
  owner: { name: string | null } | null;
}

export interface ExportFilenameParts {
  stageLabel?: string | null;
  year?: number | null;
  ownerName?: string | null;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function contactName(c: ExportableDeal["contact"]): string {
  if (!c) return "";
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
}

const ISK_FMT = '#,##0" kr."';
const PCT_FMT = "0.0%";
const DATE_FMT = "dd.mm.yyyy";

const COLUMNS = [
  { name: "Sölunúmer", key: "so_number", width: 12 },
  { name: "Stofnað", key: "created_at", width: 12, numFmt: DATE_FMT },
  { name: "Heiti", key: "name", width: 32 },
  { name: "Viðskiptavinur", key: "company", width: 28 },
  { name: "Tengiliður", key: "contact", width: 22 },
  { name: "Staða", key: "stage", width: 18 },
  { name: "Söluverð", key: "price", width: 16, numFmt: ISK_FMT, totalsRowFunction: "sum" as const },
  { name: "Kostnaðarverð", key: "cost", width: 16, numFmt: ISK_FMT, totalsRowFunction: "sum" as const },
  { name: "Framlegð", key: "margin", width: 14, numFmt: ISK_FMT, totalsRowFunction: "sum" as const },
  { name: "Framlegð %", key: "margin_pct", width: 12, numFmt: PCT_FMT, totalsRowFormula: "" },
  { name: "Deadline", key: "promised", width: 12, numFmt: DATE_FMT },
  { name: "Afhent", key: "delivered_at", width: 12, numFmt: DATE_FMT },
  { name: "Reikningsstaða", key: "invoice_status", width: 18 },
  { name: "Greiðslustaða", key: "payment_status", width: 16 },
  { name: "Söluaðili", key: "owner", width: 18 },
  { name: "Tracking númer", key: "tracking", width: 24 },
];

export async function exportDealsToXlsx(
  deals: ExportableDeal[],
  filenameParts: ExportFilenameParts = {},
) {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet("Sölur", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Build data rows
  const dataRows = deals.map((d) => {
    const price = d.amount_isk != null ? Number(d.amount_isk) : null;
    const cost =
      d.total_cost_isk != null
        ? Number(d.total_cost_isk) + Number(d.shipping_cost_isk ?? 0)
        : null;
    const margin = price != null && cost != null ? price - cost : null;
    const marginPct =
      margin != null && price != null && price !== 0 ? margin / price : null;

    return [
      d.so_number,
      toDate(d.created_at),
      d.name,
      d.company?.name ?? "",
      contactName(d.contact),
      t.dealStage[d.stage] ?? d.stage,
      price,
      cost,
      margin,
      marginPct,
      toDate(d.promised_delivery_date),
      toDate(d.delivered_at),
      t.invoiceStatus[d.invoice_status] ?? d.invoice_status,
      t.paymentStatus[d.payment_status] ?? d.payment_status,
      d.owner?.name ?? "",
      (d.tracking_numbers ?? []).join(", "),
    ];
  });

  const hasData = dataRows.length > 0;
  // Excel Tables require at least one data row. If empty, write a single blank row.
  const tableRows = hasData ? dataRows : [Array(COLUMNS.length).fill(null)];

  ws.addTable({
    name: "Solur",
    ref: "A1",
    headerRow: true,
    totalsRow: hasData,
    style: {
      theme: "TableStyleMedium2",
      showRowStripes: true,
    },
    columns: COLUMNS.map((c, idx) => {
      const col: ExcelJS.TableColumnProperties = { name: c.name, filterButton: true };
      if (!hasData) return col;
      if (idx === 0) {
        col.totalsRowLabel = "Samtals";
      } else if (idx === 2) {
        // "Heiti" gets the count label
        col.totalsRowLabel = `${dataRows.length.toLocaleString("is-IS")} sölur`;
      } else if (c.totalsRowFunction) {
        col.totalsRowFunction = c.totalsRowFunction;
      } else if (c.key === "margin_pct") {
        // Weighted margin %: SUM(Framlegð) / SUM(Söluverð)
        col.totalsRowFormula = `IFERROR(Solur[[#Totals],[Framlegð]]/Solur[[#Totals],[Söluverð]],0)`;
      }
      return col;
    }),
    rows: tableRows,
  });

  // Column widths + number formats
  COLUMNS.forEach((c, idx) => {
    const column = ws.getColumn(idx + 1);
    column.width = c.width;
    if (c.numFmt) column.numFmt = c.numFmt;
  });

  // Style header row (overrides table theme header for our brand)
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1A2540" },
    };
  });

  // Style totals row (bold, soft-blue fill, top border, right-align numerics)
  if (hasData) {
    const totalsRowNum = 1 + dataRows.length + 1; // header + data + totals
    const totalsRow = ws.getRow(totalsRowNum);
    const numericColIdx = new Set([7, 8, 9, 10]); // 1-based: G, H, I, J
    totalsRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { bold: true, color: { argb: "FF1A2540" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE6F0FA" },
      };
      cell.border = {
        top: { style: "medium", color: { argb: "FF1A2540" } },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: numericColIdx.has(colNumber) ? "right" : "left",
      };
    });
    // Re-apply number formats on totals row (table doesn't always inherit)
    COLUMNS.forEach((c, idx) => {
      if (c.numFmt) {
        const cell = totalsRow.getCell(idx + 1);
        cell.numFmt = c.numFmt;
      }
    });
  }

  // Build filename
  const parts: string[] = [];
  const stageYear = [
    filenameParts.stageLabel?.trim() || null,
    filenameParts.year != null ? String(filenameParts.year) : null,
  ]
    .filter(Boolean)
    .join(" ");
  if (stageYear) parts.push(stageYear);
  if (filenameParts.ownerName?.trim()) parts.push(filenameParts.ownerName.trim());
  const suffix = parts.length ? ` - ${parts.join(" - ")}` : "";
  const filename = `IDÉ Sölur${suffix}.xlsx`;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
