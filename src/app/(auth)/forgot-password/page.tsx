import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t("forgotTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("forgotSubtitle")}</p>
      </div>
      <ForgotForm labels={{ email: t("email"), send: t("sendLink"), back: t("backToLogin") }} />
    </div>
  );
}
