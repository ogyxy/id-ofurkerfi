// =============================================================================
// SO ↔ PO sync utilities
// =============================================================================
// Tracking numbers and "goods received" status are conceptually shared between
// a sales order (deal) and its linked purchase orders. Both tables hold their
// own tracking_numbers arrays (denormalized) — this module keeps them in sync
// and centralizes the rules for advancing/reverting the SO based on PO state.
//
// All functions take a Supabase client so they can be used from any caller.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DealStage = Database["public"]["Enums"]["deal_stage"];
type POStatus = Database["public"]["Enums"]["po_status"];

export type LinkedPo = {
  id: string;
  po_number: string;
  status: POStatus;
  received_date: string | null;
  tracking_numbers: string[];
  supplier: string | null;
  supplier_record: { name: string } | null;
};

// ----------------------------------------------------------------------------
// Reads
// ----------------------------------------------------------------------------

export async function fetchLinkedPos(
  supabase: SupabaseClient<Database>,
  dealId: string,
): Promise<LinkedPo[]> {
  const { data } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status, received_date, tracking_numbers")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });
  return (data ?? []) as LinkedPo[];
}

// ----------------------------------------------------------------------------
// Tracking number sync
// ----------------------------------------------------------------------------

/**
 * Validate a candidate tracking number against the SO's other linked POs.
 * Returns the PO number where it already exists (for the inline error), or null.
 */
export function findDuplicateTrackingPo(
  pos: LinkedPo[],
  candidate: string,
  excludePoId?: string,
): string | null {
  const v = candidate.trim();
  if (!v) return null;
  for (const po of pos) {
    if (excludePoId && po.id === excludePoId) continue;
    if ((po.tracking_numbers ?? []).includes(v)) return po.po_number;
  }
  return null;
}

/**
 * Add a tracking number to a specific PO and the linked SO (union).
 * Caller is responsible for any uniqueness validation beforehand.
 */
export async function addTrackingNumber(
  supabase: SupabaseClient<Database>,
  args: { dealId: string; poId: string; tracking: string },
): Promise<{ error: string | null }> {
  const v = args.tracking.trim();
  if (!v) return { error: null };

  // Read both sides
  const [poRes, dealRes] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("tracking_numbers")
      .eq("id", args.poId)
      .maybeSingle(),
    supabase
      .from("deals")
      .select("tracking_numbers")
      .eq("id", args.dealId)
      .maybeSingle(),
  ]);

  const poTags = (poRes.data?.tracking_numbers ?? []) as string[];
  const dealTags = (dealRes.data?.tracking_numbers ?? []) as string[];

  const nextPo = poTags.includes(v) ? poTags : [...poTags, v];
  const nextDeal = dealTags.includes(v) ? dealTags : [...dealTags, v];

  const [poUpd, dealUpd] = await Promise.all([
    nextPo === poTags
      ? Promise.resolve({ error: null })
      : supabase
          .from("purchase_orders")
          .update({ tracking_numbers: nextPo })
          .eq("id", args.poId),
    nextDeal === dealTags
      ? Promise.resolve({ error: null })
      : supabase
          .from("deals")
          .update({ tracking_numbers: nextDeal })
          .eq("id", args.dealId),
  ]);

  const err = (poUpd as { error: unknown }).error || (dealUpd as { error: unknown }).error;
  return { error: err ? String(err) : null };
}

/**
 * Remove a tracking number from one side. Also remove from the *other* side
 * (the SO if removed from a PO; all matching PO(s) under the SO if removed
 * from the SO).
 */
export async function removeTrackingNumber(
  supabase: SupabaseClient<Database>,
  args:
    | { source: "po"; poId: string; dealId: string; tracking: string }
    | { source: "so"; dealId: string; tracking: string },
): Promise<{ error: string | null }> {
  const v = args.tracking.trim();
  if (!v) return { error: null };

  if (args.source === "po") {
    // Remove from this PO
    const { data: po } = await supabase
      .from("purchase_orders")
      .select("tracking_numbers")
      .eq("id", args.poId)
      .maybeSingle();
    const poTags = (po?.tracking_numbers ?? []) as string[];
    const nextPo = poTags.filter((x) => x !== v);
    if (nextPo.length !== poTags.length) {
      await supabase
        .from("purchase_orders")
        .update({ tracking_numbers: nextPo })
        .eq("id", args.poId);
    }
    // Remove from SO too
    const { data: deal } = await supabase
      .from("deals")
      .select("tracking_numbers")
      .eq("id", args.dealId)
      .maybeSingle();
    const dealTags = (deal?.tracking_numbers ?? []) as string[];
    const nextDeal = dealTags.filter((x) => x !== v);
    if (nextDeal.length !== dealTags.length) {
      await supabase
        .from("deals")
        .update({ tracking_numbers: nextDeal })
        .eq("id", args.dealId);
    }
    return { error: null };
  }

  // source === "so": remove from SO and from any PO that has it
  const [dealRes, posRes] = await Promise.all([
    supabase
      .from("deals")
      .select("tracking_numbers")
      .eq("id", args.dealId)
      .maybeSingle(),
    supabase
      .from("purchase_orders")
      .select("id, tracking_numbers")
      .eq("deal_id", args.dealId),
  ]);
  const dealTags = (dealRes.data?.tracking_numbers ?? []) as string[];
  const nextDeal = dealTags.filter((x) => x !== v);
  if (nextDeal.length !== dealTags.length) {
    await supabase
      .from("deals")
      .update({ tracking_numbers: nextDeal })
      .eq("id", args.dealId);
  }
  for (const po of posRes.data ?? []) {
    const tags = (po.tracking_numbers ?? []) as string[];
    if (tags.includes(v)) {
      await supabase
        .from("purchase_orders")
        .update({ tracking_numbers: tags.filter((x) => x !== v) })
        .eq("id", po.id);
    }
  }
  return { error: null };
}

// ----------------------------------------------------------------------------
// Status sync
// ----------------------------------------------------------------------------

/** Non-cancelled POs only — those count for "all received" logic. */
export function activePos(pos: LinkedPo[]): LinkedPo[] {
  return pos.filter((p) => p.status !== "cancelled");
}

/** PO is past Pantað if it has a received_date (Móttekið or Greitt). */
export function isPoReceived(po: LinkedPo): boolean {
  return Boolean(po.received_date);
}

/**
 * After marking one PO received, decide what to do with the SO.
 * Returns one of: { action: "advance" } | { action: "wait", outstanding: number } | { action: "noop" }.
 */
export function planSoAfterPoReceived(
  currentSoStage: DealStage,
  posIncludingThis: LinkedPo[],
): { action: "advance" | "wait" | "noop"; outstanding?: number } {
  if (currentSoStage !== "order_confirmed") return { action: "noop" };
  const active = activePos(posIncludingThis);
  if (active.length === 0) return { action: "noop" };
  const outstanding = active.filter((p) => !isPoReceived(p)).length;
  if (outstanding === 0) return { action: "advance" };
  return { action: "wait", outstanding };
}

/**
 * After reverting one PO from Móttekið → Pantað, decide what to do with the SO.
 * - If SO at ready_for_pickup → revert to order_confirmed.
 * - If SO at delivered → caller must show confirmation; we just signal.
 * - Otherwise → noop.
 */
export function planSoAfterPoReverted(
  currentSoStage: DealStage,
):
  | { action: "revert" }
  | { action: "confirmDeliveredKept" }
  | { action: "noop" } {
  if (currentSoStage === "ready_for_pickup") return { action: "revert" };
  if (currentSoStage === "delivered") return { action: "confirmDeliveredKept" };
  return { action: "noop" };
}

/**
 * When a user clicks "Vörur komnar í hús" on the SO, decide what to do.
 * - 0 active POs → advance directly.
 * - 1 active PO → silently cascade-receive that PO and advance.
 * - 2+ active POs with outstanding → confirm cascade with the user.
 * - 2+ active POs all already received → advance directly.
 */
export function planSoMarkArrived(
  pos: LinkedPo[],
):
  | { action: "advance" }
  | { action: "cascadeSilent"; outstanding: LinkedPo[] }
  | { action: "confirmCascade"; outstanding: LinkedPo[]; total: number } {
  const active = activePos(pos);
  if (active.length === 0) return { action: "advance" };
  const outstanding = active.filter((p) => !isPoReceived(p));
  if (outstanding.length === 0) return { action: "advance" };
  if (active.length === 1) return { action: "cascadeSilent", outstanding };
  return { action: "confirmCascade", outstanding, total: active.length };
}
