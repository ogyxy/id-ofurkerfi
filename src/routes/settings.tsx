import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { AppMain } from "@/components/AppMain";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { t } from "@/lib/sala_translations_is";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { canManageUsers } from "@/lib/role";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { UsersTab } from "@/components/settings/UsersTab";
import { AppTab } from "@/components/settings/AppTab";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${t.settings.pageTitle} — ${t.brand.name}` }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <ProtectedRoute>
      {(session) => (
        <div className="min-h-screen bg-background">
          <Sidebar activeKey="settings" userEmail={session.user.email ?? ""} />
          <AppMain>
            <SettingsContent />
          </AppMain>
        </div>
      )}
    </ProtectedRoute>
  );
}

function SettingsContent() {
  const profile = useCurrentProfile();
  const isAdmin = canManageUsers(profile.role);
  const [tab, setTab] = useState("profile");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">{t.settings.pageTitle}</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="profile">{t.settings.tabProfile}</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">{t.settings.tabUsers}</TabsTrigger>}
          {isAdmin && <TabsTrigger value="app">{t.settings.tabApp}</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="users" className="mt-6">
            <UsersTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="app" className="mt-6">
            <AppTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
