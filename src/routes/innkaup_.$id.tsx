import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
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
          <main className="px-4 pb-8 pt-20 md:ml-60 md:px-8 md:pt-8">
            <InnkaupDetailContentLoader currentProfileId={session.user.id} />
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}

function InnkaupDetailContentLoader({ currentProfileId }: { currentProfileId: string }) {
  const { id } = Route.useParams();
  return <InnkaupDetail poId={id} currentProfileId={currentProfileId} />;
}
