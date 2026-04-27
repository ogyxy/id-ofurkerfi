import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { CalendarIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatDate } from "@/lib/sala_translations_is";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

type Deal = Database["public"]["Tables"]["deals"]["Row"];

interface Props {
  deal: Deal;
  onChanged: () => void | Promise<void>;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

export function DeliveredBar({ deal, onChanged }: Props) {
  const navigate = useNavigate();
  const [savedDate, setSavedDate] = useState<string>(
    deal.delivered_at ?? todayIso(),
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [confirmDefect, setConfirmDefect] = useState(false);
  const [confirmReorder, setConfirmReorder] = useState(false);
  const [busy, setBusy] = useState(false);

  // If delivered_at was null, persist today immediately
  if (!deal.delivered_at && savedDate === todayIso()) {
    void supabase
      .from("deals")
      .update({ delivered_at: savedDate })
      .eq("id", deal.id)
      .then(() => {});
  }

  const saveDate = async (d: Date | undefined) => {
    if (!d) return;
    const iso = format(d, "yyyy-MM-dd");
    setSavedDate(iso);
    setCalendarOpen(false);
    const { error } = await supabase
      .from("deals")
      .update({ delivered_at: iso })
      .eq("id", deal.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    await onChanged();
  };

  const moveToDefect = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("deals")
      .update({ stage: "defect_reorder" })
      .eq("id", deal.id);
    setBusy(false);
    setConfirmDefect(false);
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
        name: deal.name + " (endurpöntun)",
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
      })
      .select()
      .single();

    if (error || !newDeal) {
      setBusy(false);
      setConfirmReorder(false);
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
        ({ id: _id, deal_id: _did, created_at: _c, updated_at: _u, ...line }) => ({
          ...line,
          deal_id: newDeal.id,
        }),
      );
      await supabase.from("deal_lines").insert(newLines);
    }

    setBusy(false);
    setConfirmReorder(false);
    toast.success(t.status.savedSuccessfully);
    navigate({ to: "/deals/$id", params: { id: newDeal.id } });
  };

  const dateValue = savedDate ? parseISO(savedDate) : undefined;

  return (
    <div className="rounded-md border border-green-300 bg-green-50 p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-green-700" />
          <div className="flex flex-col">
            <span className="text-lg font-bold text-green-800">
              {t.dealStage.delivered}
            </span>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm text-green-900 hover:underline"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Afhent: {formatDate(savedDate) || "—"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateValue}
                  onSelect={saveDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setConfirmDefect(true)}
            disabled={busy}
          >
            Galli / Vesen
          </Button>
          <Button
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            onClick={() => setConfirmReorder(true)}
            disabled={busy}
          >
            Endurpöntun
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmDefect} onOpenChange={setConfirmDefect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Færa í Galli / Vesen?</AlertDialogTitle>
            <AlertDialogDescription>
              {t.status.areYouSure}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={moveToDefect}
              disabled={busy}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {t.actions.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmReorder} onOpenChange={setConfirmReorder}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stofna nýja sölu út frá þessari pöntun?</AlertDialogTitle>
            <AlertDialogDescription>
              Ný sala verður stofnuð með afriti af öllum línum.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={createReorder}
              disabled={busy}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {t.actions.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
