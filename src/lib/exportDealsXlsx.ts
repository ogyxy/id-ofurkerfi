import * as XLSX from "xlsx";
import { t } from "@/lib/sala_translations_is";

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
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

const HEADERS = [
  "Sölunúmer",
  "Stofnað",
  "Heiti",
  "Viðskiptavinur",
  "Tengiliður",
  "Staða",
  "Söluverð",
  "Kostnaðarverð",
  "Framlegð",
  "Framlegð %",
  "Deadline",
  "Afhent",
  "Reikningsstaða",
  "Greiðslustaða",
  "Söluaðili",
  "Tracking númer",
] as const;

function contactName(c: ExportableDeal["contact"]): string {
  if (!c) return "";
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
}

export interface ExportFilenameParts {
  stageLabel?: string | null;
  year?: number | null;
  ownerName?: string | null;
}

export function exportDealsToXlsx(
  deals: ExportableDeal[],
  filenameParts: ExportFilenameParts = {},
) {

  const rows = deals.map((d) => {
    const price = d.amount_isk != null ? Number(d.amount_isk) : null;
    const cost =
      d.total_cost_isk != null
        ? Number(d.total_cost_isk) + Number(d.shipping_cost_isk ?? 0)
        : null;
    const margin =
      price != null && cost != null ? price - cost : null;
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

  const dataRowCount = rows.length;
  const firstDataExcelRow = 2; // header=1, first data=2
  const lastDataExcelRow = dataRowCount + 1;
  const totalExcelRow = dataRowCount + 2; // 1-based Excel row for totals

  const totalsRow: (string | number | Date | null)[] = [
    "Samtals",
    null,
    `${dataRowCount.toLocaleString("is-IS")} sölur`,
    "",
    "",
    "",
    0,
    0,
    0,
    0,
    "",
    "",
    "",
    "",
    "",
    "",
  ];

  const aoa: (string | number | Date | null)[][] = [
    HEADERS as unknown as string[],
    ...rows,
    totalsRow,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

  // Replace totals numeric cells with formulas (only when there are data rows)
  if (dataRowCount > 0) {
    const formulas: Record<string, string> = {
      [`G${totalExcelRow}`]: `SUM(G${firstDataExcelRow}:G${lastDataExcelRow})`,
      [`H${totalExcelRow}`]: `SUM(H${firstDataExcelRow}:H${lastDataExcelRow})`,
      [`I${totalExcelRow}`]: `SUM(I${firstDataExcelRow}:I${lastDataExcelRow})`,
      [`J${totalExcelRow}`]: `IF(G${totalExcelRow}=0,0,I${totalExcelRow}/G${totalExcelRow})`,
    };
    for (const [addr, f] of Object.entries(formulas)) {
      ws[addr] = { t: "n", f };
    }
  }


  // ISK number format: 123.456 kr.   (dot as thousands separator)
  const iskFmt = '#,##0" kr."';
  const pctFmt = "0.0%";
  const dateFmt = "dd.mm.yyyy";
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  const totalRowZeroBased = dataRowCount + 1;
  for (let r = 1; r <= range.e.r; r++) {
    // ISK columns: Söluverð (6), Kostnaðarverð (7), Framlegð (8)
    for (const col of [6, 7, 8]) {
      const addr = XLSX.utils.encode_cell({ r, c: col });
      const cell = ws[addr];
      if (cell && (typeof cell.v === "number" || typeof cell.f === "string")) {
        cell.t = "n";
        cell.z = iskFmt;
      }
    }
    // Percentage column: Framlegð % (9)
    {
      const addr = XLSX.utils.encode_cell({ r, c: 9 });
      const cell = ws[addr];
      if (cell && (typeof cell.v === "number" || typeof cell.f === "string")) {
        cell.t = "n";
        cell.z = pctFmt;
      }
    }
    // Date columns: Stofnað (1), Deadline (10), Afhent (11) — skip totals row
    if (r !== totalRowZeroBased) {
      for (const col of [1, 10, 11]) {
        const addr = XLSX.utils.encode_cell({ r, c: col });
        const cell = ws[addr];
        if (cell && cell.v instanceof Date) {
          cell.t = "d";
          cell.z = dateFmt;
        }
      }
    }
  }

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1A2540" } },
    alignment: { vertical: "center", horizontal: "left" },
  };
  for (let c = 0; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) {
      (ws[addr] as { s?: unknown }).s = headerStyle;
    }
  }

  // Totals row styling: bold, light blue background, top border, right-align numerics
  const totalsBaseStyle = {
    font: { bold: true, color: { rgb: "1A2540" } },
    fill: { fgColor: { rgb: "E6F0FA" } },
    border: { top: { style: "medium", color: { rgb: "1A2540" } } },
    alignment: { vertical: "center", horizontal: "left" as const },
  };
  const totalsNumericStyle = {
    ...totalsBaseStyle,
    alignment: { vertical: "center", horizontal: "right" as const },
  };
  const numericCols = new Set([6, 7, 8, 9]);
  for (let c = 0; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: totalRowZeroBased, c });
    if (!ws[addr]) {
      ws[addr] = { t: "s", v: "" };
    }
    (ws[addr] as { s?: unknown }).s = numericCols.has(c)
      ? totalsNumericStyle
      : totalsBaseStyle;
  }

  // Column widths
  const widths = [12, 12, 32, 28, 22, 18, 16, 16, 14, 12, 12, 12, 18, 16, 18, 24];
  ws["!cols"] = widths.map((w) => ({ wch: w }));

  // Freeze header row. Excel cannot natively freeze a bottom row.
  (ws as unknown as { "!views"?: unknown[] })["!views"] = [
    { state: "frozen", ySplit: 1, xSplit: 0, topLeftCell: "A2", activePane: "bottomLeft" },
  ];

  // Autofilter only over the data range (exclude totals row)
  const lastDataRowRef = XLSX.utils.encode_cell({ r: dataRowCount, c: range.e.c });
  ws["!autofilter"] = { ref: `A1:${lastDataRowRef}` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sölur");

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
  XLSX.writeFile(wb, filename, { bookType: "xlsx", compression: true });
}
