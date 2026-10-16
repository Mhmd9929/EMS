import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { listEmployeeOptions } from "@/server/services/employee.service";
import { listDepartmentOptions, listLocationOptions, listPositionOptions } from "@/server/services/org.service";
import { getCompany } from "@/server/services/admin.service";
import { formatEmployeeNumber } from "@/lib/employee-number";
import { PageHeader } from "@/components/page-header";
import { EmployeeForm } from "@/components/employees/employee-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("employees"))("meta.add") };
}

export default async function NewEmployeePage() {
  const ctx = await requireAuth();
  requirePermission(ctx, "employee.create");
  const [departments, positions, locations, managers, company] = await Promise.all([
    listDepartmentOptions(ctx),
    listPositionOptions(ctx),
    listLocationOptions(ctx),
    listEmployeeOptions(ctx),
    getCompany(ctx),
  ]);
  const t = await getTranslations("employees");
  return (
    <>
      <PageHeader title={t("new.title")} description={t("new.description")} />
      <EmployeeForm
        options={{ departments, positions, locations, managers }}
        nextNumberHint={formatEmployeeNumber(company.employeeNumberPrefix, company.employeeNumberNextSeq, company.employeeNumberPadding)}
      />
    </>
  );
}
