import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ideLogo from "@/assets/ide-logo.png";

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  const handleMicrosoft = async () => {
    setError(null);
    setSsoLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/yfirlit`,
        scopes: "email openid profile",
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setSsoLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(t.login.wrongCredentials);
      setSubmitting(false);
      return;
    }

    // Activation gate
    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!profile || !profile.active) {
        await supabase.auth.signOut();
        setError(t.login.notActivated);
        setSubmitting(false);
        return;
      }
    }

    navigate({ to: "/yfirlit" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-card p-8">
        <div className="mb-6 flex items-center justify-center rounded-md bg-ide-navy p-6">
          <img src={ideLogo} alt={t.brand.name} className="h-12 w-auto" />
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {/* Staff (Microsoft SSO) */}
        <div className="space-y-2">
          <div>
            <div className="text-sm font-semibold text-foreground">{t.login.staffTitle}</div>
            <div className="text-xs text-muted-foreground">{t.login.staffSubtitle}</div>
          </div>
          <Button
            type="button"
            onClick={handleMicrosoft}
            disabled={ssoLoading}
            variant="outline"
            className="w-full"
          >
            <MicrosoftIcon className="mr-2 h-4 w-4" />
            {t.login.microsoftButton}
          </Button>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {t.login.or}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Guest (email + password) */}
        <div className="mb-3">
          <div className="text-sm font-semibold text-foreground">{t.login.guestTitle}</div>
          <div className="text-xs text-muted-foreground">{t.login.guestSubtitle}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t.login.email}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t.login.password}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-ide-navy text-ide-navy-foreground hover:bg-ide-navy-hover"
          >
            {submitting ? t.login.submitting : t.login.submit}
          </Button>
        </form>
      </div>
    </div>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 23 23" className={className} aria-hidden>
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  );
}
