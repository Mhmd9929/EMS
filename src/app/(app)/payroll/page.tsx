import type { Metadata } from "next";
import type { PayrollRunStatus } from "@prisma/client";
import Link from "next/link";
import { Banknote } from "lucide-react";
import { requireAuth, requirePermission, can } from "@/server/auth/context";
import { listRuns } from "@/server/services/payroll/run.service";
import { listDepartmentOptions, listLocationOptions } from "@/server/services/org.service";
import { first, type SearchParams } from "@/lib/list-params";
import { todayInTimeZone } from "@/lib/dates";
import { runScopeText } from "@/lib/payroll/issues";
import { getFormat } from "@/server/i18n";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterSelect, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { Money, RUN_STATUS_VALUES, RunStatusBadge } from "@/components/payroll/badges";
import { NewRunDialog } from "./new-run-dialog";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("payroll"))("meta.runs") };
}

export default async function PayrollRunsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, ["payroll.run.manage", "payroll.run.approve"]);
  const sp = await searchParams;
  const today = todayInTimeZone(ctx.timezone);
  const year = Number(first(sp.year)) || today.getUTCFullYear();
  const status = RUN_STATUS_VALUES.some((s) => s === first(sp.status)) ? (first(sp.status) as never) : undefined;
  const [t, te, f] = await Promise.all([getTranslations("payroll"), getTranslations("enums"), getFormat()]);
  const [runs, departments, locations] = await Promise.all([listRuns(ctx, { year, status }), listDepartmentOptions(ctx), listLocationOptions(ctx)]);
  const defaultPeriod = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  return (
    <>
      <PageHeader
        title={t("runs.title")}
        description={t("runs.description")}
        actions={can(ctx, "payroll.run.manage") && <NewRunDialog defaultPeriod={defaultPeriod} departments={departments} locations={locations} />}
      />
      <Toolbar>
        <FilterSelect param="year" label={t("runs.year")} defaultValue={String(year)} options={[0, 1, 2].map((d) => String(today.getUTCFullYear() - d)).map((y) => ({ value: y, label: t("runs.yearOption", { year: y }) }))} />
        <FilterSelect param="status" label={t("runs.status")} options={RUN_STATUS_VALUES.map((v) => ({ value: v, label: te(`runStatus.${v as PayrollRunStatus}`) }))} />
      </Toolbar>
      {runs.length === 0 ? (
        <EmptyState icon={Banknote} title={t("runs.emptyTitle", { year: String(year) })} description={t("runs.emptyDescription")} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("runs.period")}</TableHead>
                <TableHead>{t("runs.scope")}</TableHead>
                <TableHead>{t("runs.status")}</TableHead>
                <TableHead className="text-end">{t("runs.employees")}</TableHead>
                <TableHead className="hidden text-end md:table-cell">{t("runs.gross")}</TableHead>
                <TableHead className="text-end">{t("runs.net")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("runs.lastChange")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/payroll/runs/${r.id}`} className="font-medium hover:underline">
                      {f.month(r.period)}
                    </Link>
                    {r.reopenCount > 0 && <span className="text-muted-foreground ms-2 text-xs">{t("runs.reopened", { count: r.reopenCount })}</span>}
                  </TableCell>
                  <TableCell className="text-sm">{runScopeText(r, t)}</TableCell>
                  <TableCell>
                    <RunStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{r.status === "DRAFT" ? "—" : r.employeeCount}</TableCell>
                  <TableCell className="hidden text-end md:table-cell">{r.status === "DRAFT" ? "—" : <Money minor={r.totalGross} currency={r.currency} />}</TableCell>
                  <TableCell className="text-end font-medium">{r.status === "DRAFT" ? "—" : <Money minor={r.totalNet} currency={r.currency} showCode />}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">{f.dateTime(r.updatedAt, ctx.timezone)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
