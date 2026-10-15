import type { Metadata } from "next";
import { notFound, forbidden } from "next/navigation";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { getEmployeeForEdit, listEmployeeOptions } from "@/server/services/employee.service";
import { listDepartmentOptions, listLocationOptions, listPositionOptions } from "@/server/services/org.service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { PageHeader } from "@/components/page-header";
import { EmployeeForm } from "@/components/employees/employee-form";

export const metadata: Metadata = { title: "Edit employee" };

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
  return (
    <>
      <PageHeader title={`Edit ${employee.firstName} ${employee.lastName}`} description={`${employee.employeeNumber} · changes are recorded in the audit log`} />
      <EmployeeForm employee={employee} options={{ departments, positions, locations, managers }} />
    </>
  );
}
