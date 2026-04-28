import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatIsk } from "@/lib/sala_translations_is";
import { rememberDealReturnPath } from "@/lib/dealReturn";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type DealStage = Database["public"]["Enums"]["deal_stage"];
type DefectResolution = Database["public"]["Enums"]["defect_resolution"];

type ChildDeal = {
  id: string;
  so_number: string;
  name: string;
  stage: DealStage;
};

const RESOLUTIONS: DefectResolution[] = [
  "pending",
  "reorder",
  "refund",
  "credit_note",
  "resolved",
];

const STAGE_BADGE: Record<DealStage, string> = {
  inquiry: "bg-gray-100 text-gray-700 border-gray-300",
  quote_in_progress: "bg-blue-50 text-blue-700 border-blue-300",
  quote_sent: "bg-indigo-50 text-indigo-700 border-indigo-300",
  order_confirmed: "bg-amber-50 text-amber-700 border-amber-300",
  delivered: "bg-green-50 text-green-700 border-green-300",
  defect_reorder: "bg-orange-50 text-orange-700 border-orange-300",
  cancelled: "bg-gray-100 text-gray-500 border-gray-300",
};

interface Props {
  deal: Deal;
  onChanged: () => void | Promise<void>;
  onStageChanged?: (next: DealStage) => Promise<void> | void;
  currentProfileId?: string | null;
}

export function DefectBar({ deal, onChanged, onStageChanged, currentProfileId }: Props) {
  const navigate = useNavigate();
  const [resolution, setResolution] = useState<DefectResolution>(
    deal.defect_resolution ?? "pending",
  );
  const [busy, setBusy] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const [deliveredAskOpen, setDeliveredAskOpen] = useState(false);
  const [description, setDescription] = useState(deal.defect_description ?? "");
  const lastSavedDescRef = useRef(deal.defect_description ?? "");
  const [refundAmount, setRefundAmount] = useState<string>(
    deal.refund_amount_isk != null ? String(deal.refund_amount_isk) : "",
  );
  const lastSavedRefundRef = useRef<string>(
    deal.refund_amount_isk != null ? String(deal.refund_amount_isk) : "",
  );
  const [childDeals, setChildDeals] = useState<ChildDeal[]>([]);

  useEffect(() => {
    setDescription(deal.defect_description ?? "");
    lastSavedDescRef.current = deal.defect_description ?? "";
  }, [deal.defect_description]);

  useEffect(() => {
    const v = deal.refund_amount_isk != null ? String(deal.refund_amount_isk) : "";
    setRefundAmount(v);
    lastSavedRefundRef.current = v;
  }, [deal.refund_amount_isk]);

  useEffect(() => {
    setResolution(deal.defect_resolution ?? "pending");
  }, [deal.defect_resolution]);

  // Fetch child deals (linked gallapöntun)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, so_number, name, stage")
        .eq("parent_deal_id", deal.id);
      if (cancelled) return;
      setChildDeals((data ?? []) as ChildDeal[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [deal.id]);

  const saveDescription = async () => {
    const value = description;
    if (value === lastSavedDescRef.current) return;
    const { error } = await supabase
      .from("deals")
      .update({ defect_description: value })
      .eq("id", deal.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    lastSavedDescRef.current = value;
    toast.success(t.status.savedSuccessfully);
    await onChanged();
  };

  const saveRefund = async () => {
    if (refundAmount === lastSavedRefundRef.current) return;
    const num = refundAmount === "" ? null : Number(refundAmount);
    if (num !== null && Number.isNaN(num)) return;
    const { error } = await supabase
      .from("deals")
      .update({ refund_amount_isk: num })
      .eq("id", deal.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    lastSavedRefundRef.current = refundAmount;
    toast.success(t.status.savedSuccessfully);
    await onChanged();
  };

  const persistResolution = async (next: DefectResolution) => {
    const previous = resolution;
    setResolution(next);
    const { error } = await supabase
      .from("deals")
      .update({ defect_resolution: next })
      .eq("id", deal.id);
    if (error) {
      setResolution(previous);
      toast.error(t.status.somethingWentWrong);
      return false;
    }
    toast.success(t.status.savedSuccessfully);
    await onChanged();
    return true;
  };

  const handleResolutionChange = (next: DefectResolution) => {
    if (next === resolution) return;
    if (next === "reorder") {
      setReorderOpen(true);
      return;
    }
    if (next === "resolved") {
      setResolvedOpen(true);
      return;
    }
    void persistResolution(next);
  };

  const markResolved = async (delivered: boolean) => {
    setBusy(true);
    const nextStage: DealStage = delivered ? "delivered" : "order_confirmed";
    const update: {
      defect_resolution: DefectResolution;
      stage: DealStage;
      delivered_at?: string;
    } = {
      defect_resolution: "resolved",
      stage: nextStage,
    };
    if (delivered) {
      update.delivered_at =
        deal.delivered_at ?? new Date().toISOString().slice(0, 10);
    }
    const { error } = await supabase
      .from("deals")
      .update(update)
      .eq("id", deal.id);
    setBusy(false);
    setDeliveredAskOpen(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    await onStageChanged?.(nextStage);
    toast.success(t.status.savedSuccessfully);
    await onChanged();
  };

  const createReorder = async () => {
    setBusy(true);
    const { data: newDeal, error } = await supabase
      .from("deals")
      .insert({
        company_id: deal.company_id,
        contact_id: deal.contact_id,
        owner_id: deal.owner_id,
        name: deal.name + " (gallapöntun)",
        stage: "quote_in_progress",
        default_markup_pct: deal.default_markup_pct,
        invoice_status: "not_invoiced",
        payment_status: "unpaid",
        tracking_numbers: [],
        shipping_cost_isk: 0,
        total_cost_isk: 0,
        total_price_isk: 0,
        total_margin_isk: 0,
        amount_isk: 0,
        parent_deal_id: deal.id,
      })
      .select()
      .single();

    if (error || !newDeal) {
      setBusy(false);
      setReorderOpen(false);
      toast.error(t.status.somethingWentWrong);
      return;
    }

    const { data: originalLines } = await supabase
      .from("deal_lines")
      .select("*")
      .eq("deal_id", deal.id)
      .order("line_order");

    if (originalLines?.length) {
      const newLines = originalLines.map(
        ({
          id: _id,
          deal_id: _did,
          created_at: _c,
          updated_at: _u,
          ...line
        }) => ({
          ...line,
          deal_id: newDeal.id,
        }),
      );
      await supabase.from("deal_lines").insert(newLines);
    }

    await supabase
      .from("deals")
      .update({ defect_resolution: "reorder" })
      .eq("id", deal.id);

    await supabase.from("activities").insert({
      deal_id: deal.id,
      company_id: deal.company_id,
      type: "note",
      body: `Gallapöntun stofnuð: ${newDeal.so_number || "ný sala"}`,
      created_by: currentProfileId ?? null,
    });

    setBusy(false);
    setReorderOpen(false);
    toast.success(t.status.savedSuccessfully);
    rememberDealReturnPath(`/deals/${deal.id}`);
    navigate({ to: "/deals/$id", params: { id: newDeal.id } });
  };

  const cancelDeal = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("deals")
      .update({ stage: "cancelled" })
      .eq("id", deal.id);
    setBusy(false);
    setCancelOpen(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    await onStageChanged?.("cancelled");
    toast.success(t.status.savedSuccessfully);
    await onChanged();
  };

  // ---- Visual state computation ----
  const refundSet = deal.refund_amount_isk != null;
  const allChildrenDelivered =
    childDeals.length > 0 && childDeals.every((c) => c.stage === "delivered");

  const isMutedAmber =
    (resolution === "reorder" && allChildrenDelivered) ||
    (resolution === "refund" && refundSet) ||
    resolution === "credit_note";
  const isMutedGrey = resolution === "resolved";
  const isHandled = isMutedAmber || isMutedGrey;

  const containerClass = isMutedGrey
    ? "rounded-md border border-gray-200 bg-gray-50 p-4 shadow-sm"
    : isMutedAmber
      ? "rounded-md border border-orange-200 bg-orange-50 p-4 shadow-sm"
      : "rounded-md border border-orange-300 bg-orange-50 p-4 shadow-sm";

  const iconClass = isMutedGrey ? "text-gray-600" : "text-orange-700";
  const titleClass = isMutedGrey
    ? "text-lg font-bold text-gray-800"
    : isMutedAmber
      ? "text-lg font-bold text-orange-800"
      : "text-lg font-bold text-orange-900";

  let title: string = t.dealStage.defect_reorder;
  if (resolution === "resolved") title = t.deal.defectResolved;
  else if (resolution === "credit_note") title = t.deal.defectResolved;
  else if (resolution === "refund" && refundSet) title = t.deal.defectResolved;
  else if (resolution === "reorder" && allChildrenDelivered)
    title = t.deal.defectReorderDelivered;

  const showReorderButton = resolution === "pending" || resolution === "reorder";

  return (
    <div className={containerClass}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex items-start gap-3 md:w-64 md:flex-shrink-0">
          {isMutedGrey ? (
            <CheckCircle2 className={cn("mt-0.5 h-9 w-9 flex-shrink-0", iconClass)} />
          ) : (
            <AlertTriangle className={cn("mt-0.5 h-9 w-9 flex-shrink-0", iconClass)} />
          )}
          <div className="flex-1 space-y-3">
            <div className={titleClass}>
              {title}
              {(isMutedAmber || isMutedGrey) && (
                <CheckCircle2 className="ml-1 inline h-4 w-4 text-green-600" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label className={cn(
                "text-xs font-medium uppercase",
                isMutedGrey ? "text-gray-700" : "text-orange-800",
              )}>
                {t.deal.defect_resolution}
              </Label>
              <Select
                value={resolution}
                onValueChange={(v) =>
                  handleResolutionChange(v as DefectResolution)
                }
              >
                <SelectTrigger className="h-8 w-48 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t.defectResolution[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {resolution === "refund" && (
              <div className="flex flex-col gap-1">
                <Label className={cn(
                  "text-xs font-medium uppercase",
                  isMutedGrey ? "text-gray-700" : "text-orange-800",
                )}>
                  {t.deal.refund_amount_isk}
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  onBlur={saveRefund}
                  className="h-8 w-48 bg-white"
                  placeholder="0"
                />
                <p className={cn(
                  "text-[11px]",
                  isMutedGrey ? "text-gray-600" : "text-orange-700",
                )}>
                  {t.deal.refundNote}
                </p>
                {refundSet && (
                  <p className="text-sm font-medium text-orange-900">
                    {t.defectResolution.refund}: {formatIsk(deal.refund_amount_isk as number)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center px-0 md:px-4">
          <Label className={cn(
            "mb-1 text-xs font-medium uppercase",
            isMutedGrey ? "text-gray-700" : "text-orange-800",
          )}>
            {t.deal.defect_description}
          </Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            rows={4}
            className="w-full max-w-xl bg-white text-sm text-orange-950"
            placeholder={t.deal.defectModal.placeholder}
          />

          {childDeals.length > 0 && (
            <div className="mt-3 w-full max-w-xl space-y-1">
              <div className={cn(
                "text-[11px] font-medium uppercase",
                isMutedGrey ? "text-gray-700" : "text-orange-800",
              )}>
                {t.deal.defectLinked}
              </div>
              <ul className="space-y-1">
                {childDeals.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/deals/$id"
                      params={{ id: c.id }}
                      onClick={() => rememberDealReturnPath(`/deals/${deal.id}`)}
                      className="inline-flex items-center gap-2 text-sm text-orange-900 hover:underline"
                    >
                      {c.stage === "delivered" && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      )}
                      <span className="font-mono text-xs">{c.so_number}</span>
                      <span className="truncate">— {c.name}</span>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px]",
                          STAGE_BADGE[c.stage],
                        )}
                      >
                        {t.dealStage[c.stage]}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex flex-col flex-wrap gap-2 sm:flex-row md:flex-col md:items-end md:justify-center md:self-stretch md:flex-shrink-0">
          {showReorderButton && (
            <Button
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
              disabled={busy}
              onClick={() => setReorderOpen(true)}
            >
              Stofna gallapöntun
            </Button>
          )}

          <AlertDialog open={reorderOpen} onOpenChange={setReorderOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Stofna gallapöntun</AlertDialogTitle>
                <AlertDialogDescription>
                  Stofna nýja gallapöntun tengda þessari sölu?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>
                  {t.actions.cancel}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void createReorder();
                  }}
                  disabled={busy}
                  className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                >
                  {t.actions.confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={resolvedOpen} onOpenChange={setResolvedOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.defectResolution.resolved}</AlertDialogTitle>
                <AlertDialogDescription>
                  Var málið leyst án gallapöntunar og/eða endurgreiðslu?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Nei</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    setResolvedOpen(false);
                    setDeliveredAskOpen(true);
                  }}
                  disabled={busy}
                  className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                >
                  Já
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={deliveredAskOpen}
            onOpenChange={setDeliveredAskOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.defectResolution.resolved}</AlertDialogTitle>
                <AlertDialogDescription>
                  Er pöntunin þegar afhent?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>
                  {t.actions.cancel}
                </AlertDialogCancel>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void markResolved(false)}
                >
                  Nei
                </Button>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void markResolved(true);
                  }}
                  disabled={busy}
                  className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                >
                  Já
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {!isHandled && (
            <Popover open={cancelOpen} onOpenChange={setCancelOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={busy}
                >
                  Hætta við sölu
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <div className="space-y-3">
                  <p className="text-sm">Hætta við sölu og loka máli?</p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCancelOpen(false)}
                      disabled={busy}
                    >
                      {t.actions.cancel}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={cancelDeal}
                      disabled={busy}
                    >
                      {t.actions.confirm}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

        </div>
      </div>
    </div>
  );
}
