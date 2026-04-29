import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { AppMain } from "@/components/AppMain";
import { InnkaupDetail } from "@/components/innkaup/InnkaupDetail";
import { t } from "@/lib/sala_translations_is";

export const Route = createFileRoute("/innkaup_/$id")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${t.nav.purchaseOrders} — ${t.brand.name}` }],
  }),
  component: InnkaupDetailPage,
});

function InnkaupDetailPage() {
  return (
    <ProtectedRoute>
      {(session) => (
        <div className="min-h-screen bg-background">
          <Sidebar activeKey="purchaseOrders" userEmail={session.user.email ?? ""} />
          <AppMain>
            <InnkaupDetailContentLoader currentProfileId={session.user.id} />
          </AppMain>
        </div>
      )}
    </ProtectedRoute>
  );
}

function InnkaupDetailContentLoader({ currentProfileId }: { currentProfileId: string }) {
  const { id } = Route.useParams();
  return <InnkaupDetail poId={id} currentProfileId={currentProfileId} />;
}
