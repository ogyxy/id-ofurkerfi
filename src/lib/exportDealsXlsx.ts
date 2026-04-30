import * as XLSX from "xlsx";
import { t, formatDate } from "@/lib/sala_translations_is";
import type { Database } from "@/integrations/supabase/types";

type DealStage = Database["public"]["Enums"]["deal_stage"];
type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export interface ExportableDeal {
  so_number: string;
  name: string;
  stage: DealStage;
  amount_isk: number | null;
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
  "Heiti",
  "Viðskiptavinur",
  "Tengiliður",
  "Staða",
  "Upphæð án vsk",
  "Framlegð",
  "Deadline",
  "Afhent",
  "Reikningsstaða",
  "Greiðslustaða",
  "Söluaðili",
  "Stofnað",
  "Tracking númer",
] as const;

function contactName(c: ExportableDeal["contact"]): string {
  if (!c) return "";
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
}

export function exportDealsToXlsx(deals: ExportableDeal[]) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const rows = deals.map((d) => [
    d.so_number,
    d.name,
    d.company?.name ?? "",
    contactName(d.contact),
    t.dealStage[d.stage] ?? d.stage,
    d.amount_isk != null ? Number(d.amount_isk) : null,
    d.total_margin_isk != null
      ? Number(d.total_margin_isk)
      : d.margin_isk != null
        ? Number(d.margin_isk)
        : null,
    d.promised_delivery_date ? formatDate(d.promised_delivery_date) : "",
    d.delivered_at ? formatDate(d.delivered_at) : "",
    t.invoiceStatus[d.invoice_status] ?? d.invoice_status,
    t.paymentStatus[d.payment_status] ?? d.payment_status,
    d.owner?.name ?? "",
    d.created_at ? formatDate(d.created_at) : "",
    (d.tracking_numbers ?? []).join(", "),
  ]);

  const aoa: (string | number | null)[][] = [HEADERS as unknown as string[], ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // ISK number format: 123.456 kr.   (dot as thousands separator)
  // Excel format string with locale-style "kr." suffix
  const iskFmt = '#,##0" kr."';
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let r = 1; r <= range.e.r; r++) {
    for (const col of [5, 6]) {
      const addr = XLSX.utils.encode_cell({ r, c: col });
      const cell = ws[addr];
      if (cell && typeof cell.v === "number") {
        cell.t = "n";
        cell.z = iskFmt;
      }
    }
  }

  // Header styling (note: SheetJS community build limited styling support;
  // fall back gracefully — bold/colors require pro build, but column widths
  // and number formats are honored.)
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1A2540" } }, // ide-navy
    alignment: { vertical: "center", horizontal: "left" },
  };
  for (let c = 0; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) {
      (ws[addr] as { s?: unknown }).s = headerStyle;
    }
  }

  // Column widths
  const widths = [12, 32, 28, 22, 18, 16, 14, 12, 12, 18, 16, 18, 12, 24];
  ws["!cols"] = widths.map((w) => ({ wch: w }));

  // Convert range to an Excel Table for filtering/sorting
  ws["!autofilter"] = { ref: ws["!ref"]! };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sölur");

  const filename = `IDE_Sölur_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename, { bookType: "xlsx", compression: true });
}
