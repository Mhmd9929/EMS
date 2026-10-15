import type { Metadata } from "next";
import Link from "next/link";
import { Download, Scale } from "lucide-react";
import { requireAuth, requirePermission, can } from "@/server/auth/context";
import { BALANCE_SORTS, listBalances } from "@/server/services/leave/balance.service";
import { listLeaveTypes } from "@/server/services/leave/config.service";
import { listDepartmentOptions } from "@/server/services/org.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { todayInTimeZone } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { AdjustBalanceDialog } from "./adjust-dialog";

export const metadata: Metadata = { title: "Leave balances" };

export default async function BalancesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, ["leave.balance.adjust", "leave.report.read"]);
  const sp = await searchParams;
  const thisYear = todayInTimeZone(ctx.timezone).getUTCFullYear();
  const year = Number(first(sp.year)) || thisYear;
  const types = (await listLeaveTypes(ctx)).filter((t) => t.accrualMethod !== "NONE");
  const typeId = types.find((t) => t.id === first(sp.type))?.id ?? types[0]?.id;
  if (!typeId) return <EmptyState icon={Scale} title="No leave types with balances" />;
  const params = parseListParams(sp, { sortable: BALANCE_SORTS, defaultSort: "name" });
  const [result, departments] = await Promise.all([listBalances(ctx, params, { year, leaveTypeId: typeId, departmentId: first(sp.department) }), listDepartmentOptions(ctx)]);
  const canAdjust = can(ctx, "leave.balance.adjust");
  const path = "/leave/balances";
  const n = (v: number) => (v === 0 ? <span className="text-muted-foreground">0</span> : v);
  return (
    <>
      <PageHeader
        title="Leave balances"
        description="Per employee and leave type. Manual adjustments require a reason and are audited."
        actions={
          can(ctx, "leave.report.read") && (
            <>
              <a href={`/api/leave/balances?year=${year}&format=xlsx`} className={buttonVariants({ variant: "outline" })}>
                <Download aria-hidden /> Excel
              </a>
              <a href={`/api/leave/balances?year=${year}&format=csv`} className={buttonVariants({ variant: "outline" })}>
                <Download aria-hidden /> CSV
              </a>
            </>
          )
        }
      />
      <Toolbar>
        <SearchInput placeholder="Search employee…" />
        <FilterSelect param="type" label="Leave type" options={types.map((t) => ({ value: t.id, label: t.name }))} />
        <FilterSelect param="year" label="Year" options={[thisYear - 1, thisYear, thisYear + 1].map((y) => ({ value: String(y), label: String(y) }))} />
        <FilterSelect param="department" label="Department" options={departments} />
        <ClearFilters params={["q", "department"]} />
      </Toolbar>
      <p className="text-muted-foreground mb-2 text-sm">
        Showing <strong className="text-foreground">{result.type.name}</strong> for {year}.
      </p>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Employee" sortKey="name" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
              <TableHead className="text-right">Entitled</TableHead>
              <TableHead className="text-right">Accrued</TableHead>
              <TableHead className="hidden text-right md:table-cell">Carried fwd</TableHead>
              <TableHead className="hidden text-right md:table-cell">Adjusted</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Expired</TableHead>
              <TableHead className="text-right">Taken</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <SortHeader label="Available" sortKey="available" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} className="text-right" />
              {canAdjust && (
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map(({ employee: e, balance: b }) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Link href={`/employees/${e.id}?tab=leave`} className="font-medium hover:underline">
                    {e.preferredName || e.firstName} {e.lastName}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {e.employeeNumber} · {e.department?.name ?? "—"}
                  </p>
                </TableCell>
                <TableCell className="text-right tabular-nums">{b.eligible ? b.entitled : <span className="text-muted-foreground text-xs">not eligible</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{n(b.accrued)}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{n(b.carriedForward)}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{n(b.adjustments)}</TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">{n(b.expired)}</TableCell>
                <TableCell className="text-right tabular-nums">{n(b.taken)}</TableCell>
                <TableCell className="text-right tabular-nums">{n(b.pending)}</TableCell>
                <TableCell className={`text-right font-semibold tabular-nums ${b.available < 0 ? "text-destructive" : ""}`}>{b.available}</TableCell>
                {canAdjust && (
                  <TableCell className="text-right">
                    {e.id !== ctx.employeeId && <AdjustBalanceDialog employeeId={e.id} employeeName={`${e.preferredName || e.firstName} ${e.lastName}`} leaveTypeId={typeId} leaveTypeName={result.type.name} year={year} />}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Pagination {...result} pathname={path} searchParams={sp} />
    </>
  );
}
