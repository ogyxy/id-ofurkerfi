import type { Database } from "@/integrations/supabase/types";

export type POStatus = Database["public"]["Enums"]["po_status"];

export const HAPPY_PATH_PO_STATUSES: POStatus[] = [
  "ordered",
  "received",
  "invoiced",
  "paid",
];

export const ALL_PO_STATUSES: POStatus[] = [
  ...HAPPY_PATH_PO_STATUSES,
  "cancelled",
];

export const PO_CURRENCIES = [
  "EUR",
  "GBP",
  "USD",
  "NOK",
  "DKK",
  "SEK",
  "CHF",
] as const;

export type PoFileType =
  | "proof"
  | "order_confirmation"
  | "invoice"
  | "artwork"
  | "other";

export const PO_FILE_TYPES: PoFileType[] = [
  "proof",
  "order_confirmation",
  "invoice",
  "artwork",
  "other",
];

// status visual style — left border + soft background tint
export const PO_STATUS_STYLES: Record<
  POStatus,
  { border: string; bg: string; muted: boolean; badge: string }
> = {
  ordered: {
    border: "#1a2540",
    bg: "#eff6ff",
    muted: false,
    badge: "bg-blue-100 text-blue-900 border-blue-300",
  },
  received: {
    border: "#f59e0b",
    bg: "#fffbeb",
    muted: false,
    badge: "bg-amber-100 text-amber-900 border-amber-300",
  },
  invoiced: {
    border: "#6366f1",
    bg: "#eef2ff",
    muted: false,
    badge: "bg-indigo-100 text-indigo-900 border-indigo-300",
  },
  paid: {
    border: "#22c55e",
    bg: "#f0fdf4",
    muted: true,
    badge: "bg-green-100 text-green-900 border-green-300",
  },
  cancelled: {
    border: "#9ca3af",
    bg: "#f9fafb",
    muted: true,
    badge: "bg-gray-100 text-gray-700 border-gray-300",
  },
};

export function poFileTypeLabel(
  t: typeof import("@/lib/sala_translations_is").t,
  type: PoFileType,
): string {
  switch (type) {
    case "proof":
      return t.purchaseOrder.fileTypeProof;
    case "order_confirmation":
      return t.purchaseOrder.fileTypeOrderConfirm;
    case "invoice":
      return t.purchaseOrder.fileTypeInvoice;
    case "artwork":
      return t.purchaseOrder.fileTypeArtwork;
    default:
      return t.purchaseOrder.fileTypeOther;
  }
}
