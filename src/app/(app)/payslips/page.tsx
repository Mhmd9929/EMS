import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { requireAuth } from "@/server/auth/context";
import { listPayslips } from "@/server/services/payroll/payslip.service";
import { first, type SearchParams } from "@/lib/list-params";
import { periodLabel } from "@/lib/payroll/calc";
import { formatDate, todayInTimeZone } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterSelect, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/payroll/badges";

export const metadata: Metadata = { title: "My payslips" };

export default async function MyPayslipsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const thisYear = todayInTimeZone(ctx.timezone).getUTCFullYear();
  const year = Number(first(sp.year)) || thisYear;
  const payslips = ctx.employeeId ? await listPayslips(ctx, ctx.employeeId, year) : [];
  return (
    <>
      <PageHeader title="My payslips" description="Payslips appear here once payroll for the month has been released." />
      <Toolbar>
        <FilterSelect param="year" label="Year" defaultValue={String(year)} options={[0, 1, 2].map((d) => String(thisYear - d)).map((y) => ({ value: y, label: `Year ${y}` }))} />
      </Toolbar>
      {!ctx.employeeId ? (
        <EmptyState icon={FileText} title="No employee record" description="Your user account is not linked to an employee, so there are no payslips to show." />
      ) : payslips.length === 0 ? (
        <EmptyState icon={FileText} title={`No payslips for ${year}`} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="hidden sm:table-cell">Released</TableHead>
                <TableHead className="hidden text-end md:table-cell">Gross</TableHead>
                <TableHead className="hidden text-end md:table-cell">Deductions</TableHead>
                <TableHead className="text-end">Net pay</TableHead>
                <TableHead className="sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/payslips/${p.id}`} className="font-medium hover:underline">
                      {periodLabel(p.period)}
                    </Link>
                    <p className="text-muted-foreground text-xs">{p.number}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{formatDate(p.releasedAt)}</TableCell>
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
                    <a href={`/api/payslips/${p.id}/pdf?download=1`} className={buttonVariants({ variant: "ghost", size: "sm" })} aria-label={`Download ${periodLabel(p.period)} payslip PDF`}>
                      <Download aria-hidden /> PDF
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
