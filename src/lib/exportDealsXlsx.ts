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

  const aoa: (string | number | Date | null)[][] = [HEADERS as unknown as string[], ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

  // ISK number format: 123.456 kr.   (dot as thousands separator)
  const iskFmt = '#,##0" kr."';
  const pctFmt = "0.0%";
  const dateFmt = "dd.mm.yyyy";
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let r = 1; r <= range.e.r; r++) {
    // ISK columns: Söluverð (6), Kostnaðarverð (7), Framlegð (8)
    for (const col of [6, 7, 8]) {
      const addr = XLSX.utils.encode_cell({ r, c: col });
      const cell = ws[addr];
      if (cell && typeof cell.v === "number") {
        cell.t = "n";
        cell.z = iskFmt;
      }
    }
    // Percentage column: Framlegð % (9)
    {
      const addr = XLSX.utils.encode_cell({ r, c: 9 });
      const cell = ws[addr];
      if (cell && typeof cell.v === "number") {
        cell.t = "n";
        cell.z = pctFmt;
      }
    }
    // Date columns: Stofnað (1), Deadline (10), Afhent (11)
    for (const col of [1, 10, 11]) {
      const addr = XLSX.utils.encode_cell({ r, c: col });
      const cell = ws[addr];
      if (cell && cell.v instanceof Date) {
        cell.t = "d";
        cell.z = dateFmt;
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

  // Column widths
  const widths = [12, 12, 32, 28, 22, 18, 16, 16, 14, 12, 12, 12, 18, 16, 18, 24];
  ws["!cols"] = widths.map((w) => ({ wch: w }));

  ws["!autofilter"] = { ref: ws["!ref"]! };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sölur");

  const filename = `IDE_Sölur_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename, { bookType: "xlsx", compression: true });
}
