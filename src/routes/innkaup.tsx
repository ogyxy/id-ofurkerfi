import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { InnkaupList } from "@/components/innkaup/InnkaupList";
import { t } from "@/lib/sala_translations_is";

export const Route = createFileRoute("/innkaup")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${t.nav.purchaseOrders} — ${t.brand.name}` }],
  }),
  component: InnkaupPage,
});

function InnkaupPage() {
  return (
    <ProtectedRoute>
      {(session) => (
        <div className="min-h-screen bg-background">
          <Sidebar activeKey="purchaseOrders" userEmail={session.user.email ?? ""} />
          <main className="px-4 pb-8 pt-20 md:ml-60 md:px-8 md:pt-8">
            <InnkaupList currentProfileId={session.user.id} />
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}
