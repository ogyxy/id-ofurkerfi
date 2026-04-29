import type { ReactNode } from "react";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";

interface AppMainProps {
  children: ReactNode;
}

/**
 * Main content wrapper that adjusts its left margin based on the
 * desktop sidebar's collapsed state.
 */
export function AppMain({ children }: AppMainProps) {
  const [collapsed] = useSidebarCollapsed();
  return (
    <main
      className={`px-4 pb-8 pt-20 md:px-8 md:pt-8 transition-[margin] duration-200 ${
        collapsed ? "md:ml-14" : "md:ml-60"
      }`}
    >
      {children}
    </main>
  );
}
