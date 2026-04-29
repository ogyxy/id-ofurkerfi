import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { AppMain } from "@/components/AppMain";
import { DealsList } from "@/components/deals-list/DealsList";
import { t } from "@/lib/sala_translations_is";

export const Route = createFileRoute("/deals")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${t.nav.deals} — ${t.brand.name}` }],
  }),
  component: DealsPage,
});

function DealsPage() {
  return (
    <ProtectedRoute>
      {(session) => (
        <div className="min-h-screen bg-background">
          <Sidebar activeKey="deals" userEmail={session.user.email ?? ""} />
          <AppMain>
            <DealsList currentUserId={session.user.id} />
          </AppMain>
        </div>
      )}
    </ProtectedRoute>
  );
}
