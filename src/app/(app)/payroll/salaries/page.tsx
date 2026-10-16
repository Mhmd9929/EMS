import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { SALARY_SORTS, listSalaries } from "@/server/services/payroll/salary.service";
import { listDepartmentOptions } from "@/server/services/org.service";
import { first, parseListParams, type SearchParams } from "@/lib/list-params";
import { getFormat } from "@/server/i18n";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortHeader } from "@/components/data-table/sort-header";
import { Pagination } from "@/components/data-table/pagination";
import { ClearFilters, FilterSelect, SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/payroll/badges";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("payroll"))("meta.salaries") };
}

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
  const [t, f] = await Promise.all([getTranslations("payroll.salaries"), getFormat()]);
  const sort = (label: string, key: (typeof SALARY_SORTS)[number], className?: string) => (
    <SortHeader label={label} sortKey={key} current={params.sort} dir={params.dir} pathname={pathname} searchParams={sp} className={className} />
  );
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Toolbar>
        <SearchInput placeholder={t("searchPlaceholder")} />
        <FilterSelect param="department" label={t("department")} options={departments} />
        <FilterSelect param="missing" label={t("salary")} options={[{ value: "1", label: t("noSalaryYet") }]} />
        <ClearFilters params={["q", "department", "missing"]} />
      </Toolbar>
      {result.items.length === 0 ? (
        <EmptyState icon={Wallet} title={t("noMatches")} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                {sort(t("employee"), "name")}
                <TableHead className="hidden md:table-cell">{t("department")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("grade")}</TableHead>
                <TableHead className="hidden text-end sm:table-cell">{t("basic")}</TableHead>
                {sort(t("grossMonth"), "gross", "text-end")}
                <TableHead className="hidden md:table-cell">{t("since")}</TableHead>
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
                      <span dir="ltr">{e.employeeNumber}</span> · {e.position?.title ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{e.department?.name ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{e.position?.grade ?? "—"}</TableCell>
                  <TableCell className="hidden text-end sm:table-cell">{r.effectiveFrom ? <Money minor={r.basic} currency={ctx.currency} /> : "—"}</TableCell>
                  <TableCell className="text-end font-medium">{r.effectiveFrom ? <Money minor={r.gross} currency={ctx.currency} /> : <Badge variant="destructive">{t("noSalary")}</Badge>}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {r.effectiveFrom ? f.date(r.effectiveFrom) : "—"}
                    {r.scheduled > 0 && (
                      <Badge variant="warning" className="ms-2">
                        {t("changeScheduled")}
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
