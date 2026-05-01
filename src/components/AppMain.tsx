import type { ReactNode } from "react";

interface AppMainProps {
  children: ReactNode;
}

/**
 * Main content wrapper. The desktop sidebar is always collapsed (icon strip)
 * and expands as an overlay on hover, so the main content uses a fixed
 * narrow left margin.
 */
export function AppMain({ children }: AppMainProps) {
  return (
    <main className="px-4 pb-8 pt-20 md:px-8 md:pt-8 md:ml-14">
      {children}
    </main>
  );
}
