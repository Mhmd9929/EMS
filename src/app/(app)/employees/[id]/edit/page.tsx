import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, forbidden } from "next/navigation";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { getEmployeeForEdit, listEmployeeOptions } from "@/server/services/employee.service";
import { listDepartmentOptions, listLocationOptions, listPositionOptions } from "@/server/services/org.service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { PageHeader } from "@/components/page-header";
import { EmployeeForm } from "@/components/employees/employee-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("employees"))("meta.edit") };
}

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "employee.update");
  const { id } = await params;
  const employee = await getEmployeeForEdit(ctx, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    if (e instanceof ForbiddenError) forbidden();
    throw e;
  });
  const [departments, positions, locations, managers] = await Promise.all([
    listDepartmentOptions(ctx),
    listPositionOptions(ctx),
    listLocationOptions(ctx),
    listEmployeeOptions(ctx),
  ]);
  const t = await getTranslations("employees");
  return (
    <>
      <PageHeader
        title={t("edit.title", { name: `${employee.firstName} ${employee.lastName}` })}
        description={t("edit.description", { number: employee.employeeNumber })}
      />
      <EmployeeForm employee={employee} options={{ departments, positions, locations, managers }} />
    </>
  );
}
