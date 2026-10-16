import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { requireAuth } from "@/server/auth/context";
import { getEmployeeDetail } from "@/server/services/employee.service";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PhotoUpload } from "@/components/employees/photo-upload";
import { EmergencyContacts } from "@/components/employees/emergency-contacts";
import { getFormat } from "@/server/i18n";
import { formatIban } from "@/lib/iban";
import { ProfileForm } from "./profile-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("profile"))("meta.title") };
}

export default async function ProfilePage() {
  const ctx = await requireAuth();
  if (!ctx.employeeId) redirect("/profile/password");
  const e = await getEmployeeDetail(ctx, ctx.employeeId);
  const t = await getTranslations("profile");
  const tEnums = await getTranslations("enums");
  const f = await getFormat();
  const rows: [string, React.ReactNode][] = [
    [t("fields.employeeNumber"), <span key="n" dir="ltr" className="font-mono">{e.employeeNumber}</span>],
    [t("fields.workEmail"), <span key="w" dir="ltr">{e.workEmail}</span>],
    [t("fields.position"), e.position?.title],
    [t("fields.department"), e.department?.name],
    [t("fields.manager"), e.manager ? `${e.manager.preferredName || e.manager.firstName} ${e.manager.lastName}` : null],
    [t("fields.location"), e.location?.name],
    [t("fields.employmentType"), tEnums(`employmentType.${e.employmentType}`)],
    [t("fields.joinDate"), f.date(e.joinDate)],
    [t("fields.dateOfBirth"), f.date(e.dateOfBirth)],
    [t("fields.gender"), e.gender ? tEnums(`gender.${e.gender}`) : null],
    [t("fields.nationality"), e.nationality],
    [
      t("fields.emiratesId"),
      e.emiratesIdNumber ? (
        <span key="e">
          <span dir="ltr">{e.emiratesIdNumber}</span> {t("expiry", { date: f.date(e.emiratesIdExpiry) })}
        </span>
      ) : null,
    ],
    [
      t("fields.passport"),
      e.passportNumber ? (
        <span key="p">
          <span dir="ltr">{e.passportNumber}</span> {t("expiry", { date: f.date(e.passportExpiry) })}
        </span>
      ) : null,
    ],
    [t("fields.bank"), e.bankName],
    [t("fields.iban"), e.iban ? <span key="i" dir="ltr" className="font-mono">{formatIban(e.iban)}</span> : null],
  ];
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link href="/profile/password" className={buttonVariants({ variant: "outline" })}>
            <KeyRound aria-hidden /> {t("changePassword")}
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 text-center">
              <Avatar employeeId={e.id} hasPhoto={!!e.photoPath} version={e.photoPath} firstName={e.firstName} lastName={e.lastName} size={96} />
              <div>
                <p className="font-semibold">
                  {e.preferredName || e.firstName} {e.lastName}
                </p>
                <p className="text-muted-foreground text-sm">{e.position?.title}</p>
              </div>
              <PhotoUpload employeeId={e.id} hasPhoto={!!e.photoPath} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("employmentRecord")}</CardTitle>
              <CardDescription>{t("maintainedByHr")}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground shrink-0">{k}</dt>
                    <dd className="truncate text-end">{v ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("personalInformation")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm
                defaults={{
                  preferredName: e.preferredName ?? "",
                  personalEmail: e.personalEmail ?? "",
                  phone: e.phone ?? "",
                  address: e.address ?? "",
                  maritalStatus: e.maritalStatus ?? "",
                }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("emergencyContacts")}</CardTitle>
              <CardDescription>{t("emergencyContactsDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <EmergencyContacts employeeId={e.id} contacts={e.emergencyContacts} canManage />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
