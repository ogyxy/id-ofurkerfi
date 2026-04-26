import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/LoginForm";
import { t } from "@/lib/sala_translations_is";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [{ title: t.login.title }],
  }),
  component: LoginPage,
});

function LoginPage() {
  return <LoginForm />;
}
