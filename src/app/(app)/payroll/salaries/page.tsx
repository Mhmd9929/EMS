import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { SALARY_SORTS, listSalaries } from "@/server/services/payroll/salary.service";
import { listDepartmentOptions } from "@/server/services/org.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/payroll/badges";

export const metadata: Metadata = { title: "Salaries" };

export default async function SalariesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "payroll.salary.read");
  const sp = await searchParams;
  const params = parseListParams(sp, { sortable: SALARY_SORTS, defaultSort: "name" });
  const pathname = "/payroll/salaries";
  const [result, departments] = await Promise.all([
    listSalaries(ctx, params, { departmentId: first(sp.department), missing: first(sp.missing) === "1" }),
    listDepartmentOptions(ctx),
  ]);
  const sort = (label: string, key: (typeof SALARY_SORTS)[number], className?: string) => (
    <SortHeader label={label} sortKey={key} current={params.sort} dir={params.dir} pathname={pathname} searchParams={sp} className={className} />
  );
  return (
    <>
      <PageHeader title="Salaries" description="Current monthly salary per employee. Open an employee's Payroll tab to see the history or schedule a change." />
      <Toolbar>
        <SearchInput placeholder="Search name or number…" />
        <FilterSelect param="department" label="Department" options={departments} />
        <FilterSelect param="missing" label="Salary" options={[{ value: "1", label: "No salary yet" }]} />
        <ClearFilters params={["q", "department", "missing"]} />
      </Toolbar>
      {result.items.length === 0 ? (
        <EmptyState icon={Wallet} title="No employees match" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                {sort("Employee", "name")}
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="hidden lg:table-cell">Grade</TableHead>
                <TableHead className="hidden text-end sm:table-cell">Basic</TableHead>
                {sort("Gross / month", "gross", "text-end")}
                <TableHead className="hidden md:table-cell">Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map(({ employee: e, ...r }) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link href={`/employees/${e.id}?tab=payroll`} className="font-medium hover:underline">
                      {e.preferredName || e.firstName} {e.lastName}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {e.employeeNumber} · {e.position?.title ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{e.department?.name ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{e.position?.grade ?? "—"}</TableCell>
                  <TableCell className="hidden text-end sm:table-cell">{r.effectiveFrom ? <Money minor={r.basic} currency={ctx.currency} /> : "—"}</TableCell>
                  <TableCell className="text-end font-medium">{r.effectiveFrom ? <Money minor={r.gross} currency={ctx.currency} /> : <Badge variant="destructive">No salary</Badge>}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {r.effectiveFrom ? formatDate(r.effectiveFrom) : "—"}
                    {r.scheduled > 0 && (
                      <Badge variant="warning" className="ms-2">
                        change scheduled
                      </Badge>
                    )}
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
