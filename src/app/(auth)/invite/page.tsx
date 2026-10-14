import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getInvite } from "@/server/services/user.service";
import { acceptInviteAction } from "@/server/actions/auth.actions";
import { Alert } from "@/components/ui/alert";
import { SetPasswordForm } from "../set-password-form";

export const metadata: Metadata = { title: "Activate account" };

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const t = await getTranslations("auth");
  const invite = await getInvite(token);
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t("inviteTitle")}</h1>
        {invite && (
          <p className="text-muted-foreground text-sm">
            {invite.name} · {invite.email}
          </p>
        )}
      </div>
      {invite ? (
        <SetPasswordForm
          token={token}
          action={acceptInviteAction}
          labels={{ password: t("newPassword"), confirm: t("confirmPassword"), hint: t("passwordHint"), submit: t("setPassword") }}
        />
      ) : (
        <Alert variant="error">{t("invalidLink")} Ask HR to send a new invitation.</Alert>
      )}
    </div>
  );
}
