import type { Metadata } from "next";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { listEmployeeOptions } from "@/server/services/employee.service";
import { listDepartmentOptions, listLocationOptions, listPositionOptions } from "@/server/services/org.service";
import { getCompany } from "@/server/services/admin.service";
import { formatEmployeeNumber } from "@/lib/employee-number";
import { PageHeader } from "@/components/page-header";
import { EmployeeForm } from "@/components/employees/employee-form";

export const metadata: Metadata = { title: "Add employee" };

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
  return (
    <>
      <PageHeader title="Add employee" description="Creates the HR record and a login account (Employee role)." />
      <EmployeeForm
        options={{ departments, positions, locations, managers }}
        nextNumberHint={formatEmployeeNumber(company.employeeNumberPrefix, company.employeeNumberNextSeq, company.employeeNumberPadding)}
      />
    </>
  );
}
