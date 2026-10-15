import type { Metadata } from "next";
import Link from "next/link";
import { Banknote } from "lucide-react";
import { requireAuth, requirePermission, can } from "@/server/auth/context";
import { listRuns } from "@/server/services/payroll/run.service";
import { listDepartmentOptions, listLocationOptions } from "@/server/services/org.service";
import { first, type SearchParams } from "@/lib/list-params";
import { periodLabel } from "@/lib/payroll/calc";
import { formatDateTime, todayInTimeZone } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterSelect, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { Money, RUN_STATUSES, RunStatusBadge } from "@/components/payroll/badges";
import { NewRunDialog } from "./new-run-dialog";

export const metadata: Metadata = { title: "Payroll runs" };

export default async function PayrollRunsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, ["payroll.run.manage", "payroll.run.approve"]);
  const sp = await searchParams;
  const today = todayInTimeZone(ctx.timezone);
  const year = Number(first(sp.year)) || today.getUTCFullYear();
  const status = RUN_STATUSES.some((s) => s.value === first(sp.status)) ? (first(sp.status) as never) : undefined;
  const [runs, departments, locations] = await Promise.all([listRuns(ctx, { year, status }), listDepartmentOptions(ctx), listLocationOptions(ctx)]);
  const defaultPeriod = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  return (
    <>
      <PageHeader
        title="Payroll runs"
        description="Draft → Calculated → Under review → Approved (by a second person) → Released. Released runs are locked."
        actions={can(ctx, "payroll.run.manage") && <NewRunDialog defaultPeriod={defaultPeriod} departments={departments} locations={locations} />}
      />
      <Toolbar>
        <FilterSelect param="year" label="Year" defaultValue={String(year)} options={[0, 1, 2].map((d) => String(today.getUTCFullYear() - d)).map((y) => ({ value: y, label: `Year ${y}` }))} />
        <FilterSelect param="status" label="Status" options={RUN_STATUSES} />
      </Toolbar>
      {runs.length === 0 ? (
        <EmptyState icon={Banknote} title={`No payroll runs in ${year}`} description="Create a run for a month to calculate salaries." />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-end">Employees</TableHead>
                <TableHead className="hidden text-end md:table-cell">Gross</TableHead>
                <TableHead className="text-end">Net</TableHead>
                <TableHead className="hidden lg:table-cell">Last change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/payroll/runs/${r.id}`} className="font-medium hover:underline">
                      {periodLabel(r.period)}
                    </Link>
                    {r.reopenCount > 0 && <span className="text-muted-foreground ms-2 text-xs">reopened ×{r.reopenCount}</span>}
                  </TableCell>
                  <TableCell className="text-sm">{r.scopeLabel}</TableCell>
                  <TableCell>
                    <RunStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{r.status === "DRAFT" ? "—" : r.employeeCount}</TableCell>
                  <TableCell className="hidden text-end md:table-cell">{r.status === "DRAFT" ? "—" : <Money minor={r.totalGross} currency={r.currency} />}</TableCell>
                  <TableCell className="text-end font-medium">{r.status === "DRAFT" ? "—" : <Money minor={r.totalNet} currency={r.currency} showCode />}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">{formatDateTime(r.updatedAt, ctx.timezone)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
