import Link from "next/link";
import { can, type AuthContext } from "@/server/auth/context";
import type { EmployeeDetail } from "@/server/services/employee.service";
import { getSalaryHistory } from "@/server/services/payroll/salary.service";
import { listPayComponents } from "@/server/services/payroll/settings.service";
import { listPayslips } from "@/server/services/payroll/payslip.service";
import { computeSettlement, settlementsFor } from "@/server/services/payroll/settlement.service";
import { AppError } from "@/server/errors";
import { formatIban } from "@/lib/iban";
import { formatDate, toDateInput } from "@/lib/dates";
import { formatMoney, minorToDecimalString } from "@/lib/payroll/money";
import { periodLabel } from "@/lib/payroll/calc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/payroll/badges";
import { SalaryDialog, DeleteSalaryButton } from "@/components/payroll/salary-dialog";
import { SettlementForm } from "@/components/payroll/settlement-form";
import { ApproveSettlementButton } from "@/components/payroll/approve-settlement-button";

/**
 * Payroll tab. Every block is gated by its own permission on the server; a viewer without
 * `payroll.salary.read` never receives salary figures (they are not rendered, so not in the RSC payload).
 */
export async function PayrollSection({ ctx, e, today }: { ctx: AuthContext; e: EmployeeDetail; today: Date }) {
  const canSalary = e.access === "all" && can(ctx, "payroll.salary.read");
  const canSettle = e.access === "all" && can(ctx, "payroll.settlement.manage");
  const canPayslips = e.access === "self" || (e.access === "all" && can(ctx, "payslip.read.all"));
  const cur = ctx.currency;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank details (WPS)</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Bank", e.bankName],
                ["Account holder", e.bankAccountName],
                ["IBAN", e.iban ? <span className="font-mono">{e.canSeeSensitive ? formatIban(e.iban) : e.iban}</span> : null],
                ["Routing code", e.bankRoutingCode],
              ] as [string, React.ReactNode][]
            ).map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-muted-foreground text-xs">{k}</dt>
                <dd className="truncate">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      {canSalary && <SalaryCard ctx={ctx} e={e} today={today} />}
      {(canSalary || canSettle) && <EndOfServiceCard ctx={ctx} e={e} canSettle={canSettle} />}
      {canPayslips && <PayslipsCard ctx={ctx} employeeId={e.id} self={e.access === "self"} />}
    </div>
  );

  async function SalaryCard({ ctx, e, today }: { ctx: AuthContext; e: EmployeeDetail; today: Date }) {
    const [history, components] = await Promise.all([getSalaryHistory(ctx, e.id), listPayComponents(ctx)]);
    const current = history.find((h) => h.status === "current");
    const latest = history[0];
    const options = components
      .filter((c) => c.kind === "EARNING" && c.isRecurring && c.isActive)
      .map((c) => {
        const line = latest?.lines.find((l) => l.componentId === c.id);
        return { id: c.id, code: c.code, name: c.name, calcType: c.calcType, formula: c.formula, included: !!line, current: line && c.calcType === "FIXED" ? minorToDecimalString(line.fixedAmount, cur) : null };
      });
    const canManage = can(ctx, "payroll.salary.manage") && e.status !== "TERMINATED";
    const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Salary</CardTitle>
            <CardDescription>
              {current ? (
                <>
                  Gross <Money minor={current.gross} currency={cur} showCode /> / month since {formatDate(current.effectiveFrom)}
                </>
              ) : (
                "No salary in effect — payroll will flag this employee."
              )}
            </CardDescription>
          </div>
          {canManage && <SalaryDialog employeeId={e.id} components={options} defaultDate={toDateInput(history.length ? nextMonth : e.joinDate)} currency={cur} />}
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No salary recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Components</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="hidden md:table-cell">Reason</TableHead>
                  <TableHead className="sr-only">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id} className={h.status === "past" ? "text-muted-foreground" : undefined}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(h.effectiveFrom)}
                      {h.status === "current" && (
                        <Badge variant="success" className="ml-2">
                          Current
                        </Badge>
                      )}
                      {h.status === "scheduled" && (
                        <Badge variant="warning" className="ml-2">
                          Scheduled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {h.error ? <span className="text-destructive">{h.error}</span> : h.lines.map((l) => `${l.name} ${formatMoney(l.amount, cur)}`).join(" · ")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Money minor={h.gross} currency={cur} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{h.reason}</TableCell>
                    <TableCell className="text-right">{canManage && h.status === "scheduled" && <DeleteSalaryButton structureId={h.id} employeeId={e.id} label={formatDate(h.effectiveFrom)} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }

  async function EndOfServiceCard({ ctx, e, canSettle }: { ctx: AuthContext; e: EmployeeDetail; canSettle: boolean }) {
    let s: Awaited<ReturnType<typeof computeSettlement>>;
    try {
      s = await computeSettlement(ctx, e.id);
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">End of service</CardTitle>
            <CardDescription>{err.message}</CardDescription>
          </CardHeader>
        </Card>
      );
    }
    const existing = await settlementsFor(ctx, e.id);
    const leaver = !!e.lastWorkingDay;
    const g = s.gratuity;
    const rows: [string, string, number][] = [
      [`Unpaid salary`, s.unpaidSalaryDays ? `${s.unpaidSalaryDays} days from ${formatDate(s.unpaidFrom)}` : "paid up to date", s.unpaidSalary],
      ["Leave encashment", `${s.leaveDays} days × ${s.encashmentBasis === "GROSS" ? "gross" : "basic"} ÷ 30${s.leaveLines.length ? ` (${s.leaveLines.map((l) => `${l.type} ${l.days}`).join(", ")})` : ""}`, s.leaveEncashment],
      [
        "Gratuity",
        g.eligible ? `${g.serviceYears} yrs → ${Math.round(g.totalDays * 100) / 100} days × ${formatMoney(Math.round(g.dailyWage), s.currency)}${g.capped ? " (capped)" : ""}${s.unpaidLeaveExcluded ? `; ${s.unpaidLeaveExcluded} unpaid leave days excluded` : ""}` : `not eligible (${g.serviceYears} yrs service)`,
        g.amount,
      ],
    ];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{leaver ? "Final settlement" : "End-of-service estimate"}</CardTitle>
          <CardDescription>
            {leaver ? `Last working day ${formatDate(e.lastWorkingDay)}.` : `If employment ended on ${formatDate(s.endDate)}.`} Basic <Money minor={s.basic} currency={s.currency} /> / month · joined {formatDate(e.joinDate)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="divide-y text-sm">
            {rows.map(([label, note, amount]) => (
              <li key={label} className="flex justify-between gap-4 py-2">
                <span>
                  {label}
                  <span className="text-muted-foreground block text-xs">{note}</span>
                </span>
                <Money minor={amount} currency={s.currency} />
              </li>
            ))}
            <li className="flex justify-between py-2 font-semibold">
              <span>Estimated total (before other earnings / deductions)</span>
              <Money minor={s.total} currency={s.currency} showCode />
            </li>
          </ul>

          {existing.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Saved settlements</h3>
              <ul className="divide-y rounded-lg border text-sm">
                {existing.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <Badge variant={x.status === "APPROVED" ? "success" : "warning"}>{x.status === "APPROVED" ? "Approved" : "Draft"}</Badge>{" "}
                      <Money minor={x.total} currency={s.currency} showCode />
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        · gratuity <Money minor={x.gratuity} currency={s.currency} /> · leave <Money minor={x.leaveEncashment} currency={s.currency} /> · salary <Money minor={x.unpaidSalary} currency={s.currency} /> · other +<Money minor={x.otherEarnings} currency={s.currency} /> −<Money minor={x.deductions} currency={s.currency} />
                        {x.notes && ` · ${x.notes}`}
                      </span>
                    </span>
                    {canSettle && x.status === "DRAFT" && x.createdById !== ctx.userId && (
                      <ApproveSettlementButton settlementId={x.id} employeeId={e.id} name={`${e.firstName} ${e.lastName}`} total={formatMoney(x.total, s.currency, { withCode: true })} />
                    )}
                    {canSettle && x.status === "DRAFT" && x.createdById === ctx.userId && <span className="text-muted-foreground text-xs">Awaiting a second approver</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canSettle && leaver && !existing.some((x) => x.status === "APPROVED") && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{existing.length ? "Recalculate settlement (replaces the draft)" : "Prepare settlement"}</h3>
              <SettlementForm employeeId={e.id} currency={s.currency} />
            </div>
          )}
          {canSettle && !leaver && <p className="text-muted-foreground text-xs">Record the termination first to prepare a final settlement.</p>}
        </CardContent>
      </Card>
    );
  }

  async function PayslipsCard({ ctx, employeeId, self }: { ctx: AuthContext; employeeId: string; self: boolean }) {
    const payslips = (await listPayslips(ctx, employeeId)).slice(0, 12);
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Payslips</CardTitle>
          {self && (
            <Link href="/payslips" className="text-primary text-sm hover:underline">
              All my payslips
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {payslips.length === 0 ? (
            <p className="text-muted-foreground text-sm">No released payslips yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {payslips.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/payslips/${p.id}`} className="hover:underline">
                    {periodLabel(p.period)}
                  </Link>
                  <Money minor={p.net} currency={p.currency} showCode />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }
}

