import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/sala_translations_is";
import { SidebarNavLink } from "./SidebarNavLink";
import ideLogo from "@/assets/ide-logo.png";

interface SidebarProps {
  activeKey:
    | "dashboard"
    | "companies"
    | "deals"
    | "designs"
    | "products"
    | "purchaseOrders";
  userEmail: string;
}

const navItems: Array<{
  key: SidebarProps["activeKey"];
  label: string;
  to?: string;
}> = [
  { key: "dashboard", label: t.nav.dashboard },
  { key: "companies", label: t.nav.companies, to: "/companies" },
  { key: "deals", label: t.nav.deals },
  { key: "designs", label: t.nav.designs },
  { key: "products", label: t.nav.products },
  { key: "purchaseOrders", label: t.nav.purchaseOrders },
];

export function Sidebar({ activeKey, userEmail }: SidebarProps) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const drawerContent = (
    <>
      <div className="flex items-center justify-between px-6 py-6">
        <img
          src={ideLogo}
          alt={t.brand.name}
          className="h-16 w-auto object-contain"
        />
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label={t.nav.signOut}
          className="text-white/80 hover:text-white md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => (
          <SidebarNavLink
            key={item.key}
            label={item.label}
            to={item.to}
            active={item.key === activeKey}
            onClick={() => setMobileOpen(false)}
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
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-ide-navy px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Menu"
          className="text-white"
        >
          <Menu className="h-6 w-6" />
        </button>
        <img
          src={ideLogo}
          alt={t.brand.name}
          className="h-7 w-auto object-contain"
        />
        <span className="w-6" aria-hidden />
      </header>

      {/* Mobile drawer + backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col bg-ide-navy text-white shadow-xl transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {drawerContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-ide-navy text-white md:flex">
        {drawerContent}
      </aside>
    </>
  );
}
