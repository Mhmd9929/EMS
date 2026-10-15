import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins } from "lucide-react";
import { requireAuth, requirePermission } from "@/server/auth/context";
import { leaversWithoutSettlement, listSettlements } from "@/server/services/payroll/settlement.service";
import { first, type SearchParams } from "@/lib/list-params";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/payroll/money";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterSelect, Toolbar } from "@/components/data-table/toolbar";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/payroll/badges";
import { ApproveSettlementButton } from "@/components/payroll/approve-settlement-button";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Final settlements" };

const STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "APPROVED", label: "Approved" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export default async function SettlementsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, "payroll.settlement.manage");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s.value === first(sp.status))?.value;
  const [settlements, pending] = await Promise.all([listSettlements(ctx, status), leaversWithoutSettlement(ctx)]);
  return (
    <>
      <PageHeader title="Final settlements" description="End-of-service: unpaid salary + leave encashment + gratuity + other earnings − deductions. Prepared by one person, approved by another." />
      {pending.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Leavers without a settlement</CardTitle>
            <CardDescription>Open the employee&apos;s Payroll tab to prepare one.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {pending.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium">
                      {e.firstName} {e.lastName}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      ({e.employeeNumber}) · last day {formatDate(e.lastWorkingDay)}
                      {e.terminationReason && ` · ${e.terminationReason}`}
                    </span>
                  </span>
                  <Link href={`/employees/${e.id}?tab=payroll`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                    Prepare settlement
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Toolbar>
        <FilterSelect param="status" label="Status" options={[...STATUSES]} />
      </Toolbar>
      {settlements.length === 0 ? (
        <EmptyState icon={HandCoins} title="No final settlements" />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="hidden md:table-cell">Last day</TableHead>
                <TableHead className="hidden text-end lg:table-cell">Gratuity</TableHead>
                <TableHead className="hidden text-end lg:table-cell">Leave encashment</TableHead>
                <TableHead className="text-end">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/employees/${s.employee.id}?tab=payroll`} className="font-medium hover:underline">
                      {s.employee.firstName} {s.employee.lastName}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {s.employee.employeeNumber} · {s.employee.department?.name ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(s.lastWorkingDay)}</TableCell>
                  <TableCell className="hidden text-end lg:table-cell">
                    <Money minor={s.gratuity} currency={ctx.currency} />
                  </TableCell>
                  <TableCell className="hidden text-end lg:table-cell">
                    <Money minor={s.leaveEncashment} currency={ctx.currency} />
                  </TableCell>
                  <TableCell className="text-end font-medium">
                    <Money minor={s.total} currency={ctx.currency} showCode />
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === "APPROVED" ? "success" : s.status === "DRAFT" ? "warning" : "secondary"}>{STATUSES.find((x) => x.value === s.status)?.label}</Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    {s.status === "DRAFT" && s.createdById !== ctx.userId && (
                      <ApproveSettlementButton settlementId={s.id} employeeId={s.employee.id} name={`${s.employee.firstName} ${s.employee.lastName}`} total={formatMoney(s.total, ctx.currency, { withCode: true })} />
                    )}
                    {s.status === "DRAFT" && s.createdById === ctx.userId && <span className="text-muted-foreground text-xs">Awaiting a second approver</span>}
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
