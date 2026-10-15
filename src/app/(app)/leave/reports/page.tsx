import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { leaveTakenReport } from "@/server/services/leave/report.service";
import { listLeaveTypes } from "@/server/services/leave/config.service";
import { listDepartmentOptions } from "@/server/services/org.service";
import { first, type SearchParams } from "@/lib/list-params";
import { formatDate, parseDateOnly, todayInTimeZone, toDateInput } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClearFilters, FilterSelect, Toolbar } from "@/components/data-table/toolbar";
import { DateRangeFilter } from "@/app/(app)/admin/audit/date-range-filter";
import { EmptyState } from "@/components/empty-state";
import { hrefWith } from "@/components/data-table/url";

export const metadata: Metadata = { title: "Leave reports" };

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
  return (
    <>
      <PageHeader
        title="Leave reports"
        description={`Approved leave taken between ${formatDate(from)} and ${formatDate(to)} (days are counted inside the period only).`}
        actions={
          <>
            <a href={exportQuery("xlsx", "summary")} className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden /> Summary (Excel)
            </a>
            <a href={exportQuery("xlsx", "detail")} className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden /> Detail (Excel)
            </a>
            <a href={exportQuery("csv", "detail")} className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden /> Detail (CSV)
            </a>
          </>
        }
      />
      <Toolbar>
        <DateRangeFilter />
        <FilterSelect param="department" label="Department" options={departments} />
        <FilterSelect param="type" label="Type" options={types.map((t) => ({ value: t.id, label: t.name }))} />
        <ClearFilters params={["from", "to", "department", "type"]} />
      </Toolbar>
      {report.rows.length === 0 ? (
        <EmptyState title="No leave taken in this period" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">By leave type · {report.grandTotal} days</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {report.types.map((t) => (
                  <li key={t.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{t.name}</span>
                      <span className="tabular-nums">{report.totalsByType[t.name]}</span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
                      <div className="h-full rounded-full" style={{ width: `${(report.totalsByType[t.name] / max) * 100}%`, backgroundColor: t.color }} />
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
                  <TableHead>Department</TableHead>
                  {report.types.map((t) => (
                    <TableHead key={t.name} className="text-right">
                      {t.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.departments.map((d) => (
                  <TableRow key={d}>
                    <TableCell className="font-medium">{d}</TableCell>
                    {report.types.map((t) => (
                      <TableCell key={t.name} className="text-right tabular-nums">
                        {report.rows.find((r) => r.department === d && r.leaveType === t.name)?.days ?? <span className="text-muted-foreground">–</span>}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold tabular-nums">{report.totalsByDept[d]}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Total</TableCell>
                  {report.types.map((t) => (
                    <TableCell key={t.name} className="text-right tabular-nums">
                      {report.totalsByType[t.name]}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">{report.grandTotal}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}
