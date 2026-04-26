import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { CompaniesTable } from "@/components/CompaniesTable";
import { t } from "@/lib/sala_translations_is";

export const Route = createFileRoute("/companies")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${t.nav.companies} — ${t.brand.name}` }],
  }),
  component: CompaniesPage,
});

function CompaniesPage() {
  return (
    <ProtectedRoute>
      {(session) => (
        <div className="min-h-screen bg-background">
          <Sidebar activeKey="companies" userEmail={session.user.email ?? ""} />
          <main className="ml-60 px-8 py-8">
            <h1 className="mb-6 text-2xl font-semibold text-foreground">
              {t.nav.companies}
            </h1>
            <CompaniesTable />
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}
