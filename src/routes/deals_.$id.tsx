import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { StageStepper } from "@/components/deal-detail/StageStepper";
import { DealHeader } from "@/components/deal-detail/DealHeader";
import {
  DealLinesEditor,
  fromDbLine,
  type EditableLine,
} from "@/components/deal-detail/DealLinesEditor";
import { DealSummary } from "@/components/deal-detail/DealSummary";
import { PurchaseOrdersSection } from "@/components/deal-detail/PurchaseOrdersSection";
import { TrackingNumbersField } from "@/components/deal-detail/TrackingNumbersField";
import { DealActivitiesTab } from "@/components/deal-detail/DealActivitiesTab";
import { EditDealDrawer } from "@/components/deal-detail/EditDealDrawer";
import { toast } from "sonner";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type Company = Pick<
  Database["public"]["Tables"]["companies"]["Row"],
  "id" | "name" | "vsk_status" | "payment_terms_days"
>;
type Contact = Pick<
  Database["public"]["Tables"]["contacts"]["Row"],
  "id" | "first_name" | "last_name" | "email" | "phone"
>;
type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"];
type POLine = Database["public"]["Tables"]["po_lines"]["Row"];
type Activity = Pick<
  Database["public"]["Tables"]["activities"]["Row"],
  "id" | "type" | "subject" | "body" | "created_at" | "due_date" | "completed"
>;
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
          <Sidebar activeKey="companies" userEmail={session.user.email ?? ""} />
          <main className="px-4 pb-8 pt-20 md:ml-60 md:px-8 md:pt-8">
            <DealDetailContent />
          </main>
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
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [pos, setPos] = useState<
    Array<PurchaseOrder & { po_lines: POLine[] }>
  >([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [defaultMarkupPct, setDefaultMarkupPct] = useState(30);
  const [shippingCost, setShippingCost] = useState(0);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ratesError, setRatesError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    const [dealRes, linesRes, posRes, actsRes] = await Promise.all([
      supabase
        .from("deals")
        .select(
          `*, company:companies(id, name, vsk_status, payment_terms_days), contact:contacts(id, first_name, last_name, email, phone)`,
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
        .select("id, type, subject, body, created_at, due_date, completed")
        .eq("deal_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (!dealRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const d = dealRes.data as Deal & {
      company: Company;
      contact: Contact | null;
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
    setActivities((actsRes.data ?? []) as Activity[]);

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

  // Fetch live exchange rates. Frankfurter does not support ISK as a base,
  // so we fetch with EUR base and derive X→ISK as ISK_per_EUR / X_per_EUR.
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

  const updateStage = async (next: Deal["stage"]) => {
    if (!deal) return;
    const { error } = await supabase
      .from("deals")
      .update({ stage: next })
      .eq("id", deal.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
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
      <Link
        to="/companies/$id"
        params={{ id: company.id }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.actions.back}
      </Link>

      <StageStepper stage={deal.stage} onChange={updateStage} />

      <DealHeader
        deal={deal}
        company={company}
        contact={contact}
        ownerName={ownerName}
        onEdit={() => setEditOpen(true)}
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
      />

      <DealSummary
        dealId={deal.id}
        lines={lines}
        shippingCost={shippingCost}
        setShippingCost={setShippingCost}
        vskStatus={company.vsk_status}
      />

      <PurchaseOrdersSection
        dealId={deal.id}
        pos={pos}
        onChanged={load}
      />

      <TrackingNumbersField
        dealId={deal.id}
        initial={deal.tracking_numbers ?? []}
      />

      <DealActivitiesTab
        dealId={deal.id}
        companyId={company.id}
        activities={activities}
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
    </div>
  );
}
