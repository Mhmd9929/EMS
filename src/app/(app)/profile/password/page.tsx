import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireAuth } from "@/server/auth/context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Alert } from "@/components/ui/alert";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("metaChange") };
}

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ changed?: string }> }) {
  const { changed } = await searchParams;
  await requireAuth();
  const t = await getTranslations("auth");
  return (
    <>
      <PageHeader title={t("forcedChangeTitle")} description={t("changePasswordDescription")} />
      {changed && <Alert variant="success" className="mb-4 max-w-md">{t("passwordChangedOthers")}</Alert>}
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
