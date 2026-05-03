import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { CurrentProfileContext, type CurrentProfile } from "@/hooks/useCurrentProfile";
import type { AppRole } from "@/lib/role";
import { t } from "@/lib/sala_translations_is";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: (session: Session) => React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async (s: Session): Promise<CurrentProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, name, avatar_url, role, active")
        .eq("id", s.user.id)
        .maybeSingle();
      if (error) return null;
      if (!data || !data.active) return null;
      const isOauth = !!s.user.app_metadata?.provider && s.user.app_metadata.provider !== "email";
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        avatar_url: data.avatar_url,
        role: data.role as AppRole,
        active: data.active,
        isOauth,
      };
    };

    const handle = async (s: Session | null) => {
      if (!s) {
        if (cancelled) return;
        setSession(null);
        setProfile(null);
        setChecked(true);
        navigate({ to: "/login" });
        return;
      }
      const p = await loadProfile(s);
      if (cancelled) return;
      if (!p) {
        await supabase.auth.signOut();
        toast.error(t.login.notActivated);
        setSession(null);
        setProfile(null);
        setChecked(true);
        navigate({ to: "/login" });
        return;
      }
      setSession(s);
      setProfile(p);
      setChecked(true);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void handle(newSession);
    });

    supabase.auth.getSession().then(({ data }) => {
      void handle(data.session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!checked || !session || !profile) {
    return null;
  }

  return (
    <CurrentProfileContext.Provider value={profile}>
      {children(session)}
    </CurrentProfileContext.Provider>
  );
}
