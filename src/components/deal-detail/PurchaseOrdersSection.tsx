import { Link } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";
import { t, formatDate, formatIsk } from "@/lib/sala_translations_is";
import { cn } from "@/lib/utils";
import { PO_STATUS_STYLES } from "@/lib/poConstants";
import { rememberDealReturnPath } from "@/lib/dealReturn";
import { TrackingCard } from "@/components/tracking/TrackingCard";

type PORow = Database["public"]["Tables"]["purchase_orders"]["Row"];

interface Props {
  dealId: string;
  pos: PORow[];
  trackingNumbers: string[];
}

/**
 * Merged "Innkaup" card shown on the deal detail page.
 *
 * Contains the PO list (top) and the tracking-numbers section (bottom).
 * The "Bæta við PO" button lives in StepperActions (the stepper action
 * row), not here — this card only appears once at least one PO exists
 * (or legacy tracking numbers are present on the deal).
 */
export function PurchaseOrdersSection({ dealId, pos, trackingNumbers }: Props) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm space-y-4">
      <div>
        <div className="mb-3 text-sm font-semibold">{t.purchaseOrder.title}</div>
        <div className="space-y-2">
          {pos.map((po) => {
            const style = PO_STATUS_STYLES[po.status];
            const total = Number(po.amount ?? 0) + Number(po.shipping_cost ?? 0);
            const totalIsk = po.exchange_rate ? total * Number(po.exchange_rate) : null;
            const isPastReceived =
              po.status === "received" || po.status === "invoiced" || po.status === "paid";

            return (
              <Link
                key={po.id}
                to="/innkaup/$id"
                params={{ id: po.id }}
                onClick={() => rememberDealReturnPath()}
                className={cn(
                  "block rounded-md border border-border p-3 text-sm transition-colors hover:brightness-95",
                  style.muted && "text-muted-foreground",
                )}
                style={{
                  borderLeft: `4px solid ${style.border}`,
                  backgroundColor: style.bg,
                }}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {po.po_number}
                  </span>
                  <span className="font-medium text-foreground">{po.supplier}</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                      style.badge,
                    )}
                  >
                    {t.poStatus[po.status]}
                  </span>
                  <span className="ml-auto text-sm font-medium text-foreground tabular-nums">
                    {totalIsk !== null ? formatIsk(totalIsk) : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isPastReceived
                      ? `${t.purchaseOrder.received_date}: ${formatDate(po.received_date) || "—"}`
                      : `${t.purchaseOrder.expected_delivery_date}: ${formatDate(po.expected_delivery_date) || "—"}`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <TrackingCard mode="deal" dealId={dealId} initial={trackingNumbers} bare />
      </div>
    </div>
  );
}
