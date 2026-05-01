import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Pencil, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatDate, formatIsk, formatNumber } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/formatters";
import { goBack } from "@/lib/dealReturn";
import { PO_STATUS_STYLES, type POStatus } from "@/lib/poConstants";
import {
  logPoPaid,
  logPoReceived,
  logPoStatusChanged,
  logPoInvoiceApproved,
  logPoInvoiceApprovalRevoked,
  logPoPaymentRevoked,
  logPoRevertedToOrdered,
} from "@/lib/poActivityLog";
import { TrackingCard } from "@/components/tracking/TrackingCard";
import { POStageStepper } from "@/components/po-detail/POStageStepper";
import { POStepperActions } from "@/components/po-detail/POStepperActions";
import { InvoiceDrawer } from "@/components/po-detail/InvoiceDrawer";
import { CreatePoDrawer } from "@/components/innkaup/CreatePoDrawer";
import {
  fetchLinkedPos,
  planSoAfterPoReceived,
  planSoAfterPoReverted,
} from "@/lib/poSoSync";

type PO = Database["public"]["Tables"]["purchase_orders"]["Row"];
type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
type PoFile = Database["public"]["Tables"]["po_files"]["Row"] & {
  signedUrl?: string | null;
};
type Activity = {
  id: string;
  type: string;
  body: string | null;
  created_at: string;
  profile: { id: string; name: string | null } | null;
};
type ProfileMini = { id: string; name: string | null };

interface Props {
  poId: string;
  currentProfileId: string;
}

export function InnkaupDetail({ poId, currentProfileId }: Props) {
  const [po, setPo] = useState<PO | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [linkedDeal, setLinkedDeal] = useState<{
    id: string;
    so_number: string;
    name: string;
    company: { id: string; name: string } | null;
  } | null>(null);
  const [files, setFiles] = useState<PoFile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editCoreOpen, setEditCoreOpen] = useState(false);
  const [invoiceDrawerOpen, setInvoiceDrawerOpen] = useState(false);
  const [confirmMarkPaid, setConfirmMarkPaid] = useState(false);
  const [confirmRevertWhileDelivered, setConfirmRevertWhileDelivered] = useState(false);
  const [logText, setLogText] = useState("");

  const load = useCallback(async () => {
    const [poRes, filesRes] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(
          `*,
           supplier_record:suppliers(*),
           deal:deals(id, so_number, name, company:companies(id, name))`,
        )
        .eq("id", poId)
        .maybeSingle(),
      supabase
        .from("po_files")
        .select("*")
        .eq("po_id", poId)
        .order("uploaded_at", { ascending: false }),
    ]);
    if (!poRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = poRes.data as PO & {
      supplier_record: Supplier | null;
      deal: typeof linkedDeal;
    };
    setPo(data);
    setSupplier(data.supplier_record);
    setLinkedDeal(data.deal ?? null);

    const rawFiles = (filesRes.data ?? []) as PoFile[];
    const filesWithUrls = await Promise.all(
      rawFiles.map(async (f) => {
        if (!f.storage_path) return { ...f, signedUrl: f.file_url ?? null };
        const { data: view } = await supabase.storage
          .from("po_files")
          .createSignedUrl(f.storage_path, 3600);
        return { ...f, signedUrl: view?.signedUrl ?? null };
      }),
    );
    setFiles(filesWithUrls);

    if (data.deal_id) {
      const { data: acts } = await supabase
        .from("activities")
        .select(
          "id, type, body, created_at, profile:profiles!activities_created_by_fkey(id, name)",
        )
        .eq("deal_id", data.deal_id)
        .like("body", `${data.po_number}%`)
        .order("created_at", { ascending: false });
      setActivities((acts ?? []) as unknown as Activity[]);
    } else {
      setActivities([]);
    }

    const profileIds = [data.invoice_registered_by, data.invoice_approved_by].filter(
      (x): x is string => Boolean(x),
    );
    if (profileIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", profileIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: ProfileMini) => {
        if (p.id) map[p.id] = p.name ?? "";
      });
      setProfileNames(map);
    } else {
      setProfileNames({});
    }
    setLoading(false);
  }, [poId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const updatePo = async (patch: Partial<PO>) => {
    if (!po) return;
    const { error } = await supabase
      .from("purchase_orders")
      .update(patch)
      .eq("id", po.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    if (
      "expected_delivery_date" in patch &&
      po.deal_id &&
      patch.expected_delivery_date !== undefined
    ) {
      await supabase
        .from("deals")
        .update({ estimated_delivery_date: patch.expected_delivery_date ?? null })
        .eq("id", po.deal_id);
    }
    await load();
  };

  const handleCancel = async () => {
    await updatePo({ status: "cancelled" });
    if (po) {
      await logPoStatusChanged({
        dealId: po.deal_id,
        poNumber: po.po_number,
        newStatus: "cancelled",
        createdBy: currentProfileId,
      });
    }
  };

  const handleReactivate = async () => {
    await updatePo({ status: "ordered" });
    if (po) {
      await logPoStatusChanged({
        dealId: po.deal_id,
        poNumber: po.po_number,
        newStatus: "ordered",
        createdBy: currentProfileId,
      });
    }
  };

  const today = () => new Date().toISOString().split("T")[0];

  const handleMarkReceived = async () => {
    if (!po) return;
    const d = today();
    await updatePo({ received_date: d, status: "received" });
    await logPoReceived({
      dealId: po.deal_id,
      poNumber: po.po_number,
      receivedDate: d,
      createdBy: currentProfileId,
    });
    if (po.deal_id) {
      const { data: dealRow } = await supabase
        .from("deals")
        .select("stage")
        .eq("id", po.deal_id)
        .maybeSingle();
      if (dealRow?.stage) {
        const linked = await fetchLinkedPos(supabase, po.deal_id);
        const adjusted = linked.map((p) =>
          p.id === po.id ? { ...p, received_date: d, status: "received" as const } : p,
        );
        const plan = planSoAfterPoReceived(dealRow.stage, adjusted);
        if (plan.action === "advance") {
          await supabase
            .from("deals")
            .update({ stage: "ready_for_pickup" })
            .eq("id", po.deal_id);
          await supabase.from("activities").insert({
            deal_id: po.deal_id,
            type: "stage_change",
            body: "ready_for_pickup",
            created_by: currentProfileId,
          });
        } else if (plan.action === "wait" && plan.outstanding) {
          toast.info(
            t.purchaseOrder.awaitingOtherPos.replace("{count}", String(plan.outstanding)),
          );
        }
      }
    }
  };

  const handleApproveInvoice = async () => {
    if (!po) return;
    await updatePo({
      invoice_approved_at: new Date().toISOString(),
      invoice_approved_by: currentProfileId,
    });
    await logPoInvoiceApproved({
      dealId: po.deal_id,
      poNumber: po.po_number,
      createdBy: currentProfileId,
    });
  };

  const handleMarkPaid = async () => {
    if (!po) return;
    const d = today();
    await updatePo({ paid_date: d, status: "paid" });
    await logPoPaid({
      dealId: po.deal_id,
      poNumber: po.po_number,
      paidDate: d,
      createdBy: currentProfileId,
    });
    setConfirmMarkPaid(false);
  };

  const handleRevertApproval = async () => {
    if (!po) return;
    await updatePo({ invoice_approved_at: null, invoice_approved_by: null });
    await logPoInvoiceApprovalRevoked({
      dealId: po.deal_id,
      poNumber: po.po_number,
      createdBy: currentProfileId,
    });
  };

  const handleRevertToMottekid = async () => {
    if (!po) return;
    await updatePo({ paid_date: null, status: "received" });
    await logPoPaymentRevoked({
      dealId: po.deal_id,
      poNumber: po.po_number,
      createdBy: currentProfileId,
    });
  };

  const performRevertToPantad = async () => {
    if (!po) return;
    await updatePo({
      received_date: null,
      paid_date: null,
      invoice_received_date: null,
      supplier_invoice_number: null,
      supplier_invoice_amount: null,
      invoice_approved_at: null,
      invoice_approved_by: null,
      invoice_registered_by: null,
      status: "ordered",
    });
    await logPoRevertedToOrdered({
      dealId: po.deal_id,
      poNumber: po.po_number,
      createdBy: currentProfileId,
    });
    if (po.deal_id) {
      const { data: dealRow } = await supabase
        .from("deals")
        .select("stage")
        .eq("id", po.deal_id)
        .maybeSingle();
      if (dealRow?.stage === "ready_for_pickup") {
        await supabase
          .from("deals")
          .update({ stage: "order_confirmed" })
          .eq("id", po.deal_id);
        await supabase.from("activities").insert({
          deal_id: po.deal_id,
          type: "stage_change",
          body: "order_confirmed",
          created_by: currentProfileId,
        });
      }
    }
  };

  const handleRevertToPantad = async () => {
    if (!po) return;
    if (po.deal_id) {
      const { data: dealRow } = await supabase
        .from("deals")
        .select("stage")
        .eq("id", po.deal_id)
        .maybeSingle();
      const plan = planSoAfterPoReverted(dealRow?.stage ?? "inquiry");
      if (plan.action === "confirmDeliveredKept") {
        setConfirmRevertWhileDelivered(true);
        return;
      }
    }
    await performRevertToPantad();
  };

  const submitLog = async () => {
    const body = logText.trim();
    if (!body || !po?.deal_id) return;
    await supabase.from("activities").insert({
      deal_id: po.deal_id,
      type: "note",
      body: `${po.po_number}: ${body}`,
      created_by: currentProfileId,
    });
    setLogText("");
    await load();
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        {t.status.loading}
      </div>
    );
  }
  if (notFound || !po) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">{t.status.noResults}</p>
      </div>
    );
  }

  const supplierName = supplier?.name ?? po.supplier;
  const exchangeRate = po.exchange_rate ? Number(po.exchange_rate) : null;
  const amountIsk = exchangeRate ? Number(po.amount ?? 0) * exchangeRate : null;
  const shippingIsk = exchangeRate ? Number(po.shipping_cost ?? 0) * exchangeRate : null;
  const totalOriginal = Number(po.amount ?? 0) + Number(po.shipping_cost ?? 0);
  const totalIsk = exchangeRate ? totalOriginal * exchangeRate : null;

  const orderConfirmFile = files.find((f) => f.file_type === "order_confirmation");
  const invoiceFile = files.find((f) => f.file_type === "invoice");

  // Derive financial panel left-border color from /innkaup status palette.
  let panelStatus: POStatus;
  if (po.paid_date) panelStatus = "paid";
  else if (po.invoice_approved_at) panelStatus = "invoiced"; // approved → blue family
  else if (po.invoice_received_date) panelStatus = "received"; // amber (pending)
  else panelStatus = "ordered"; // neutral
  const panelBorderColor =
    panelStatus === "ordered" ? "#9ca3af" : PO_STATUS_STYLES[panelStatus].border;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => goBack("/innkaup")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.actions.back}
      </button>

      {/* Stepper */}
      <POStageStepper
        po={po}
        hasTracking={(po.tracking_numbers ?? []).length > 0}
        onRevertToPantad={() => void handleRevertToPantad()}
        onRevertToMottekid={() => void handleRevertToMottekid()}
        onRevertApproval={() => void handleRevertApproval()}
        onRevertPayment={() => void handleRevertToMottekid()}
        onCancel={() => void handleCancel()}
        onReactivate={() => void handleReactivate()}
      />

      {/* Header card — display-only dates */}
      <div className="rounded-md border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="font-mono text-xs text-muted-foreground">
              {po.po_number}
            </div>
            <h1 className="text-2xl font-semibold md:text-3xl">{supplierName}</h1>
            {po.supplier_reference && (
              <div className="text-sm text-muted-foreground">
                {t.purchaseOrder.supplier_reference}: {po.supplier_reference}
              </div>
            )}
            <div className="pt-1">
              <span className="text-xs text-muted-foreground">
                {t.purchaseOrder.linked_deal}:{" "}
              </span>
              {linkedDeal ? (
                <Link
                  to="/deals/$id"
                  params={{ id: linkedDeal.id }}
                  className="text-sm font-medium text-ide-navy hover:underline"
                >
                  {linkedDeal.so_number} — {linkedDeal.name}
                  {linkedDeal.company && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {linkedDeal.company.name}
                    </span>
                  )}
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5 text-sm md:text-right">
            <div>
              <span className="text-muted-foreground">
                {t.purchaseOrder.order_date}:{" "}
              </span>
              <span className="font-medium">
                {po.order_date ? formatDate(po.order_date) : "—"}
              </span>
            </div>
            {po.expected_delivery_date && (
              <div>
                <span className="text-muted-foreground">
                  {t.purchaseOrder.expected_delivery_date}:{" "}
                </span>
                <span className="font-medium">
                  {formatDate(po.expected_delivery_date)}
                </span>
              </div>
            )}
            {po.received_date && (
              <div>
                <span className="text-muted-foreground">
                  {t.purchaseOrder.received_date}:{" "}
                </span>
                <span className="font-medium">{formatDate(po.received_date)}</span>
              </div>
            )}
            {po.paid_date && (
              <div>
                <span className="text-muted-foreground">
                  {t.purchaseOrder.paid_date}:{" "}
                </span>
                <span className="font-medium">{formatDate(po.paid_date)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tracking card */}
      <TrackingCard
        mode="po"
        poId={po.id}
        dealId={po.deal_id}
        initial={(po.tracking_numbers ?? []) as string[]}
      />

      {/* Financial panel (no title, status-colored left border) */}
      <div
        className="rounded-md border border-border bg-card p-6 shadow-sm"
        style={{ borderLeft: `4px solid ${panelBorderColor}` }}
      >
        {/* Top: PO amount summary */}
        <div className="flex items-start justify-between gap-3">
          <div className="grid flex-1 gap-2 text-sm sm:grid-cols-2">
            <Row label={t.purchaseOrder.currency} value={po.currency} />
            <Row
              label={t.purchaseOrder.exchange_rate}
              value={exchangeRate != null ? formatNumber(exchangeRate, 4) : "—"}
            />
            <Row
              label={t.purchaseOrder.amount}
              value={`${po.currency} ${formatNumber(Number(po.amount ?? 0), 2)}${
                amountIsk != null ? ` · ${formatIsk(amountIsk)}` : ""
              }`}
            />
            <Row
              label={t.purchaseOrder.shipping_cost}
              value={`${po.currency} ${formatNumber(Number(po.shipping_cost ?? 0), 2)}${
                shippingIsk != null ? ` · ${formatIsk(shippingIsk)}` : ""
              }`}
            />
            <div className="sm:col-span-2 border-t border-border pt-2">
              <Row
                label={t.purchaseOrder.total_amount}
                value={totalIsk != null ? formatIsk(totalIsk) : "—"}
                bold
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditCoreOpen(true)}
            className="shrink-0"
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {t.actions.edit}
          </Button>
        </div>

        {/* Order confirmation file card */}
        {orderConfirmFile && (
          <div className="mt-4">
            <FileCardSmall
              file={orderConfirmFile}
              label={t.purchaseOrder.fileTypeOrderConfirm}
            />
          </div>
        )}

        {/* Invoice subsection */}
        {po.invoice_received_date && (
          <div className="mt-6 border-t border-border pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-2 text-sm sm:grid-cols-2">
                <Row
                  label={t.purchaseOrder.supplier_invoice_number}
                  value={po.supplier_invoice_number ?? "—"}
                />
                <Row
                  label={t.purchaseOrder.supplier_invoice_amount}
                  value={
                    po.supplier_invoice_amount != null
                      ? `${po.currency} ${formatNumber(Number(po.supplier_invoice_amount), 2)}${
                          exchangeRate
                            ? ` · ${formatIsk(Number(po.supplier_invoice_amount) * exchangeRate)}`
                            : ""
                        }`
                      : "—"
                  }
                />
                <Row
                  label={t.purchaseOrder.invoice_received_date}
                  value={formatDate(po.invoice_received_date)}
                />
                <Row
                  label={t.purchaseOrder.paid_date}
                  value={po.paid_date ? formatDate(po.paid_date) : "—"}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInvoiceDrawerOpen(true)}
                className="shrink-0"
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {t.actions.edit}
              </Button>
            </div>

            {invoiceFile && (
              <div className="mt-4">
                <FileCardSmall
                  file={invoiceFile}
                  label={t.purchaseOrder.fileTypeInvoice}
                />
              </div>
            )}

            {/* Footer metadata strip */}
            {(po.invoice_registered_by || po.invoice_approved_at) && (
              <div className="mt-4 text-xs text-muted-foreground">
                {po.invoice_registered_by && (
                  <>
                    {t.purchaseOrder.registeredBy}{" "}
                    {profileNames[po.invoice_registered_by] || "—"} ·{" "}
                    {formatDate(po.invoice_received_date)}
                  </>
                )}
                {po.invoice_approved_at && (
                  <>
                    {" · "}
                    {t.purchaseOrder.approvedBy}{" "}
                    {profileNames[po.invoice_approved_by ?? ""] || "—"} ·{" "}
                    {formatDate(po.invoice_approved_at)}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons (no card wrapper) */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <POStepperActions
          po={po}
          onMarkReceived={() => void handleMarkReceived()}
          onOpenInvoiceDrawer={() => setInvoiceDrawerOpen(true)}
          onApproveInvoice={() => void handleApproveInvoice()}
          onMarkPaid={() => setConfirmMarkPaid(true)}
        />
      </div>

      {/* Log */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Log</h2>
        {po.deal_id ? (
          <div className="rounded-md border border-border bg-card p-3">
            <Textarea
              rows={2}
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              placeholder={t.log.placeholder}
              className="resize-none"
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                disabled={!logText.trim()}
                onClick={() => void submitLog()}
                className="bg-ide-navy text-white hover:bg-ide-navy-hover"
              >
                {t.log.send}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
            {t.purchaseOrder.noDeal}
          </div>
        )}
        {activities.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t.log.noEntries}
          </div>
        ) : (
          <ul className="space-y-2">
            {activities.map((a) => (
              <li
                key={a.id}
                className="rounded-md border border-border bg-card p-3 text-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{a.profile?.name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(a.created_at)}
                  </span>
                </div>
                {a.body && (
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{a.body}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirm mark-as-paid */}
      <AlertDialog open={confirmMarkPaid} onOpenChange={setConfirmMarkPaid}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.purchaseOrder.confirmMarkPaid}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.purchaseOrder.actionMarkPaid}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleMarkPaid()}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {t.actions.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: revert PO while SO is delivered */}
      <AlertDialog
        open={confirmRevertWhileDelivered}
        onOpenChange={setConfirmRevertWhileDelivered}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.purchaseOrder.revertPoFromDeliveredSoTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.purchaseOrder.revertPoFromDeliveredSoBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmRevertWhileDelivered(false);
                await performRevertToPantad();
              }}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {t.actions.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice register/edit drawer */}
      <InvoiceDrawer
        open={invoiceDrawerOpen}
        onOpenChange={setInvoiceDrawerOpen}
        po={po}
        currentProfileId={currentProfileId}
        onSaved={() => void load()}
      />

      {/* Edit PO core fields drawer */}
      <CreatePoDrawer
        open={editCoreOpen}
        onOpenChange={setEditCoreOpen}
        currentProfileId={currentProfileId}
        editPo={po}
        onCreated={() => void load()}
      />
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums text-right",
          bold && "font-bold text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function FileCardSmall({ file, label }: { file: PoFile; label: string }) {
  const href = file.signedUrl ?? file.file_url ?? "#";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-md border border-border bg-muted/20 p-3 text-sm transition-colors hover:bg-muted/40"
    >
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {file.original_filename ?? "—"}
        </div>
        <div className="text-xs text-muted-foreground">
          {label} · {formatFileSize(file.file_size_bytes)}
        </div>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
    </a>
  );
}
