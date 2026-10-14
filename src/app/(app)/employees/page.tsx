import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus, Upload, Users } from "lucide-react";
import { requireAuth, requirePermission, can } from "@/server/auth/context";
import { EMPLOYEE_SORTS, listEmployees } from "@/server/services/employee.service";
import { listDepartmentOptions, listLocationOptions } from "@/server/services/org.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { employeeStatusSchema, employmentTypeSchema } from "@/lib/validation/employee";
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { hrefWith } from "@/components/data-table/url";
import { Avatar } from "@/components/ui/avatar";
import { EmployeeStatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, ["employee.read.all", "employee.read.team"]);
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: EMPLOYEE_SORTS, defaultSort: "name" });
  const filters = {
    status: employeeStatusSchema.safeParse(first(sp.status)).data,
    employmentType: employmentTypeSchema.safeParse(first(sp.type)).data,
    departmentId: first(sp.department),
    locationId: first(sp.location),
  };
  const [result, departments, locations] = await Promise.all([listEmployees(ctx, params, filters), listDepartmentOptions(ctx), listLocationOptions(ctx)]);
  const isTeamOnly = !can(ctx, "employee.read.all");
  const pathname = "/employees";
  const sort = (label: string, key: (typeof EMPLOYEE_SORTS)[number], className?: string) => (
    <SortHeader label={label} sortKey={key} current={params.sort} dir={params.dir} pathname={pathname} searchParams={sp} className={className} />
  );
  const hasFilters = !!(params.q || filters.status || filters.employmentType || filters.departmentId || filters.locationId);

  return (
    <>
      <PageHeader
        title={isTeamOnly ? "My team" : "Employees"}
        description={isTeamOnly ? "Your direct and indirect reports." : "Everyone in the company, including former employees."}
        actions={
          <>
            {can(ctx, "employee.export") && (
              <a href={hrefWith("/api/employees/export", sp, { page: undefined, pageSize: undefined, sort: undefined, dir: undefined })} className={buttonVariants({ variant: "outline" })}>
                <Download aria-hidden /> Export CSV
              </a>
            )}
            {can(ctx, "employee.import") && (
              <Link href="/employees/import" className={buttonVariants({ variant: "outline" })}>
                <Upload aria-hidden /> Import
              </Link>
            )}
            {can(ctx, "employee.create") && (
              <Link href="/employees/new" className={buttonVariants()}>
                <Plus aria-hidden /> Add employee
              </Link>
            )}
          </>
        }
      />
      <Toolbar>
        <SearchInput placeholder="Search name, email, number…" />
        <FilterSelect param="status" label="Status" options={EMPLOYEE_STATUSES.map((s) => ({ value: s.value, label: s.label }))} />
        <FilterSelect param="department" label="Department" options={departments} />
        <FilterSelect param="location" label="Location" options={locations} />
        <FilterSelect param="type" label="Type" options={EMPLOYMENT_TYPES.map((s) => ({ value: s.value, label: s.label }))} />
        <ClearFilters params={["q", "status", "department", "location", "type"]} />
      </Toolbar>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? "No employees match your filters" : "No employees yet"}
          description={hasFilters ? "Try a different search or clear the filters." : isTeamOnly ? "Nobody reports to you yet." : "Add your first employee or import a CSV."}
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                {sort("Name", "name")}
                {sort("No.", "number", "hidden md:table-cell")}
                {sort("Department", "department", "hidden lg:table-cell")}
                <TableHead className="hidden lg:table-cell">Manager</TableHead>
                <TableHead className="hidden xl:table-cell">Type</TableHead>
                {sort("Joined", "joinDate", "hidden sm:table-cell")}
                {sort("Status", "status")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link href={`/employees/${e.id}`} className="flex items-center gap-3">
                      <Avatar employeeId={e.id} hasPhoto={!!e.photoPath} firstName={e.firstName} lastName={e.lastName} size={32} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium hover:underline">
                          {e.preferredName || e.firstName} {e.lastName}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">{e.position?.title ?? e.workEmail}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">{e.employeeNumber}</TableCell>
                  <TableCell className="hidden lg:table-cell">{e.department?.name ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{e.manager ? `${e.manager.preferredName || e.manager.firstName} ${e.manager.lastName}` : "—"}</TableCell>
                  <TableCell className="hidden xl:table-cell">{labelOf(EMPLOYMENT_TYPES, e.employmentType)}</TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">{formatDate(e.joinDate)}</TableCell>
                  <TableCell>
                    <EmployeeStatusBadge status={e.status} lastWorkingDay={e.lastWorkingDay} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pagination {...result} pathname={pathname} searchParams={sp} />
    </>
  );
}
