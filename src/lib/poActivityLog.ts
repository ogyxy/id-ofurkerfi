import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/sala_translations_is";
import { formatDate } from "@/lib/sala_translations_is";
import type { POStatus } from "./poConstants";

interface LogPoActivityArgs {
  dealId: string | null | undefined;
  companyId?: string | null | undefined;
  poNumber: string;
  body: string;
  createdBy: string | null;
}

/**
 * Insert a note activity onto the linked deal so PO actions show in the deal log.
 * No-op when there is no linked deal.
 */
async function logPoActivity({
  dealId,
  companyId,
  poNumber,
  body,
  createdBy,
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
    body: `${poNumber}: ${body}`,
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
    body: `greitt ${formatDate(opts.paidDate)}`,
    createdBy: opts.createdBy,
  });
}
