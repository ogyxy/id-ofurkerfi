import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarNavLinkProps {
  label: string;
  to?: string;
  active?: boolean;
  onClick?: () => void;
  icon?: LucideIcon;
  collapsed?: boolean;
}

const baseClasses =
  "flex w-full items-center gap-3 border-l-2 border-transparent px-4 py-2 text-left text-sm text-white/80 transition-colors hover:bg-ide-navy-hover hover:text-white";
const activeClasses = "border-l-white bg-ide-navy-hover text-white";
const collapsedClasses = "justify-center px-0 gap-0";

export function SidebarNavLink({
  label,
  to,
  active,
  onClick,
  icon: Icon,
  collapsed,
}: SidebarNavLinkProps) {
  const className = cn(
    baseClasses,
    active && activeClasses,
    collapsed && collapsedClasses,
  );
  const content = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {!collapsed && <span className="truncate">{label}</span>}
    </>
  );

  if (to) {
    return (
      <Link to={to} onClick={onClick} className={className} title={collapsed ? label : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      title={collapsed ? label : undefined}
    >
      {content}
    </button>
  );
}
