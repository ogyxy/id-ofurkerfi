import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/sala_translations_is";
import { SidebarNavLink } from "./SidebarNavLink";

interface SidebarProps {
  activeKey:
    | "dashboard"
    | "companies"
    | "contacts"
    | "deals"
    | "designs"
    | "quotes"
    | "purchaseOrders"
    | "activities";
  userEmail: string;
}

const navItems: Array<{ key: SidebarProps["activeKey"]; label: string }> = [
  { key: "dashboard", label: t.nav.dashboard },
  { key: "companies", label: t.nav.companies },
  { key: "contacts", label: t.nav.contacts },
  { key: "deals", label: t.nav.deals },
  { key: "designs", label: t.nav.designs },
  { key: "quotes", label: t.nav.quotes },
  { key: "purchaseOrders", label: t.nav.purchaseOrders },
  { key: "activities", label: t.nav.activities },
];

export function Sidebar({ activeKey, userEmail }: SidebarProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <aside className="fixed inset-y-0 left-0 flex w-60 flex-col bg-ide-navy text-white">
      <div className="px-6 py-6">
        <span className="text-2xl font-semibold tracking-wide text-white">
          {t.brand.short}
        </span>
      </div>

      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <SidebarNavLink
            key={item.key}
            label={item.label}
            active={item.key === activeKey}
          />
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="mb-2 truncate text-xs text-white/60" title={userEmail}>
          {userEmail}
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-sm text-white/80 hover:text-white hover:underline"
        >
          {t.nav.signOut}
        </button>
      </div>
    </aside>
  );
}
