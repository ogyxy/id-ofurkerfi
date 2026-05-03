import { createContext, useContext } from "react";
import type { AppRole } from "@/lib/role";

export interface CurrentProfile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: AppRole;
  active: boolean;
  isOauth: boolean; // true when signed in via SSO (e.g. Microsoft/Azure)
}

export const CurrentProfileContext = createContext<CurrentProfile | null>(null);

export function useCurrentProfile(): CurrentProfile {
  const v = useContext(CurrentProfileContext);
  if (!v) {
    // Fail loud so we don't silently render financial UI to wrong role.
    throw new Error("useCurrentProfile must be used inside <ProtectedRoute>");
  }
  return v;
}

export function useCurrentRole(): AppRole {
  return useCurrentProfile().role;
}
