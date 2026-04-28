import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { t, formatDate, formatIsk } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PO_STATUS_STYLES } from "@/lib/poConstants";
import { CreatePoDrawer } from "@/components/innkaup/CreatePoDrawer";
import { rememberDealReturnPath } from "@/lib/dealReturn";

type PORow = Database["public"]["Tables"]["purchase_orders"]["Row"];

interface Props {
  dealId: string;
  pos: PORow[];
  currentProfileId: string | null;
  onChanged: () => Promise<void>;
}

export function PurchaseOrdersSection({
  dealId,
  pos,
  currentProfileId,
  onChanged,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {t.nav.purchaseOrders} ({pos.length})
        </h2>
        <Button
          onClick={() => setDrawerOpen(true)}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          <Plus className="mr-1 h-4 w-4" />
          {t.purchaseOrder.createFromDeal}
        </Button>
      </div>

      {pos.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t.purchaseOrder.noOrdersOnDeal}
        </div>
      ) : (
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
      )}

      <CreatePoDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        fixedDealId={dealId}
        currentProfileId={currentProfileId}
        onCreated={() => void onChanged()}
        navigateOnCreate={false}
      />
    </div>
  );
}
