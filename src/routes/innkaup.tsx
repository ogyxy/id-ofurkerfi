import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { AppMain } from "@/components/AppMain";
import { InnkaupList } from "@/components/innkaup/InnkaupList";
import { t } from "@/lib/sala_translations_is";
import { useCurrentRole } from "@/hooks/useCurrentProfile";
import { canSeeFinancials } from "@/lib/role";

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
          <AppMain>
            <InnkaupGate userId={session.user.id} />
          </AppMain>
        </div>
      )}
    </ProtectedRoute>
  );
}

function InnkaupGate({ userId }: { userId: string }) {
  const role = useCurrentRole();
  const navigate = useNavigate();
  const allowed = canSeeFinancials(role);
  useEffect(() => {
    if (!allowed) navigate({ to: "/yfirlit" });
  }, [allowed, navigate]);
  if (!allowed) return null;
  return <InnkaupList currentProfileId={userId} />;
}
