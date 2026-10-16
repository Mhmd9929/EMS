import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { leaveTakenReport } from "@/server/services/leave/report.service";
import { listLeaveTypes } from "@/server/services/leave/config.service";
import { listDepartmentOptions } from "@/server/services/org.service";
import { first, type SearchParams } from "@/lib/list-params";
import { parseDateOnly, todayInTimeZone, toDateInput } from "@/lib/dates";
import { getTranslations } from "next-intl/server";
import { getFormat } from "@/server/i18n";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClearFilters, FilterSelect, Toolbar } from "@/components/data-table/toolbar";
import { DateRangeFilter } from "@/app/(app)/admin/audit/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { hrefWith } from "@/components/data-table/url";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("leave"))("meta.reports") };
}

export default async function LeaveReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "leave.report.read");
  const sp = await searchParams;
  const today = todayInTimeZone(ctx.timezone);
  const from = parseDateOnly(first(sp.from)) ?? new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const to = parseDateOnly(first(sp.to)) ?? new Date(Date.UTC(today.getUTCFullYear(), 11, 31));
  const filters = { from, to, departmentId: first(sp.department), leaveTypeId: first(sp.type) };
  const [report, types, departments] = await Promise.all([leaveTakenReport(ctx, filters), listLeaveTypes(ctx, { includeInactive: true }), listDepartmentOptions(ctx)]);
  const exportQuery = (format: string, kind: string) => hrefWith("/api/leave/report", {}, { from: toDateInput(from), to: toDateInput(to), department: filters.departmentId, type: filters.leaveTypeId, format, kind });
  const max = Math.max(1, ...Object.values(report.totalsByType));
  const [t, tc, f] = await Promise.all([getTranslations("leave.reports"), getTranslations("common"), getFormat()]);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description", { from: f.date(from), to: f.date(to) })}
        actions={
          <>
            <a href={exportQuery("xlsx", "summary")} className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden /> {t("summaryExcel")}
            </a>
            <a href={exportQuery("xlsx", "detail")} className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden /> {t("detailExcel")}
            </a>
            <a href={exportQuery("csv", "detail")} className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden /> {t("detailCsv")}
            </a>
          </>
        }
      />
      <Toolbar>
        <DateRangeFilter />
        <FilterSelect param="department" label={tc("department")} options={departments} />
        <FilterSelect param="type" label={tc("type")} options={types.map((lt) => ({ value: lt.id, label: lt.name }))} />
        <ClearFilters params={["from", "to", "department", "type"]} />
      </Toolbar>
      {report.rows.length === 0 ? (
        <EmptyState title={t("emptyTitle")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">{t("byType", { days: tc("days", { count: report.grandTotal }) })}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {report.types.map((lt) => (
                  <li key={lt.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{lt.name}</span>
                      <span className="tabular-nums">{report.totalsByType[lt.name]}</span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
                      <div className="h-full rounded-full" style={{ width: `${(report.totalsByType[lt.name] / max) * 100}%`, backgroundColor: lt.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="py-0 lg:col-span-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("department")}</TableHead>
                  {report.types.map((lt) => (
                    <TableHead key={lt.name} className="text-end">
                      {lt.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-end">{tc("total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.departments.map((d) => (
                  <TableRow key={d}>
                    <TableCell className="font-medium">{d}</TableCell>
                    {report.types.map((lt) => (
                      <TableCell key={lt.name} className="text-end tabular-nums">
                        {report.rows.find((r) => r.department === d && r.leaveType === lt.name)?.days ?? <span className="text-muted-foreground">–</span>}
                      </TableCell>
                    ))}
                    <TableCell className="text-end font-semibold tabular-nums">{report.totalsByDept[d]}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>{tc("total")}</TableCell>
                  {report.types.map((lt) => (
                    <TableCell key={lt.name} className="text-end tabular-nums">
                      {report.totalsByType[lt.name]}
                    </TableCell>
                  ))}
                  <TableCell className="text-end tabular-nums">{report.grandTotal}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}
