import { useState } from "react";
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
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type DefectResolution = Database["public"]["Enums"]["defect_resolution"];
type DealStage = Database["public"]["Enums"]["deal_stage"];

const RESOLUTIONS: DefectResolution[] = [
  "pending",
  "reorder",
  "refund",
  "credit_note",
  "resolved",
];

interface Props {
  deal: Deal;
  onChanged: () => void | Promise<void>;
}

export function DefectBar({ deal, onChanged }: Props) {
  const navigate = useNavigate();
  const [resolution, setResolution] = useState<DefectResolution>(
    deal.defect_resolution ?? "pending",
  );
  const [busy, setBusy] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reactivateStage, setReactivateStage] =
    useState<DealStage>("quote_in_progress");

  const handleResolutionChange = async (next: DefectResolution) => {
    const previous = resolution;
    setResolution(next);
    const { error } = await supabase
      .from("deals")
      .update({ defect_resolution: next })
      .eq("id", deal.id);
    if (error) {
      setResolution(previous);
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

  const reactivateDeal = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("deals")
      .update({ stage: reactivateStage, defect_resolution: "pending" })
      .eq("id", deal.id);
    setBusy(false);
    setReactivateOpen(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    await onChanged();
  };

  return (
    <div className="rounded-md border border-orange-300 bg-orange-50 p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-1 items-start gap-3">
          <AlertTriangle className="mt-0.5 h-9 w-9 flex-shrink-0 text-orange-700" />
          <div className="flex-1 space-y-3">
            <div className="text-lg font-bold text-orange-900">
              {t.dealStage.defect_reorder}
            </div>

            <div>
              <div className="text-xs font-medium uppercase text-orange-800">
                {t.deal.defect_description}
              </div>
              <p className="whitespace-pre-wrap text-sm text-orange-950">
                {deal.defect_description?.trim() || "—"}
              </p>
            </div>

            <div className="flex items-center gap-2">
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

        <div className="flex flex-col flex-wrap gap-2 sm:flex-row md:flex-col md:items-end">
          <Popover open={reorderOpen} onOpenChange={setReorderOpen}>
            <PopoverTrigger asChild>
              <Button
                className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                disabled={busy}
              >
                Stofna gallapöntun
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
              <div className="space-y-3">
                <p className="text-sm">
                  Stofna nýja gallapöntun tengda þessari sölu?
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReorderOpen(false)}
                    disabled={busy}
                  >
                    {t.actions.cancel}
                  </Button>
                  <Button
                    size="sm"
                    onClick={createReorder}
                    disabled={busy}
                    className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                  >
                    {t.actions.confirm}
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

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

          <Popover open={reactivateOpen} onOpenChange={setReactivateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" disabled={busy}>
                Endurvirkja
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Hvaða stig á að færa söluna í?
                </p>
                <RadioGroup
                  value={reactivateStage}
                  onValueChange={(v) => setReactivateStage(v as DealStage)}
                  className="gap-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="quote_in_progress"
                      id="reactivate-quote"
                    />
                    <Label htmlFor="reactivate-quote" className="font-normal">
                      {t.dealStage.quote_in_progress}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="order_confirmed"
                      id="reactivate-order"
                    />
                    <Label htmlFor="reactivate-order" className="font-normal">
                      {t.dealStage.order_confirmed}
                    </Label>
                  </div>
                </RadioGroup>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReactivateOpen(false)}
                    disabled={busy}
                  >
                    {t.actions.cancel}
                  </Button>
                  <Button
                    size="sm"
                    onClick={reactivateDeal}
                    disabled={busy}
                    className="bg-ide-navy text-white hover:bg-ide-navy-hover"
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
