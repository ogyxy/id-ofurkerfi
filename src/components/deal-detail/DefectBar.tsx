import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type DefectResolution = Database["public"]["Enums"]["defect_resolution"];

const RESOLUTIONS: DefectResolution[] = [
  "pending",
  "reorder",
  "refund",
  "resolved",
];

interface Props {
  deal: Deal;
  onChanged: () => void | Promise<void>;
  onStageChanged?: (next: Database["public"]["Enums"]["deal_stage"]) => Promise<void> | void;
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
  const lastSavedRef = useRef(deal.defect_description ?? "");

  useEffect(() => {
    setDescription(deal.defect_description ?? "");
    lastSavedRef.current = deal.defect_description ?? "";
  }, [deal.defect_description]);

  const saveDescription = async () => {
    const value = description;
    if (value === lastSavedRef.current) return;
    const { error } = await supabase
      .from("deals")
      .update({ defect_description: value })
      .eq("id", deal.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    lastSavedRef.current = value;
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
    const update: {
      defect_resolution: DefectResolution;
      stage: Database["public"]["Enums"]["deal_stage"];
      delivered_at?: string;
    } = {
      defect_resolution: "resolved",
      stage: delivered ? "delivered" : "order_confirmed",
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

    setBusy(false);
    setReorderOpen(false);
    toast.success(t.status.savedSuccessfully);
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
    toast.success(t.status.savedSuccessfully);
    await onChanged();
  };


  return (
    <div className="rounded-md border border-orange-300 bg-orange-50 p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex items-start gap-3 md:w-64 md:flex-shrink-0">
          <AlertTriangle className="mt-0.5 h-9 w-9 flex-shrink-0 text-orange-700" />
          <div className="flex-1 space-y-3">
            <div className="text-lg font-bold text-orange-900">
              {t.dealStage.defect_reorder}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-medium uppercase text-orange-800">
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
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center px-0 md:px-4">
          <Label className="mb-1 text-xs font-medium uppercase text-orange-800">
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
        </div>
        <div className="flex flex-col flex-wrap gap-2 sm:flex-row md:flex-col md:items-end md:justify-center md:self-stretch md:flex-shrink-0">
          <Button
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            disabled={busy}
            onClick={() => setReorderOpen(true)}
          >
            Stofna gallapöntun
          </Button>

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

        </div>
      </div>
    </div>
  );
}
