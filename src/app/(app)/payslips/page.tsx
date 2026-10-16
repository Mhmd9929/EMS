import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { requireAuth } from "@/server/auth/context";
import { listPayslips } from "@/server/services/payroll/payslip.service";
import { first, type SearchParams } from "@/lib/list-params";
import { todayInTimeZone } from "@/lib/dates";
import { getFormat } from "@/server/i18n";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterSelect, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/payroll/badges";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("payslips"))("meta.list") };
}

export default async function MyPayslipsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const thisYear = todayInTimeZone(ctx.timezone).getUTCFullYear();
  const year = Number(first(sp.year)) || thisYear;
  const [t, f] = await Promise.all([getTranslations("payslips.list"), getFormat()]);
  const payslips = ctx.employeeId ? await listPayslips(ctx, ctx.employeeId, year) : [];
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Toolbar>
        <FilterSelect param="year" label={t("year")} defaultValue={String(year)} options={[0, 1, 2].map((d) => String(thisYear - d)).map((y) => ({ value: y, label: t("yearOption", { year: y }) }))} />
      </Toolbar>
      {!ctx.employeeId ? (
        <EmptyState icon={FileText} title={t("noEmployeeTitle")} description={t("noEmployeeDescription")} />
      ) : payslips.length === 0 ? (
        <EmptyState icon={FileText} title={t("empty", { year: String(year) })} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("month")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("released")}</TableHead>
                <TableHead className="hidden text-end md:table-cell">{t("gross")}</TableHead>
                <TableHead className="hidden text-end md:table-cell">{t("deductions")}</TableHead>
                <TableHead className="text-end">{t("netPay")}</TableHead>
                <TableHead className="sr-only">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/payslips/${p.id}`} className="font-medium hover:underline">
                      {f.month(p.period)}
                    </Link>
                    <p className="text-muted-foreground text-xs" dir="ltr">
                      {p.number}
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{f.date(p.releasedAt)}</TableCell>
                  <TableCell className="hidden text-end md:table-cell">
                    <Money minor={p.gross} currency={p.currency} />
                  </TableCell>
                  <TableCell className="hidden text-end md:table-cell">
                    <Money minor={p.deductions} currency={p.currency} />
                  </TableCell>
                  <TableCell className="text-end font-medium">
                    <Money minor={p.net} currency={p.currency} showCode />
                  </TableCell>
                  <TableCell className="text-end">
                    <a href={`/api/payslips/${p.id}/pdf?download=1`} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={t("downloadLabel", { month: f.month(p.period) })}>
                      <Download aria-hidden /> {t("pdf")}
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
