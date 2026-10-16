import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { getCompany } from "@/server/services/admin.service";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanySettingsForm, LogoUpload } from "./settings-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("admin"))("settings.title") };
}

export default async function SettingsPage() {
  const ctx = await requireAuth();
  requirePermission(ctx, "company.settings.manage");
  const company = await getCompany(ctx);
  const t = await getTranslations("admin.settings");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CompanySettingsForm
            company={{
              name: company.name,
              legalName: company.legalName ?? "",
              addressLine1: company.addressLine1 ?? "",
              addressLine2: company.addressLine2 ?? "",
              city: company.city ?? "",
              emirate: company.emirate ?? "",
              country: company.country,
              phone: company.phone ?? "",
              email: company.email ?? "",
              website: company.website ?? "",
              tradeLicenseNumber: company.tradeLicenseNumber ?? "",
              currency: company.currency,
              timezone: company.timezone,
              workWeek: company.workWeek,
              fiscalYearStartMonth: company.fiscalYearStartMonth,
              employeeNumberPrefix: company.employeeNumberPrefix,
              employeeNumberPadding: company.employeeNumberPadding,
            }}
          />
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">{t("logo")}</CardTitle>
            <CardDescription>{t("logoDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LogoUpload hasLogo={!!company.logoPath} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
