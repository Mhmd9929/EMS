import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { isResetTokenValid } from "@/server/services/user.service";
import { resetPasswordAction } from "@/server/actions/auth.actions";
import { Alert } from "@/components/ui/alert";
import { SetPasswordForm } from "../set-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const t = await getTranslations("auth");
  const valid = await isResetTokenValid(token);
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t("resetTitle")}</h1>
      {valid ? (
        <SetPasswordForm
          token={token}
          action={resetPasswordAction}
          labels={{ password: t("newPassword"), confirm: t("confirmPassword"), hint: t("passwordHint"), submit: t("setPassword") }}
        />
      ) : (
        <>
          <Alert variant="error">{t("invalidLink")}</Alert>
          <Link href="/forgot-password" className="text-link text-sm hover:underline">
            {t("forgotTitle")}
          </Link>
        </>
      )}
    </div>
  );
}
