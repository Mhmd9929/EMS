import type { Metadata } from "next";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { getCompany } from "@/server/services/admin.service";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanySettingsForm, LogoUpload } from "./settings-form";

export const metadata: Metadata = { title: "Company settings" };

export default async function SettingsPage() {
  const ctx = await requireAuth();
  requirePermission(ctx, "company.settings.manage");
  const company = await getCompany(ctx);
  return (
    <>
      <PageHeader title="Company settings" description="Identity, locale and payroll calendar defaults. Changes are audited." />
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
            <CardTitle className="text-base">Logo</CardTitle>
            <CardDescription>Shown in the navigation and on payslips. PNG, JPG or WebP up to 2 MB.</CardDescription>
          </CardHeader>
          <CardContent>
            <LogoUpload hasLogo={!!company.logoPath} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
