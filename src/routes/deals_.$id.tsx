import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { AppMain } from "@/components/AppMain";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { goBack } from "@/lib/dealReturn";
import { StageStepper } from "@/components/deal-detail/StageStepper";
import { DeliveredBar } from "@/components/deal-detail/DeliveredBar";
import { DefectBar } from "@/components/deal-detail/DefectBar";
import { DefectDescriptionModal } from "@/components/deal-detail/DefectDescriptionModal";
import { StepperActions } from "@/components/deal-detail/StepperActions";
import { ParentDealBanner } from "@/components/deal-detail/ParentDealBanner";
import { DealHeader } from "@/components/deal-detail/DealHeader";
import { TrackingCard } from "@/components/tracking/TrackingCard";
import {
  DealLinesEditor,
  fromDbLine,
  type EditableLine,
} from "@/components/deal-detail/DealLinesEditor";
import { DealSummary } from "@/components/deal-detail/DealSummary";
import { PurchaseOrdersSection } from "@/components/deal-detail/PurchaseOrdersSection";
import { DealFilesSection } from "@/components/deal-detail/DealFilesSection";
import { QuoteBuilderModal } from "@/components/deal-detail/QuoteBuilderModal";

import { DealLog, type LogEntry } from "@/components/deal-detail/DealLog";
import { EditDealDrawer } from "@/components/deal-detail/EditDealDrawer";
import { toast } from "sonner";
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
import {
  fetchLinkedPos,
  planSoMarkArrived,
  type LinkedPo,
} from "@/lib/poSoSync";
import { logPoReceived } from "@/lib/poActivityLog";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type DealStage = Database["public"]["Enums"]["deal_stage"];
type Company = Pick<
  Database["public"]["Tables"]["companies"]["Row"],
  "id" | "name" | "vsk_status" | "payment_terms_days" | "kennitala" | "address_line_1" | "address_line_2" | "postcode" | "city"
> & {
  billing_company?: { id: string; name: string } | null;
};
type Contact = Pick<
  Database["public"]["Tables"]["contacts"]["Row"],
  "id" | "first_name" | "last_name" | "email" | "phone"
>;
type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"];
type POLine = Database["public"]["Tables"]["po_lines"]["Row"];
type Profile = { id: string; name: string | null; email: string };

export const Route = createFileRoute("/deals_/$id")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${t.nav.deals} — ${t.brand.name}` }],
  }),
  component: DealDetailPage,
});

function DealDetailPage() {
  return (
    <ProtectedRoute>
      {(session) => (
        <div className="min-h-screen bg-background">
          <Sidebar activeKey="deals" userEmail={session.user.email ?? ""} />
          <AppMain>
            <DealDetailContent />
          </AppMain>
        </div>
      )}
    </ProtectedRoute>
  );
}

function DealDetailContent() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [companyContacts, setCompanyContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] =
    useState<{ id: string; name: string | null } | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [pos, setPos] = useState<
    Array<PurchaseOrder & { po_lines: POLine[] }>
  >([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [defaultMarkupPct, setDefaultMarkupPct] = useState(30);
  const [shippingCost, setShippingCost] = useState(0);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ratesError, setRatesError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [quoteBuilderOpen, setQuoteBuilderOpen] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [defectModalOpen, setDefectModalOpen] = useState(false);
  const [defectBusy, setDefectBusy] = useState(false);
  const [cascadeDialog, setCascadeDialog] = useState<{
    outstanding: LinkedPo[];
    total: number;
  } | null>(null);

  const [parentDeal, setParentDeal] = useState<{
    id: string;
    so_number: string;
    name: string;
  } | null>(null);

  // Load current user's profile once
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserEmail(user.email ?? "");
      const { data } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("id", user.id)
        .maybeSingle();
      if (data) setCurrentProfile({ id: data.id, name: data.name });
    })();
  }, []);

  const load = useCallback(async () => {
    const [dealRes, linesRes, posRes, logRes] = await Promise.all([
      supabase
        .from("deals")
        .select(
          `*, company:companies!deals_company_id_fkey(id, name, vsk_status, payment_terms_days, kennitala, address_line_1, address_line_2, postcode, city, billing_company:companies!billing_company_id(id, name)), contact:contacts(id, first_name, last_name, email, phone)`,
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("deal_lines")
        .select("*")
        .eq("deal_id", id)
        .order("line_order"),
      supabase
        .from("purchase_orders")
        .select("*, po_lines(*)")
        .eq("deal_id", id)
        .order("created_at"),
      supabase
        .from("activities")
        .select(
          "id, type, body, created_at, profile:profiles!activities_created_by_fkey(id, name)",
        )
        .eq("deal_id", id)
        .in("type", ["note", "stage_change", "defect_note"])
        .order("created_at", { ascending: false }),
    ]);

    if (!dealRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const raw = dealRes.data as unknown as Deal & {
      company: Omit<Company, "billing_company"> & {
        billing_company: { id: string; name: string } | { id: string; name: string }[] | null;
      };
      contact: Contact | null;
    };
    const bc = Array.isArray(raw.company.billing_company)
      ? (raw.company.billing_company[0] ?? null)
      : raw.company.billing_company;
    const d: Deal & { company: Company; contact: Contact | null } = {
      ...raw,
      company: { ...raw.company, billing_company: bc },
    };
    setDeal(d);
    setCompany(d.company);
    setContact(d.contact);
    setDefaultMarkupPct(Number(d.default_markup_pct));
    setShippingCost(Number(d.shipping_cost_isk));
    setLines((linesRes.data ?? []).map(fromDbLine));
    setPos(
      (posRes.data ?? []) as Array<PurchaseOrder & { po_lines: POLine[] }>,
    );
    setLogEntries((logRes.data ?? []) as unknown as LogEntry[]);

    // Parent deal lookup
    if (d.parent_deal_id) {
      const { data: parent } = await supabase
        .from("deals")
        .select("id, so_number, name")
        .eq("id", d.parent_deal_id)
        .maybeSingle();
      setParentDeal(parent ?? null);
    } else {
      setParentDeal(null);
    }

    // Load company contacts + profiles for edit drawer
    const [cRes, pRes] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .eq("company_id", d.company.id),
      supabase
        .from("profiles")
        .select("id, name, email")
        .eq("active", true),
    ]);
    setCompanyContacts((cRes.data ?? []) as Contact[]);
    setProfiles((pRes.data ?? []) as Profile[]);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Live exchange rates
  useEffect(() => {
    let cancelled = false;
    fetch(
      "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=ISK,GBP,USD,NOK,DKK,SEK,CHF",
    )
      .then((r) => {
        if (!r.ok) throw new Error("rate fetch failed");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const raw = data.rates as Record<string, number>;
        const iskPerEur = raw.ISK;
        if (!iskPerEur) throw new Error("no ISK rate");
        const out: Record<string, number> = { EUR: iskPerEur };
        Object.entries(raw).forEach(([cur, perEur]) => {
          if (cur === "ISK") return;
          if (perEur) out[cur] = iskPerEur / perEur;
        });
        setRates(out);
      })
      .catch(() => {
        if (!cancelled) setRatesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ownerProfile = profiles.find((p) => p.id === deal?.owner_id);
  const ownerName = ownerProfile?.name || ownerProfile?.email || null;

  // Insert a stage_change activity. Used by stepper, defect bar, delivered bar.
  const logStageChange = useCallback(
    async (newStage: DealStage) => {
      if (!deal) return;
      await supabase.from("activities").insert({
        deal_id: deal.id,
        company_id: deal.company_id,
        type: "stage_change",
        body: newStage,
        created_by: currentProfile?.id ?? null,
      });
    },
    [deal, currentProfile],
  );

  const performStageUpdate = async (next: Deal["stage"]) => {
    if (!deal) return;
    const patch: Partial<Deal> =
      next === "delivered"
        ? { stage: next, delivered_at: new Date().toISOString().split("T")[0] }
        : { stage: next };
    const { error } = await supabase
      .from("deals")
      .update(patch)
      .eq("id", deal.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    await logStageChange(next);
    toast.success(t.status.savedSuccessfully);
    await load();
  };

  const cascadeReceiveAllPos = async (outstanding: LinkedPo[]) => {
    if (!deal) return;
    const today = new Date().toISOString().split("T")[0];
    for (const p of outstanding) {
      await supabase
        .from("purchase_orders")
        .update({ received_date: today, status: "received" })
        .eq("id", p.id);
      await logPoReceived({
        dealId: deal.id,
        poNumber: p.po_number,
        receivedDate: today,
        createdBy: currentProfile?.id ?? null,
      });
      // Extra note attributing the cascade
      await supabase.from("activities").insert({
        deal_id: deal.id,
        type: "note",
        body: `${p.po_number}: ${t.purchaseOrder.cascadeReceivedNote}`,
        created_by: currentProfile?.id ?? null,
      });
    }
  };

  const updateStage = async (next: Deal["stage"]) => {
    if (!deal) return;
    if (next === "defect_reorder") {
      setDefectModalOpen(true);
      return;
    }
    // Intercept "Komin í hús" to cascade with PO state
    if (next === "ready_for_pickup" && deal.stage === "order_confirmed") {
      const linked = await fetchLinkedPos(supabase, deal.id);
      const plan = planSoMarkArrived(linked);
      if (plan.action === "confirmCascade") {
        setCascadeDialog({ outstanding: plan.outstanding, total: plan.total });
        return;
      }
      if (plan.action === "cascadeSilent") {
        await cascadeReceiveAllPos(plan.outstanding);
      }
    }
    await performStageUpdate(next);
  };

  const confirmDefectTransition = async (description: string) => {
    if (!deal) return;
    setDefectBusy(true);
    const { error } = await supabase
      .from("deals")
      .update({
        stage: "defect_reorder",
        defect_description: description,
        defect_resolution: "pending",
      })
      .eq("id", deal.id);
    if (error) {
      setDefectBusy(false);
      toast.error(t.status.somethingWentWrong);
      return;
    }
    await supabase.from("activities").insert({
      deal_id: deal.id,
      company_id: deal.company_id,
      type: "defect_note",
      body: description,
      created_by: currentProfile?.id ?? null,
    });
    await logStageChange("defect_reorder");
    setDefectBusy(false);
    setDefectModalOpen(false);
    toast.success(t.status.savedSuccessfully);
    await load();
  };

  const saveDefaultMarkup = async (n: number) => {
    if (!deal) return;
    await supabase
      .from("deals")
      .update({ default_markup_pct: n })
      .eq("id", deal.id);
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        {t.status.loading}
      </div>
    );
  }

  if (notFound || !deal || !company) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">{t.status.noResults}</p>
        <Button variant="outline" onClick={() => navigate({ to: "/companies" })}>
          {t.actions.back}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => goBack("/deals")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.actions.back}
      </button>

      {parentDeal && <ParentDealBanner parentDeal={parentDeal} />}

      {deal.stage === "delivered" ? (
        <DeliveredBar
          deal={deal}
          onChanged={load}
          onStageChanged={logStageChange}
          currentProfileId={currentProfile?.id ?? null}
        />
      ) : deal.stage === "defect_reorder" ? (
        <DefectBar
          deal={deal}
          onChanged={load}
          onStageChanged={logStageChange}
          currentProfileId={currentProfile?.id ?? null}
        />
      ) : (
        <StageStepper
          stage={deal.stage}
          onChange={updateStage}
          poProgress={(() => {
            const active = pos.filter((p) => p.status !== "cancelled");
            return active.length > 0
              ? {
                  received: active.filter((p) => p.received_date).length,
                  total: active.length,
                }
              : null;
          })()}
        />
      )}

      <DealHeader
        deal={deal}
        company={company}
        contact={contact}
        ownerName={ownerName}
        onEdit={() => setEditOpen(true)}
      />

      <TrackingCard
        mode="deal"
        dealId={deal.id}
        initial={deal.tracking_numbers ?? []}
      />

      <DealLinesEditor
        dealId={deal.id}
        lines={lines}
        setLines={setLines}
        defaultMarkupPct={defaultMarkupPct}
        setDefaultMarkupPct={setDefaultMarkupPct}
        rates={rates}
        ratesError={ratesError}
        onSaveDefaultMarkup={saveDefaultMarkup}
        onSaved={load}
        readOnly={deal.stage !== "inquiry" && deal.stage !== "quote_in_progress"}
      />

      <StepperActions
        stage={deal.stage}
        onChange={updateStage}
        onOpenQuoteBuilder={() => setQuoteBuilderOpen(true)}
      />

      <DealSummary
        dealId={deal.id}
        lines={lines}
        shippingCost={shippingCost}
        setShippingCost={setShippingCost}
        vskStatus={company.vsk_status}
        readOnly={deal.stage !== "inquiry" && deal.stage !== "quote_in_progress"}
        refundAmountIsk={deal.refund_amount_isk as number | null}
        defectResolution={deal.defect_resolution}
      />

      <PurchaseOrdersSection
        dealId={deal.id}
        pos={pos}
        currentProfileId={currentProfile?.id ?? null}
        onChanged={load}
      />

      <DealFilesSection
        dealId={deal.id}
        companyId={company.id}
        companyName={company.name}
        soNumber={deal.so_number}
        currentProfileId={currentProfile?.id ?? null}
      />


      <DealLog
        dealId={deal.id}
        companyId={company.id}
        entries={logEntries}
        currentProfile={currentProfile}
        onChanged={load}
      />

      <EditDealDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        deal={deal}
        contacts={companyContacts}
        profiles={profiles}
        onSaved={load}
      />

      <DefectDescriptionModal
        open={defectModalOpen}
        onOpenChange={setDefectModalOpen}
        onConfirm={confirmDefectTransition}
        busy={defectBusy}
      />

      <QuoteBuilderModal
        open={quoteBuilderOpen}
        onOpenChange={setQuoteBuilderOpen}
        deal={{
          id: deal.id,
          so_number: deal.so_number,
          name: deal.name,
          stage: deal.stage,
          total_price_isk: Number(deal.total_price_isk),
        }}
        company={{
          id: company.id,
          name: company.name,
          kennitala: company.kennitala,
          address_line_1: company.address_line_1,
          address_line_2: company.address_line_2,
          postcode: company.postcode,
          city: company.city,
        }}
        contact={contact ? { first_name: contact.first_name, last_name: contact.last_name } : null}
        currentProfile={currentProfile}
        currentUserEmail={currentUserEmail}
        onGenerated={() => {
          void load();
        }}
      />

      {/* SO mark-arrived: only shown when SO has 2+ active POs */}
      <AlertDialog
        open={!!cascadeDialog}
        onOpenChange={(o) => !o && setCascadeDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.deal.confirmAllPosArrivedTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cascadeDialog
                ? t.deal.confirmAllPosArrivedBody.replace(
                    "{count}",
                    String(cascadeDialog.total),
                  )
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <Button
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
              onClick={async () => {
                const d = cascadeDialog;
                setCascadeDialog(null);
                if (!d) return;
                await cascadeReceiveAllPos(d.outstanding);
                await performStageUpdate("ready_for_pickup");
              }}
            >
              {t.deal.confirmAllPosArrivedConfirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
