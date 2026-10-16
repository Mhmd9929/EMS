import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CircleAlert, FileText } from "lucide-react";
import { requireAuth, requirePermission, can } from "@/server/auth/context";
import { getRunEntry } from "@/server/services/payroll/run.service";
import { NotFoundError } from "@/server/errors";
import { variancePct } from "@/lib/payroll/calc";
import { issueText, lineNoteText } from "@/lib/payroll/issues";
import { getFormat } from "@/server/i18n";
import { getTranslations } from "next-intl/server";
import { maskIban } from "@/lib/iban";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money, RunStatusBadge } from "@/components/payroll/badges";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("payroll"))("meta.entry") };
}

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
  const [t, te, f] = await Promise.all([getTranslations("payroll"), getTranslations("enums"), getFormat()]);
  const earnings = e.lines.filter((l) => l.kind === "EARNING");
  const deductions = e.lines.filter((l) => l.kind === "DEDUCTION");
  const variance = variancePct(Number(e.net), e.previousNet === null ? null : Number(e.previousNet));
  const facts: [string, React.ReactNode][] = [
    [t("entry.facts.employeeNo"), <span key="no" dir="ltr">{e.employeeNumber}</span>],
    [t("entry.facts.department"), e.department ?? "—"],
    [t("entry.facts.position"), e.position ?? "—"],
    [t("entry.facts.location"), e.location ?? "—"],
    [t("entry.facts.joined"), f.date(e.joinDate)],
    [t("entry.facts.lastWorkingDay"), e.lastWorkingDay ? f.date(e.lastWorkingDay) : "—"],
    [t("entry.facts.bank"), e.bankName ?? "—"],
    [t("entry.facts.iban"), maskIban(e.iban) ? <span key="iban" dir="ltr">{maskIban(e.iban)}</span> : <span className="text-destructive">{t("entry.missing")}</span>],
    [t("entry.facts.routingCode"), e.bankRoutingCode ? <span key="rc" dir="ltr">{e.bankRoutingCode}</span> : "—"],
    [t("entry.facts.labourCard"), e.labourCardNumber ? <span key="lc" dir="ltr">{`••••${e.labourCardNumber.slice(-4)}`}</span> : "—"],
    [t("entry.facts.daysInWindow"), e.calendarDays],
    [t("entry.facts.paidDays"), t("entry.paidDaysValue", { days: Number(e.paidDays), basis: e.run.prorationBasis === "THIRTY_DAYS" ? t("entry.basisThirty") : t("entry.basisCalendar") })],
    [t("entry.facts.unpaidLeaveDays"), Number(e.unpaidLeaveDays)],
  ];

  const LineTable = ({ title, lines, total }: { title: string; lines: typeof e.lines; total: bigint }) => (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{title}</TableHead>
            <TableHead className="text-end">{t("entry.amount")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-muted-foreground">
                {t("entry.none")}
              </TableCell>
            </TableRow>
          ) : (
            lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  {l.name} {!l.isRecurring && <Badge variant="secondary">{t("entry.oneTime")}</Badge>}
                  {l.note && <p className="text-muted-foreground text-xs">{lineNoteText(l.note, t)}</p>}
                </TableCell>
                <TableCell className="text-end">
                  <Money minor={l.amount} currency={cur} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>{t("entry.total")}</TableCell>
            <TableCell className="text-end">
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
              {t("run.breadcrumb")}
            </Link>{" "}
            /{" "}
            <Link href={`/payroll/runs/${e.runId}`} className="hover:underline">
              {f.month(e.run.period)}
            </Link>
          </p>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {e.name} <RunStatusBadge status={e.run.status} />
            {e.status !== "INCLUDED" && <Badge variant="secondary">{te(`entryStatus.${e.status}`)}</Badge>}
          </h1>
          {e.statusReason && <p className="text-muted-foreground text-sm">{t("entry.reason", { reason: e.statusReason })}</p>}
        </div>
        <div className="flex gap-2">
          {e.payslip && !e.payslip.voidedAt && can(ctx, "payslip.read.all") && (
            <Link href={`/payslips/${e.payslip.id}`} className={buttonVariants({ variant: "outline" })}>
              <FileText aria-hidden /> {t("entry.payslip")}
            </Link>
          )}
          {can(ctx, "payroll.salary.read") && (
            <Link href={`/employees/${e.employeeId}?tab=payroll`} className={buttonVariants({ variant: "outline" })}>
              {t("entry.salaryHistory")}
            </Link>
          )}
        </div>
      </div>

      {e.issues.length > 0 && (
        <ul className="space-y-1">
          {e.issues.map((i) => (
            <li key={`${i.code ?? ""}${i.message}`} className={cn("flex items-center gap-2 text-sm", i.level === "error" ? "text-destructive" : "text-warning")}>
              {i.level === "error" ? <CircleAlert className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
              {issueText(i, t)}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["gross", t("entry.gross"), e.gross],
            ["deductions", t("entry.deductions"), e.deductions],
            ["net", t("entry.netPay"), e.net],
          ] as const
        ).map(([key, label, v]) => (
          <Card key={key} className="gap-1 py-4">
            <CardContent>
              <p className="text-muted-foreground text-sm">{label}</p>
              <p className="text-xl font-semibold">
                <Money minor={v} currency={cur} showCode />
              </p>
              {key === "net" && (
                <p className="text-muted-foreground text-xs">
                  {t("entry.lastMonth")} {e.previousNet === null ? "—" : <Money minor={e.previousNet} currency={cur} />}
                  {variance !== null && (
                    <>
                      {" "}
                      (<span dir="ltr">{`${variance > 0 ? "+" : ""}${variance}%`}</span>)
                    </>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LineTable title={t("entry.earnings")} lines={earnings} total={e.gross} />
        <LineTable title={t("entry.deductions")} lines={deductions} total={e.deductions} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("entry.snapshot")}</CardTitle>
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
            {t("entry.wpsSplit", { fixed: f.money(e.fixedPay, cur, { withCode: false }), variable: f.money(e.variablePay, cur, { withCode: false }) })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
