import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatIsk } from "@/lib/sala_translations_is";
import { formatKennitala } from "@/lib/formatters";
import { formatSizeBreakdown, type SizeBreakdown } from "@/lib/sizeBreakdown";
import ideLogoUrl from "@/assets/ide-house-of-brands-logo.png";

const NAVY: [number, number, number] = [26, 37, 64];

export interface QuoteCompany {
  name: string;
  kennitala: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  postcode?: string | null;
  city?: string | null;
}

export interface QuoteContact {
  first_name: string | null;
  last_name: string | null;
}

export interface QuoteLine {
  product_name: string;
  description?: string | null;
  quantity: number;
  unit_price_isk: number;
  line_total_isk: number;
  size_breakdown?: SizeBreakdown | null;
}

export interface QuoteSender {
  name: string | null;
  email: string;
}

export interface QuoteData {
  quoteNumber: string;        // e.g. SO-147502-1
  soNumber: string;
  dealName: string;
  validUntil: Date;
  note: string;
  company: QuoteCompany;
  contact: QuoteContact | null;
  lines: QuoteLine[];
  totalPriceIsk: number;
  sender: QuoteSender;
}

function formatDayMonthYear(d: Date): string {
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Generates the IDÉ quote PDF and returns it as ArrayBuffer.
 */
export async function generateQuotePdf(data: QuoteData): Promise<ArrayBuffer> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const margin = 15;

  // --- Header: logo left, company info right ---
  // Logo aspect ratio is ~16:9 (1280x720). 36mm wide → ~20mm tall.
  const logoData = await loadImageAsDataUrl(ideLogoUrl);
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", margin, 10, 36, 20);
    } catch {
      /* ignore image errors */
    }
  }

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const headerLines = [
    "IDÉ House of Brands Iceland ehf.",
    "Turnahvarfi 6B, 203 Kópavogi",
    "Sími: +354 497 0319",
    "kt. 670319-0750",
  ];
  headerLines.forEach((line, i) => {
    doc.text(line, pageW - margin, 14 + i * 4.5, { align: "right" });
  });

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, 34, pageW - margin, 34);

  // --- Customer block (left) + quote metadata (right) ---
  let y = 42;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.company.name, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const addrLines: string[] = [];
  if (data.company.address_line_1) addrLines.push(data.company.address_line_1);
  if (data.company.address_line_2) addrLines.push(data.company.address_line_2);
  const cityLine = [data.company.postcode, data.company.city].filter(Boolean).join(" ");
  if (cityLine) addrLines.push(cityLine);
  if (data.company.kennitala) addrLines.push(`kt. ${formatKennitala(data.company.kennitala)}`);
  if (data.contact && (data.contact.first_name || data.contact.last_name)) {
    const full = `${data.contact.first_name ?? ""} ${data.contact.last_name ?? ""}`.trim();
    if (full) addrLines.push(`Tengiliður: ${full}`);
  }

  let cy = y + 5;
  addrLines.forEach((line) => {
    doc.text(line, margin, cy);
    cy += 4.5;
  });

  // Right metadata block
  const metaX = pageW - margin;
  const metaLabelX = pageW - margin - 55;
  doc.setFontSize(10);
  const meta: Array<[string, string]> = [
    ["Tilboð nr.", data.quoteNumber],
    ["Viðskiptanúmer", (data.company.kennitala ?? "").replace(/\D/g, "") || "—"],
    ["Gildir til", formatDayMonthYear(data.validUntil)],
    ["Tilvísun/verk", data.dealName],
  ];
  let my = y;
  meta.forEach(([label, val]) => {
    doc.setTextColor(100, 100, 100);
    doc.text(label, metaLabelX, my);
    doc.setTextColor(20, 20, 20);
    doc.text(val, metaX, my, { align: "right" });
    my += 5;
  });

  const tableStartY = Math.max(cy, my) + 8;

  // --- Line items table ---
  const body = data.lines.map((l) => {
    const unitWithVat = Math.round(l.unit_price_isk * 1.24);
    const totalWithVat = Math.round(l.line_total_isk * 1.24);
    let descCell = l.product_name;
    if (l.description) descCell += `\n${l.description}`;
    if (l.size_breakdown) {
      descCell += `\nSundurliðun: ${formatSizeBreakdown(l.size_breakdown)}`;
    }
    return [
      descCell,
      String(l.quantity),
      formatIsk(l.unit_price_isk),
      formatIsk(unitWithVat),
      "24%",
      formatIsk(l.line_total_isk),
      formatIsk(totalWithVat),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [[
      "Lýsing",
      "Magn",
      "Verð án VSK",
      "Verð m. VSK",
      "VSK",
      "Samtals án VSK",
      "Samtals m. VSK",
    ]],
    body,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [240, 240, 243],
      textColor: NAVY,
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    bodyStyles: { fontSize: 9, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 12, halign: "right" },
      2: { cellWidth: 22, halign: "right" },
      3: { cellWidth: 22, halign: "right" },
      4: { cellWidth: 12, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
      6: { cellWidth: 26, halign: "right" },
    },
  });

  // @ts-expect-error lastAutoTable injected by plugin
  let yAfter = (doc.lastAutoTable?.finalY ?? tableStartY) + 6;

  // --- Totals block (right-aligned) ---
  const vat = Math.round(data.totalPriceIsk * 0.24);
  const totalIncVat = Math.round(data.totalPriceIsk * 1.24);
  const totals: Array<[string, string, boolean]> = [
    ["Samtals án VSK", formatIsk(data.totalPriceIsk), false],
    ["VSK (24%)", formatIsk(vat), false],
    ["Samtals með VSK", formatIsk(totalIncVat), true],
  ];
  doc.setFontSize(10);
  totals.forEach(([label, val, bold]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, pageW - margin - 45, yAfter, { align: "right" });
    doc.text(val, pageW - margin, yAfter, { align: "right" });
    yAfter += 5.5;
  });
  doc.setFont("helvetica", "normal");

  yAfter += 4;

  // --- Note block ---
  if (data.note.trim()) {
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const wrapped = doc.splitTextToSize(data.note.trim(), pageW - margin * 2);
    doc.text(wrapped, margin, yAfter);
    yAfter += wrapped.length * 5 + 4;
  }

  // --- VAT breakdown footer ---
  yAfter += 4;
  if (yAfter > pageH - 50) yAfter = pageH - 50;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Sundurliðun VSK upphæðar", margin, yAfter);
  yAfter += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, yAfter, margin + 90, yAfter);
  yAfter += 4;
  doc.setTextColor(30, 30, 30);
  doc.text("VSK 24%", margin, yAfter);
  doc.text(formatIsk(data.totalPriceIsk), margin + 40, yAfter, { align: "right" });
  doc.text(formatIsk(vat), margin + 80, yAfter, { align: "right" });

  // --- Sender block (bottom) ---
  const senderY = pageH - 28;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, senderY - 4, pageW - margin, senderY - 4);
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text(data.sender.name ?? data.sender.email, margin, senderY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(data.sender.email, margin, senderY + 5);

  // --- Quote number footer (bottom-right, large muted) ---
  doc.setFontSize(18);
  doc.setTextColor(200, 200, 205);
  doc.text(data.quoteNumber, pageW - margin, pageH - 10, { align: "right" });

  return doc.output("arraybuffer");
}
