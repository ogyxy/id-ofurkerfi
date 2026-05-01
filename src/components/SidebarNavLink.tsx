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
  "flex w-full items-center gap-3 border-l-2 border-transparent py-2 pl-5 pr-4 text-left text-sm text-white/80 transition-colors hover:bg-ide-navy-hover hover:text-white";
const activeClasses = "border-l-white bg-ide-navy-hover text-white";

export function SidebarNavLink({
  label,
  to,
  active,
  onClick,
  icon: Icon,
  collapsed,
}: SidebarNavLinkProps) {
  const className = cn(baseClasses, active && activeClasses);
  const content = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span
        className={cn(
          "truncate transition-opacity duration-150",
          collapsed && "pointer-events-none opacity-0",
        )}
      >
        {label}
      </span>
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
