import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAuthContext } from "@/server/auth/context";
import { enabledSsoProviders } from "@/server/auth";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./login-form";
import { ssoLoginAction } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (await getAuthContext()) redirect("/dashboard");
  const t = await getTranslations("auth");
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t("signInTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("signInSubtitle")}</p>
      </div>
      {sp.expired && <Alert variant="warning">{t("sessionExpired")}</Alert>}
      {sp.reset && <Alert variant="success">{t("passwordResetDone")}</Alert>}
      {sp.error === "sso_denied" && <Alert variant="error">{t("ssoDenied")}</Alert>}
      <LoginForm
        callbackUrl={sp.callbackUrl}
        labels={{ email: t("email"), password: t("password"), signIn: t("signIn"), signingIn: t("signingIn"), forgot: t("forgot") }}
      />
      {enabledSsoProviders.length > 0 && (
        <div className="space-y-3">
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span className="bg-border h-px flex-1" />
            {t("orContinueWith")}
            <span className="bg-border h-px flex-1" />
          </div>
          {enabledSsoProviders.map((p) => (
            <form key={p.id} action={ssoLoginAction}>
              <input type="hidden" name="provider" value={p.id} />
              <input type="hidden" name="callbackUrl" value={sp.callbackUrl ?? ""} />
              <Button type="submit" variant="outline" className="w-full">
                {p.name}
              </Button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
