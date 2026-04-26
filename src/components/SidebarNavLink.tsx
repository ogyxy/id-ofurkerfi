import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface SidebarNavLinkProps {
  label: string;
  to?: string;
  active?: boolean;
  onClick?: () => void;
}

const baseClasses =
  "flex w-full items-center border-l-2 border-transparent px-4 py-2 text-left text-sm text-white/80 transition-colors hover:bg-ide-navy-hover hover:text-white";
const activeClasses = "border-l-white bg-ide-navy-hover text-white";

export function SidebarNavLink({ label, to, active, onClick }: SidebarNavLinkProps) {
  if (to) {
    return (
      <Link
        to={to}
        onClick={onClick}
        className={cn(baseClasses, active && activeClasses)}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(baseClasses, active && activeClasses)}
    >
      {label}
    </button>
  );
}
