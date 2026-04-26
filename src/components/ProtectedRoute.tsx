import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: (session: Session) => React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        navigate({ to: "/login" });
      }
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
      if (!data.session) {
        navigate({ to: "/login" });
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!checked || !session) {
    return null;
  }

  return <>{children(session)}</>;
}
