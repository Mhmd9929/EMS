import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus, Upload, Users } from "lucide-react";
import { requireAuth, requirePermission, can } from "@/server/auth/context";
import { EMPLOYEE_SORTS, listEmployees } from "@/server/services/employee.service";
import { listDepartmentOptions, listLocationOptions } from "@/server/services/org.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { employeeStatusSchema, employmentTypeSchema } from "@/lib/validation/employee";
import { getTranslations } from "next-intl/server";
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from "@/lib/constants";
import { getFormat } from "@/server/i18n";
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

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("employees"))("meta.list") };
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, ["employee.read.all", "employee.read.team"]);
  const [t, tc, te, f] = await Promise.all([getTranslations("employees"), getTranslations("common"), getTranslations("enums"), getFormat()]);
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
        title={isTeamOnly ? t("list.titleTeam") : t("list.title")}
        description={isTeamOnly ? t("list.descriptionTeam") : t("list.description")}
        actions={
          <>
            {can(ctx, "employee.export") && (
              <a href={hrefWith("/api/employees/export", sp, { page: undefined, pageSize: undefined, sort: undefined, dir: undefined })} className={buttonVariants({ variant: "outline" })}>
                <Download aria-hidden /> {t("list.exportCsv")}
              </a>
            )}
            {can(ctx, "employee.import") && (
              <Link href="/employees/import" className={buttonVariants({ variant: "outline" })}>
                <Upload aria-hidden /> {t("list.import")}
              </Link>
            )}
            {can(ctx, "employee.create") && (
              <Link href="/employees/new" className={buttonVariants()}>
                <Plus aria-hidden /> {t("list.add")}
              </Link>
            )}
          </>
        }
      />
      <Toolbar>
        <SearchInput placeholder={t("list.searchPlaceholder")} />
        <FilterSelect param="status" label={tc("status")} options={EMPLOYEE_STATUSES.map((s) => ({ value: s.value, label: te(`employeeStatus.${s.value}`) }))} />
        <FilterSelect param="department" label={tc("department")} options={departments} />
        <FilterSelect param="location" label={tc("location")} options={locations} />
        <FilterSelect param="type" label={tc("type")} options={EMPLOYMENT_TYPES.map((s) => ({ value: s.value, label: te(`employmentType.${s.value}`) }))} />
        <ClearFilters params={["q", "status", "department", "location", "type"]} />
      </Toolbar>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? t("list.emptyFilteredTitle") : t("list.emptyTitle")}
          description={hasFilters ? t("list.emptyFilteredHint") : isTeamOnly ? t("list.emptyTeamHint") : t("list.emptyHint")}
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                {sort(tc("name"), "name")}
                {sort(t("list.columns.number"), "number", "hidden md:table-cell")}
                {sort(tc("department"), "department", "hidden lg:table-cell")}
                <TableHead className="hidden lg:table-cell">{tc("manager")}</TableHead>
                <TableHead className="hidden xl:table-cell">{tc("type")}</TableHead>
                {sort(t("list.columns.joined"), "joinDate", "hidden sm:table-cell")}
                {sort(tc("status"), "status")}
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
                        <span className="text-muted-foreground block truncate text-xs">{e.position?.title ?? <span dir="ltr">{e.workEmail}</span>}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">
                    <span dir="ltr">{e.employeeNumber}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{e.department?.name ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{e.manager ? `${e.manager.preferredName || e.manager.firstName} ${e.manager.lastName}` : "—"}</TableCell>
                  <TableCell className="hidden xl:table-cell">{te(`employmentType.${e.employmentType}`)}</TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">{f.date(e.joinDate)}</TableCell>
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
