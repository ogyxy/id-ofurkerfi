import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { CompanyHeader } from "@/components/company-detail/CompanyHeader";
import { ContactsTab } from "@/components/company-detail/ContactsTab";
import { DealsTab } from "@/components/company-detail/DealsTab";
import { DesignsTab } from "@/components/company-detail/DesignsTab";
import { ActivitiesTab } from "@/components/company-detail/ActivitiesTab";
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
  promised_delivery_date: string | null;
  invoice_status: Database["public"]["Enums"]["invoice_status"];
  payment_status: Database["public"]["Enums"]["payment_status"];
};
type Design = Pick<
  Database["public"]["Tables"]["designs"]["Row"],
  "id" | "name" | "thumbnail_url" | "tags" | "notes" | "created_at"
>;
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

type TabKey = "contacts" | "deals" | "designs" | "activities";

function CompanyDetailPage() {
  return (
    <ProtectedRoute>
      {(session) => (
        <div className="min-h-screen bg-background">
          <Sidebar activeKey="companies" userEmail={session.user.email ?? ""} />
          <main className="px-4 pb-8 pt-20 md:ml-60 md:px-8 md:pt-8">
            <CompanyDetailContent />
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}

function CompanyDetailContent() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("contacts");
  const [editOpen, setEditOpen] = useState(false);

  const loadAll = useCallback(async () => {
    const [companyRes, contactsRes, dealsRes, designsRes, activitiesRes] =
      await Promise.all([
        supabase.from("companies").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("contacts")
          .select("*")
          .eq("company_id", id)
          .order("is_primary", { ascending: false }),
        supabase
          .from("deals")
          .select(
            "id, so_number, name, stage, amount_isk, promised_delivery_date, invoice_status, payment_status",
          )
          .eq("company_id", id)
          .eq("archived", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("designs")
          .select("id, name, thumbnail_url, tags, notes, created_at")
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
    setDeals((dealsRes.data ?? []) as Deal[]);
    setDesigns((designsRes.data ?? []) as Design[]);
    setActivities((activitiesRes.data ?? []) as Activity[]);
    setLoading(false);
  }, [id]);

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
    { key: "contacts", label: t.nav.contacts, count: contacts.length },
    { key: "deals", label: t.nav.deals, count: deals.length },
    { key: "designs", label: t.nav.designs, count: designs.length },
    { key: "activities", label: t.nav.activities, count: activities.length },
  ];

  return (
    <div className="space-y-6">
      <Link
        to="/companies"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.actions.back}
      </Link>

      <CompanyHeader company={company} onEdit={() => setEditOpen(true)} />

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
            onOpenDeal={(dealId) => console.log("open deal", dealId)}
          />
        )}
        {activeTab === "designs" && (
          <DesignsTab companyId={company.id} designs={designs} onChanged={loadAll} />
        )}
        {activeTab === "activities" && (
          <ActivitiesTab
            companyId={company.id}
            activities={activities}
            onChanged={loadAll}
          />
        )}
      </div>

      <EditCompanyDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        company={company}
        onSaved={loadAll}
      />
    </div>
  );
}
