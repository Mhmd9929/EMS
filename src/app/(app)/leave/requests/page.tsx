import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { REQUEST_SORTS, listLeaveRequests } from "@/server/services/leave/request.service";
import { listLeaveTypes } from "@/server/services/leave/config.service";
import { listDepartmentOptions } from "@/server/services/org.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { parseDateOnly } from "@/lib/dates";
import { getTranslations } from "next-intl/server";
import { getFormat } from "@/server/i18n";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { DateRangeFilter } from "@/app/(app)/admin/audit/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { LEAVE_STATUSES, LEAVE_STATUS_VALUES, LeaveStatusBadge, LeaveTypeLabel } from "@/components/leave/leave-badges";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("leave"))("meta.requests") };
}

export default async function AllRequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, ["leave.request.read.all", "leave.approve.team"]);
  const scope = ctx.permissions.has("leave.request.read.all") ? "all" : "team";
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: REQUEST_SORTS, defaultSort: "startDate", defaultDir: "desc" });
  const status = LEAVE_STATUSES.some((s) => s.value === first(sp.status)) ? (first(sp.status) as never) : undefined;
  const [result, types, departments] = await Promise.all([
    listLeaveRequests(ctx, scope, params, {
      status,
      leaveTypeId: first(sp.type),
      departmentId: first(sp.department),
      from: parseDateOnly(first(sp.from)) ?? undefined,
      to: parseDateOnly(first(sp.to)) ?? undefined,
    }),
    listLeaveTypes(ctx, { includeInactive: true }),
    scope === "all" ? listDepartmentOptions(ctx) : [],
  ]);
  const path = "/leave/requests";
  const [t, tl, tc, te, f] = await Promise.all([getTranslations("leave.requests"), getTranslations("leave"), getTranslations("common"), getTranslations("enums"), getFormat()]);
  const statusOptions = LEAVE_STATUS_VALUES.map((v) => ({ value: v, label: te(`leaveStatus.${v}`) }));
  return (
    <>
      <PageHeader title={scope === "all" ? t("titleAll") : t("titleTeam")} description={scope === "all" ? t("descriptionAll") : t("descriptionTeam")} />
      <Toolbar>
        <SearchInput placeholder={t("searchEmployee")} />
        <FilterSelect param="status" label={tc("status")} options={statusOptions} />
        <FilterSelect param="type" label={tc("type")} options={types.map((lt) => ({ value: lt.id, label: lt.name }))} />
        {scope === "all" && <FilterSelect param="department" label={tc("department")} options={departments} />}
        <DateRangeFilter />
        <ClearFilters params={["q", "status", "type", "department", "from", "to"]} />
      </Toolbar>
      {result.items.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("emptyTitle")} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label={tc("employee")} sortKey="employee" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <TableHead>{tc("type")}</TableHead>
                <SortHeader label={tl("columns.dates")} sortKey="startDate" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <SortHeader label={tl("columns.days")} sortKey="days" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
                <TableHead>{tc("status")}</TableHead>
                <SortHeader label={tl("columns.requested")} sortKey="createdAt" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} className="hidden lg:table-cell" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/leave/requests/${r.id}`} className="flex items-center gap-2">
                      <Avatar employeeId={r.employee.id} hasPhoto={!!r.employee.photoPath} firstName={r.employee.firstName} lastName={r.employee.lastName} size={28} />
                      <span>
                        <span className="block font-medium hover:underline">
                          {r.employee.preferredName || r.employee.firstName} {r.employee.lastName}
                        </span>
                        <span className="text-muted-foreground block text-xs">{r.employee.department?.name ?? "—"}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <LeaveTypeLabel name={r.leaveType.name} color={r.leaveType.color} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {f.date(r.startDate)}
                    {r.endDate.getTime() !== r.startDate.getTime() && ` – ${f.date(r.endDate)}`}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.days}</TableCell>
                  <TableCell>
                    <LeaveStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">{f.date(r.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pagination {...result} pathname={path} searchParams={sp} />
    </>
  );
}
