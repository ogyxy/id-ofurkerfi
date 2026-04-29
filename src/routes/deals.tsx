import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { AppMain } from "@/components/AppMain";
import { DealsList } from "@/components/deals-list/DealsList";
import { t } from "@/lib/sala_translations_is";
import type { Database } from "@/integrations/supabase/types";

type DealStage = Database["public"]["Enums"]["deal_stage"];
const VALID_STAGES: DealStage[] = [
  "inquiry",
  "quote_in_progress",
  "quote_sent",
  "order_confirmed",
  "delivered",
  "defect_reorder",
  "cancelled",
];

export const Route = createFileRoute("/deals")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${t.nav.deals} — ${t.brand.name}` }],
  }),
  validateSearch: (search: Record<string, unknown>): { stage?: DealStage } => {
    const s = search.stage;
    if (typeof s === "string" && (VALID_STAGES as string[]).includes(s)) {
      return { stage: s as DealStage };
    }
    return {};
  },
  component: DealsPage,
});

function DealsPage() {
  const { stage } = Route.useSearch();
  return (
    <ProtectedRoute>
      {(session) => (
        <div className="min-h-screen bg-background">
          <Sidebar activeKey="deals" userEmail={session.user.email ?? ""} />
          <AppMain>
            <DealsList currentUserId={session.user.id} initialStage={stage ?? null} />
          </AppMain>
        </div>
      )}
    </ProtectedRoute>
  );
}
