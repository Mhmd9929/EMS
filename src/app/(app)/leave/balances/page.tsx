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
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("leave"))("meta.balances") };
}

export default async function BalancesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, ["leave.balance.adjust", "leave.report.read"]);
  const sp = await searchParams;
  const thisYear = todayInTimeZone(ctx.timezone).getUTCFullYear();
  const year = Number(first(sp.year)) || thisYear;
  const [t, tl, tc] = await Promise.all([getTranslations("leave.balances"), getTranslations("leave"), getTranslations("common")]);
  const types = (await listLeaveTypes(ctx)).filter((lt) => lt.accrualMethod !== "NONE");
  const typeId = types.find((lt) => lt.id === first(sp.type))?.id ?? types[0]?.id;
  if (!typeId) return <EmptyState icon={Scale} title={t("emptyTypes")} />;
  const params = parseListParams(sp, { sortable: BALANCE_SORTS, defaultSort: "name" });
  const [result, departments] = await Promise.all([listBalances(ctx, params, { year, leaveTypeId: typeId, departmentId: first(sp.department) }), listDepartmentOptions(ctx)]);
  const canAdjust = can(ctx, "leave.balance.adjust");
  const path = "/leave/balances";
  const n = (v: number) => (v === 0 ? <span className="text-muted-foreground">0</span> : v);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          can(ctx, "leave.report.read") && (
            <>
              <a href={`/api/leave/balances?year=${year}&format=xlsx`} className={buttonVariants({ variant: "outline" })}>
                <Download aria-hidden /> {t("excel")}
              </a>
              <a href={`/api/leave/balances?year=${year}&format=csv`} className={buttonVariants({ variant: "outline" })}>
                <Download aria-hidden /> {t("csv")}
              </a>
            </>
          )
        }
      />
      <Toolbar>
        <SearchInput placeholder={t("searchEmployee")} />
        <FilterSelect param="type" label={tl("columns.leaveType")} options={types.map((lt) => ({ value: lt.id, label: lt.name }))} />
        <FilterSelect param="year" label={tc("year")} options={[thisYear - 1, thisYear, thisYear + 1].map((y) => ({ value: String(y), label: String(y) }))} />
        <FilterSelect param="department" label={tc("department")} options={departments} />
        <ClearFilters params={["q", "department"]} />
      </Toolbar>
      <p className="text-muted-foreground mb-2 text-sm">
        {t.rich("showing", { type: result.type.name, year: String(year), strong: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
      </p>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label={tc("employee")} sortKey="name" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} />
              <TableHead className="text-end">{t("entitled")}</TableHead>
              <TableHead className="text-end">{t("accrued")}</TableHead>
              <TableHead className="hidden text-end md:table-cell">{t("carriedFwd")}</TableHead>
              <TableHead className="hidden text-end md:table-cell">{t("adjusted")}</TableHead>
              <TableHead className="hidden text-end lg:table-cell">{t("expired")}</TableHead>
              <TableHead className="text-end">{t("taken")}</TableHead>
              <TableHead className="text-end">{t("pending")}</TableHead>
              <SortHeader label={t("available")} sortKey="available" current={params.sort} dir={params.dir} pathname={path} searchParams={sp} className="text-end" />
              {canAdjust && (
                <TableHead>
                  <span className="sr-only">{tc("actions")}</span>
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
                <TableCell className="text-end tabular-nums">{b.eligible ? b.entitled : <span className="text-muted-foreground text-xs">{t("notEligible")}</span>}</TableCell>
                <TableCell className="text-end tabular-nums">{n(b.accrued)}</TableCell>
                <TableCell className="hidden text-end tabular-nums md:table-cell">{n(b.carriedForward)}</TableCell>
                <TableCell className="hidden text-end tabular-nums md:table-cell">{n(b.adjustments)}</TableCell>
                <TableCell className="hidden text-end tabular-nums lg:table-cell">{n(b.expired)}</TableCell>
                <TableCell className="text-end tabular-nums">{n(b.taken)}</TableCell>
                <TableCell className="text-end tabular-nums">{n(b.pending)}</TableCell>
                <TableCell className={`text-end font-semibold tabular-nums ${b.available < 0 ? "text-destructive" : ""}`}>{b.available}</TableCell>
                {canAdjust && (
                  <TableCell className="text-end">
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
