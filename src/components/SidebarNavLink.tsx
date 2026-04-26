import { cn } from "@/lib/utils";

interface SidebarNavLinkProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function SidebarNavLink({ label, active, onClick }: SidebarNavLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center border-l-2 border-transparent px-4 py-2 text-left text-sm text-white/80 transition-colors hover:bg-ide-navy-hover hover:text-white",
        active && "border-l-white bg-ide-navy-hover text-white",
      )}
    >
      {label}
    </button>
  );
}
