import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuth } from "@/server/auth/context";
import { ChangePasswordForm } from "@/components/change-password-form";
import { logoutAction } from "@/server/actions/auth.actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Change password" };

/** Forced first-login password change. */
export default async function ForcedChangePasswordPage() {
  const ctx = await requireAuth({ allowPendingPasswordChange: true });
  if (!ctx.mustChangePassword) redirect("/dashboard");
  const t = await getTranslations("auth");
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t("forcedChangeTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("forcedChangeSubtitle")}</p>
      </div>
      <ChangePasswordForm
        labels={{ current: t("currentPassword"), password: t("newPassword"), confirm: t("confirmPassword"), hint: t("passwordHint"), submit: t("setPassword") }}
      />
      <form action={logoutAction}>
        <Button variant="link" className="w-full" type="submit">
          Sign out
        </Button>
      </form>
    </div>
  );
}
