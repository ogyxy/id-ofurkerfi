import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { AppMain } from "@/components/AppMain";
import { rememberDealReturnPath, consumeCompanyReturnPath } from "@/lib/dealReturn";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { CompanyHeader } from "@/components/company-detail/CompanyHeader";
import { ContactsTab } from "@/components/company-detail/ContactsTab";
import { DealsTab } from "@/components/company-detail/DealsTab";
import { CompanyFilesTab } from "@/components/company-detail/CompanyFilesTab";

import { EditCompanyDrawer } from "@/components/company-detail/EditCompanyDrawer";
import { cn } from "@/lib/utils";

type Company = Database["public"]["Tables"]["companies"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type Deal = {
  id: string;
  so_number: string;
  name: string;
  stage: Database["public"]["Enums"]["deal_stage"];
  amount_isk: number | null;
  refund_amount_isk: number | null;
  promised_delivery_date: string | null;
  delivered_at: string | null;
  invoice_status: Database["public"]["Enums"]["invoice_status"];
  payment_status: Database["public"]["Enums"]["payment_status"];
  defect_resolution: Database["public"]["Enums"]["defect_resolution"];
  created_at: string;
  childDeals?: { stage: Database["public"]["Enums"]["deal_stage"] }[];
};
type Activity = Pick<
  Database["public"]["Tables"]["activities"]["Row"],
  "id" | "type" | "subject" | "body" | "created_at" | "due_date" | "completed"
>;

export const Route = createFileRoute("/companies_/$id")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${t.nav.companies} — ${t.brand.name}` }],
  }),
  component: CompanyDetailPage,
});

type TabKey = "contacts" | "deals" | "files";

function CompanyDetailPage() {
  return (
    <ProtectedRoute>
      {(session) => (
        <div className="min-h-screen bg-background">
          <Sidebar activeKey="companies" userEmail={session.user.email ?? ""} />
          <AppMain>
            <CompanyDetailContent currentProfileId={session.user.id ?? null} />
          </AppMain>
        </div>
      )}
    </ProtectedRoute>
  );
}

function CompanyDetailContent({ currentProfileId }: { currentProfileId: string | null }) {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [billingCompany, setBillingCompany] = useState<{ id: string; name: string } | null>(null);
  const [linkedBrands, setLinkedBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [, setActivities] = useState<Activity[]>([]);
  const [fileCount, setFileCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("deals");
  const [editOpen, setEditOpen] = useState(false);

  const refreshFileCount = useCallback(async () => {
    const { count: cCount } = await supabase
      .from("company_files")
      .select("id", { count: "exact", head: true })
      .eq("company_id", id);

    const { data: dealRows } = await supabase
      .from("deals")
      .select("id")
      .eq("company_id", id)
      .eq("archived", false);
    const dealIds = (dealRows ?? []).map((d) => d.id);

    let dCount = 0;
    if (dealIds.length > 0) {
      const { count } = await supabase
        .from("deal_files")
        .select("id", { count: "exact", head: true })
        .in("deal_id", dealIds);
      dCount = count ?? 0;
    }
    setFileCount((cCount ?? 0) + dCount);
  }, [id]);

  const loadAll = useCallback(async () => {
    const [companyRes, contactsRes, dealsRes, activitiesRes] = await Promise.all([
      supabase.from("companies").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("contacts")
        .select("*")
        .eq("company_id", id)
        .order("is_primary", { ascending: false }),
      supabase
        .from("deals")
        .select(
          "id, so_number, name, stage, amount_isk, refund_amount_isk, promised_delivery_date, delivered_at, invoice_status, payment_status, defect_resolution, created_at",
        )
        .eq("company_id", id)
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("activities")
        .select("id, type, subject, body, created_at, due_date, completed")
        .eq("company_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (!companyRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setNotFound(false);
    setCompany(companyRes.data);
    setContacts((contactsRes.data ?? []) as Contact[]);
    let dealRows = (dealsRes.data ?? []) as Deal[];
    const defectReorderIds = dealRows
      .filter((d) => d.stage === "defect_reorder" && d.defect_resolution === "reorder")
      .map((d) => d.id);
    if (defectReorderIds.length) {
      const { data: children } = await supabase
        .from("deals")
        .select("parent_deal_id, stage")
        .in("parent_deal_id", defectReorderIds);
      if (children) {
        const byParent = new Map<string, { stage: Deal["stage"] }[]>();
        (children as { parent_deal_id: string; stage: Deal["stage"] }[]).forEach((c) => {
          const arr = byParent.get(c.parent_deal_id) ?? [];
          arr.push({ stage: c.stage });
          byParent.set(c.parent_deal_id, arr);
        });
        dealRows = dealRows.map((d) => ({ ...d, childDeals: byParent.get(d.id) ?? [] }));
      }
    }
    setDeals(dealRows);
    setActivities((activitiesRes.data ?? []) as Activity[]);

    // Billing parent + linked child brands
    const c = companyRes.data as Company;
    if (c.billing_company_id) {
      const { data: parent } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", c.billing_company_id)
        .maybeSingle();
      setBillingCompany(parent ? { id: parent.id, name: parent.name } : null);
    } else {
      setBillingCompany(null);
    }
    const { data: brands } = await supabase
      .from("companies")
      .select("id, name")
      .eq("billing_company_id", id)
      .eq("archived", false)
      .order("name");
    setLinkedBrands((brands ?? []) as Array<{ id: string; name: string }>);

    setLoading(false);
    void refreshFileCount();
  }, [id, refreshFileCount]);

  useEffect(() => {
    setLoading(true);
    loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        {t.status.loading}
      </div>
    );
  }

  if (notFound || !company) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">{t.status.noResults}</p>
        <Button variant="outline" onClick={() => navigate({ to: "/companies" })}>
          {t.actions.back}
        </Button>
      </div>
    );
  }

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "deals", label: t.nav.deals, count: deals.length },
    { key: "contacts", label: t.nav.contacts, count: contacts.length },
    { key: "files", label: t.dealFile.title, count: fileCount },
  ];

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => {
          const returnPath = consumeCompanyReturnPath();
          navigate({ to: returnPath });
        }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.actions.back}
      </button>

      <CompanyHeader
        company={company}
        billingCompany={billingCompany}
        onEdit={() => setEditOpen(true)}
      />

      {/* Tabs nav */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-ide-navy text-ide-navy"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {activeTab === "contacts" && (
          <ContactsTab companyId={company.id} contacts={contacts} onChanged={loadAll} />
        )}
        {activeTab === "deals" && (
          <DealsTab
            companyId={company.id}
            deals={deals}
            contacts={contacts}
            onChanged={loadAll}
            onOpenDeal={(dealId) => {
              rememberDealReturnPath();
              navigate({ to: "/deals/$id", params: { id: dealId } });
            }}
          />
        )}
        {activeTab === "files" && (
          <CompanyFilesTab
            companyId={company.id}
            companyName={company.name}
            currentProfileId={currentProfileId}
            onCountChanged={refreshFileCount}
          />
        )}
      </div>

      {linkedBrands.length > 0 && (
        <div className="rounded-md border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ide-navy">
            {t.newCompany.linkedCustomers}
          </h2>
          <div className="flex flex-wrap gap-2">
            {linkedBrands.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  rememberCompanyReturnPath();
                  navigate({ to: "/companies/$id", params: { id: b.id } });
                }}
                className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground hover:bg-muted/70"
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <EditCompanyDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        company={company}
        onSaved={loadAll}
      />
    </div>
  );
}
