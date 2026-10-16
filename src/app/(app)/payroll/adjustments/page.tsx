import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { requireAuth, requirePermission, can } from "@/server/auth/context";
import { adjustmentFormOptions, listAdjustments } from "@/server/services/payroll/adjustment.service";
import { first, type SearchParams } from "@/lib/list-params";
import { PERIOD_RE } from "@/lib/validation/payroll";
import { todayInTimeZone } from "@/lib/dates";
import { getFormat } from "@/server/i18n";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/payroll/badges";
import { AdjustmentDialog, DeleteAdjustmentButton, PeriodPicker } from "./adjustment-dialog";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("payroll"))("meta.adjustments") };
}

export default async function AdjustmentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "payroll.salary.manage");
  const sp = await searchParams;
  const today = todayInTimeZone(ctx.timezone);
  const current = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const period = PERIOD_RE.test(first(sp.period) ?? "") ? first(sp.period)! : current;
  const [rows, options] = await Promise.all([listAdjustments(ctx, period), adjustmentFormOptions(ctx)]);
  const [t, f] = await Promise.all([getTranslations("payroll.adjustments"), getFormat()]);
  const earnings = rows.filter((r) => r.component.kind === "EARNING").reduce((a, r) => a + Number(r.amount), 0);
  const deductions = rows.filter((r) => r.component.kind === "DEDUCTION").reduce((a, r) => a + Number(r.amount), 0);
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={can(ctx, "payroll.salary.manage") && <AdjustmentDialog period={period} employees={options.employees} components={options.components} />}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <PeriodPicker value={period} />
        <p className="text-muted-foreground text-sm">
          {t("summary", { period: f.month(period), count: rows.length })} · +<Money minor={earnings} currency={ctx.currency} /> · −<Money minor={deductions} currency={ctx.currency} />
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={SlidersHorizontal} title={t("empty", { period: f.month(period) })} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("component")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("descriptionCol")}</TableHead>
                <TableHead className="text-end">{t("amount")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("added")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="sr-only">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/employees/${a.employee.id}?tab=payroll`} className="font-medium hover:underline">
                      {a.employee.preferredName || a.employee.firstName} {a.employee.lastName}
                    </Link>
                    <p className="text-muted-foreground text-xs" dir="ltr">{a.employee.employeeNumber}</p>
                  </TableCell>
                  <TableCell>{a.component.name}</TableCell>
                  <TableCell className="hidden max-w-xs truncate md:table-cell" title={a.description}>
                    {a.description}
                  </TableCell>
                  <TableCell className="text-end">
                    {a.component.kind === "DEDUCTION" ? "−" : "+"}
                    <Money minor={a.amount} currency={ctx.currency} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{f.date(a.createdAt)}</TableCell>
                  <TableCell>{a.run ? <Badge variant="success">{t("paid")}</Badge> : <Badge variant="secondary">{t("pending")}</Badge>}</TableCell>
                  <TableCell className="text-end">{!a.run && <DeleteAdjustmentButton id={a.id} label={t("rowLabel", { component: a.component.name, name: `${a.employee.firstName} ${a.employee.lastName}` })} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
