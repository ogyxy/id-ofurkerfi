import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { CompaniesTable } from "@/components/CompaniesTable";
import { NewCompanyDrawer } from "@/components/companies-list/NewCompanyDrawer";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/sala_translations_is";

export const Route = createFileRoute("/companies")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${t.nav.companies} — ${t.brand.name}` }],
  }),
  component: CompaniesPage,
});

function CompaniesPage() {
  const [newOpen, setNewOpen] = useState(false);
  return (
    <ProtectedRoute>
      {(session) => (
        <div className="min-h-screen bg-background">
          <Sidebar activeKey="companies" userEmail={session.user.email ?? ""} />
          <main className="px-4 pb-8 pt-20 md:ml-60 md:px-8 md:pt-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold text-foreground">
                {t.nav.companies}
              </h1>
              <Button
                onClick={() => setNewOpen(true)}
                className="bg-ide-navy text-white hover:bg-ide-navy-hover"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.newCompany.title}
              </Button>
            </div>
            <CompaniesTable />
            <NewCompanyDrawer open={newOpen} onOpenChange={setNewOpen} />
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}

