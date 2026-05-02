import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/sala_translations_is";
import { formatDate } from "@/lib/sala_translations_is";
import type { POStatus } from "./poConstants";

type LogPoPrefix = "Innkaup" | "Reikningur";

interface LogPoActivityArgs {
  dealId: string | null | undefined;
  companyId?: string | null | undefined;
  poNumber: string;
  body: string;
  createdBy: string | null;
  prefix?: LogPoPrefix;
}

/**
 * Insert a note activity onto the linked deal so PO actions show in the deal log.
 * No-op when there is no linked deal.
 *
 * Body format: "{prefix} · {PO#}: {body}"  (default prefix = "Innkaup")
 */
async function logPoActivity({
  dealId,
  companyId,
  poNumber,
  body,
  createdBy,
  prefix = "Innkaup",
}: LogPoActivityArgs) {
  if (!dealId) return;
  let resolvedCompanyId = companyId ?? null;
  if (!resolvedCompanyId) {
    const { data } = await supabase
      .from("deals")
      .select("company_id")
      .eq("id", dealId)
      .maybeSingle();
    resolvedCompanyId = data?.company_id ?? null;
  }
  await supabase.from("activities").insert({
    deal_id: dealId,
    company_id: resolvedCompanyId,
    type: "note",
    body: `${prefix} · ${poNumber}: ${body}`,
    created_by: createdBy,
  });
}

export async function logPoCreated(opts: {
  dealId: string | null;
  poNumber: string;
  supplierName: string;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    body: `stofnað hjá ${opts.supplierName}`,
    createdBy: opts.createdBy,
  });
}

export async function logPoStatusChanged(opts: {
  dealId: string | null;
  poNumber: string;
  newStatus: POStatus;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    body: `Staða færð í ${t.poStatus[opts.newStatus]}`,
    createdBy: opts.createdBy,
  });
}

export async function logPoReceived(opts: {
  dealId: string | null;
  poNumber: string;
  receivedDate: string;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    body: `móttekið ${formatDate(opts.receivedDate)}`,
    createdBy: opts.createdBy,
  });
}

export async function logPoPaid(opts: {
  dealId: string | null;
  poNumber: string;
  paidDate: string;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    prefix: "Reikningur",
    body: `greitt ${formatDate(opts.paidDate)}`,
    createdBy: opts.createdBy,
  });
}

export async function logPoInvoiceRegistered(opts: {
  dealId: string | null;
  poNumber: string;
  invoiceNumber: string | null;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    prefix: "Reikningur",
    body: `skráður${opts.invoiceNumber ? ` (${opts.invoiceNumber})` : ""}`,
    createdBy: opts.createdBy,
  });
}

export async function logPoInvoiceEdited(opts: {
  dealId: string | null;
  poNumber: string;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    prefix: "Reikningur",
    body: `uppfærður`,
    createdBy: opts.createdBy,
  });
}

export async function logPoInvoiceApproved(opts: {
  dealId: string | null;
  poNumber: string;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    prefix: "Reikningur",
    body: `samþykktur`,
    createdBy: opts.createdBy,
  });
}

export async function logPoInvoiceApprovalRevoked(opts: {
  dealId: string | null;
  poNumber: string;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    prefix: "Reikningur",
    body: `samþykki afturkallað`,
    createdBy: opts.createdBy,
  });
}

export async function logPoPaymentRevoked(opts: {
  dealId: string | null;
  poNumber: string;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    prefix: "Reikningur",
    body: `greiðsla afturkölluð`,
    createdBy: opts.createdBy,
  });
}

export async function logPoRevertedToOrdered(opts: {
  dealId: string | null;
  poNumber: string;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    body: `endursett í pöntunarstöðu`,
    createdBy: opts.createdBy,
  });
}

export async function logPoDeliveredToCustomer(opts: {
  dealId: string | null;
  poNumber: string;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    body: `sala afhent`,
    createdBy: opts.createdBy,
  });
}

export async function logPoLinesEdited(opts: {
  dealId: string | null;
  poNumber: string;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    body: `línur uppfærðar`,
    createdBy: opts.createdBy,
  });
}

export async function logPoExchangeRateEdited(opts: {
  dealId: string | null;
  poNumber: string;
  newRate: number;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    body: `gengi uppfært í ${opts.newRate}`,
    createdBy: opts.createdBy,
  });
}

export async function logPoDeleted(opts: {
  dealId: string | null;
  poNumber: string;
  createdBy: string | null;
}) {
  await logPoActivity({
    dealId: opts.dealId,
    poNumber: opts.poNumber,
    body: `pöntun eytt`,
    createdBy: opts.createdBy,
  });
}

