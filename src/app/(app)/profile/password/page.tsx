import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireAuth } from "@/server/auth/context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ changed?: string }> }) {
  const { changed } = await searchParams;
  await requireAuth();
  const t = await getTranslations("auth");
  return (
    <>
      <PageHeader title="Change password" description="Changing your password signs you out on every other device." />
      {changed && <Alert variant="success" className="mb-4 max-w-md">Password changed. Other sessions have been signed out.</Alert>}
      <Card className="max-w-md">
        <CardContent>
          <ChangePasswordForm
            redirectTo="/profile/password?changed=1"
            labels={{ current: t("currentPassword"), password: t("newPassword"), confirm: t("confirmPassword"), hint: t("passwordHint"), submit: t("setPassword") }}
          />
        </CardContent>
      </Card>
    </>
  );
}
