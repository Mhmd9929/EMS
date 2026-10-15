import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CircleAlert, FileText } from "lucide-react";
import { requireAuth, requirePermission, can } from "@/server/auth/context";
import { getRunEntry } from "@/server/services/payroll/run.service";
import { NotFoundError } from "@/server/errors";
import { periodLabel, variancePct } from "@/lib/payroll/calc";
import { formatDate } from "@/lib/dates";
import { maskIban } from "@/lib/iban";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money, RunStatusBadge } from "@/components/payroll/badges";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pay breakdown" };

export default async function EntryPage({ params }: { params: Promise<{ id: string; entryId: string }> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, ["payroll.run.manage", "payroll.run.approve", "payroll.export"]);
  const { id, entryId } = await params;
  const e = await getRunEntry(ctx, entryId).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    throw err;
  });
  if (e.runId !== id) notFound();
  const cur = e.run.currency;
  const earnings = e.lines.filter((l) => l.kind === "EARNING");
  const deductions = e.lines.filter((l) => l.kind === "DEDUCTION");
  const variance = variancePct(Number(e.net), e.previousNet === null ? null : Number(e.previousNet));
  const facts: [string, React.ReactNode][] = [
    ["Employee no.", e.employeeNumber],
    ["Department", e.department ?? "—"],
    ["Position", e.position ?? "—"],
    ["Location", e.location ?? "—"],
    ["Joined", formatDate(e.joinDate)],
    ["Last working day", e.lastWorkingDay ? formatDate(e.lastWorkingDay) : "—"],
    ["Bank", e.bankName ?? "—"],
    ["IBAN", maskIban(e.iban) || <span className="text-destructive">missing</span>],
    ["WPS routing code", e.bankRoutingCode ?? "—"],
    ["Labour card / person ID", e.labourCardNumber ? `••••${e.labourCardNumber.slice(-4)}` : "—"],
    ["Days in window", e.calendarDays],
    ["Paid days", `${Number(e.paidDays)} (${e.run.prorationBasis === "THIRTY_DAYS" ? "30-day" : "calendar"} basis)`],
    ["Unpaid leave days", Number(e.unpaidLeaveDays)],
  ];

  const LineTable = ({ title, lines, total }: { title: string; lines: typeof e.lines; total: bigint }) => (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{title}</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-muted-foreground">
                None
              </TableCell>
            </TableRow>
          ) : (
            lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  {l.name} {!l.isRecurring && <Badge variant="secondary">one-time</Badge>}
                  {l.note && <p className="text-muted-foreground text-xs">{l.note}</p>}
                </TableCell>
                <TableCell className="text-right">
                  <Money minor={l.amount} currency={cur} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell className="text-right">
              <Money minor={total} currency={cur} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">
            <Link href="/payroll" className="hover:underline">
              Payroll runs
            </Link>{" "}
            /{" "}
            <Link href={`/payroll/runs/${e.runId}`} className="hover:underline">
              {periodLabel(e.run.period)}
            </Link>
          </p>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {e.name} <RunStatusBadge status={e.run.status} />
            {e.status !== "INCLUDED" && <Badge variant="secondary">{e.status === "HELD" ? "Held" : "Excluded"}</Badge>}
          </h1>
          {e.statusReason && <p className="text-muted-foreground text-sm">Reason: {e.statusReason}</p>}
        </div>
        <div className="flex gap-2">
          {e.payslip && !e.payslip.voidedAt && can(ctx, "payslip.read.all") && (
            <Link href={`/payslips/${e.payslip.id}`} className={buttonVariants({ variant: "outline" })}>
              <FileText aria-hidden /> Payslip
            </Link>
          )}
          {can(ctx, "payroll.salary.read") && (
            <Link href={`/employees/${e.employeeId}?tab=payroll`} className={buttonVariants({ variant: "outline" })}>
              Salary history
            </Link>
          )}
        </div>
      </div>

      {e.issues.length > 0 && (
        <ul className="space-y-1">
          {e.issues.map((i) => (
            <li key={i.message} className={cn("flex items-center gap-2 text-sm", i.level === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>
              {i.level === "error" ? <CircleAlert className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
              {i.message}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Gross", e.gross],
          ["Deductions", e.deductions],
          ["Net pay", e.net],
        ].map(([label, v]) => (
          <Card key={label as string} className="gap-1 py-4">
            <CardContent>
              <p className="text-muted-foreground text-sm">{label as string}</p>
              <p className="text-xl font-semibold">
                <Money minor={v as bigint} currency={cur} showCode />
              </p>
              {label === "Net pay" && (
                <p className="text-muted-foreground text-xs">
                  Last month: {e.previousNet === null ? "—" : <Money minor={e.previousNet} currency={cur} />}
                  {variance !== null && ` (${variance > 0 ? "+" : ""}${variance}%)`}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LineTable title="Earnings" lines={earnings} total={e.gross} />
        <LineTable title="Deductions" lines={deductions} total={e.deductions} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Snapshot used for this run</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground text-xs">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground mt-4 text-xs">
            WPS split: fixed <Money minor={e.fixedPay} currency={cur} /> · variable <Money minor={e.variablePay} currency={cur} />
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
