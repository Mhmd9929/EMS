import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CircleAlert, Download } from "lucide-react";
import { requireAuth, requirePermission, can } from "@/server/auth/context";
import { getRun } from "@/server/services/payroll/run.service";
import { NotFoundError } from "@/server/errors";
import { first, type SearchParams } from "@/lib/list-params";
import { periodLabel } from "@/lib/payroll/calc";
import { formatDateTime } from "@/lib/dates";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput, Toolbar } from "@/components/data-table/toolbar";
import { hrefWith } from "@/components/data-table/url";
import { EmptyState } from "@/components/empty-state";
import { Money, RunStatusBadge, RunStepper } from "@/components/payroll/badges";
import { cn } from "@/lib/utils";
import { RunActions } from "./run-actions";
import { EntryStatusMenu } from "./entry-status-menu";

export const metadata: Metadata = { title: "Payroll run" };

export default async function RunPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  requirePermission(ctx, ["payroll.run.manage", "payroll.run.approve", "payroll.export"]);
  const { id } = await params;
  const sp = await searchParams;
  const view = (["all", "issues", "held", "variance"] as const).find((v) => v === first(sp.view)) ?? "all";
  const data = await getRun(ctx, id, { q: first(sp.q), view }).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const { run, rows, counts, people } = data;
  const editable = run.status === "CALCULATED" || run.status === "UNDER_REVIEW";
  const exportable = can(ctx, "payroll.export");
  const path = `/payroll/runs/${run.id}`;
  const timeline = [
    ["Created", people.createdBy, run.createdAt],
    ["Calculated", people.calculatedBy, run.calculatedAt],
    ["Submitted", people.submittedBy, run.submittedAt],
    ["Approved", people.approvedBy, run.approvedAt],
    ["Released", people.releasedBy, run.releasedAt],
    ["Cancelled", people.cancelledBy, run.cancelledAt],
  ].filter(([, , at]) => at) as [string, string | null, Date][];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            <Link href="/payroll" className="hover:underline">
              Payroll runs
            </Link>{" "}
            / {run.scopeLabel}
          </p>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {periodLabel(run.period)} payroll <RunStatusBadge status={run.status} />
          </h1>
          <RunStepper status={run.status} />
          <p className="text-muted-foreground text-xs">
            {run.prorationBasis === "THIRTY_DAYS" ? "30-day basis" : "Calendar-day basis"} · {run.currency}
            {timeline.map(([label, who, at]) => ` · ${label} ${who ? `by ${who} ` : ""}${formatDateTime(at, ctx.timezone)}`).join("")}
          </p>
        </div>
        <RunActions
          runId={run.id}
          status={run.status}
          canManage={can(ctx, "payroll.run.manage")}
          canApprove={data.canApprove}
          isMaker={run.calculatedById === ctx.userId || run.submittedById === ctx.userId}
          canReopen={can(ctx, "payroll.run.reopen")}
          blocking={counts.errors}
        />
      </div>

      {run.reviewComment && <Alert variant={run.status === "CALCULATED" ? "warning" : "info"} title="Reviewer comment">{run.reviewComment}</Alert>}
      {run.cancelReason && <Alert variant="error" title="Cancelled">{run.cancelReason}</Alert>}
      {run.status === "DRAFT" && <Alert title="Not calculated yet">Calculate to compute every employee&apos;s pay for the month. You can recalculate as often as needed until the run is submitted.</Alert>}
      {counts.errors > 0 && editable && (
        <Alert variant="error" title={`${counts.errors} blocking issue${counts.errors === 1 ? "" : "s"}`}>
          Fix the data (e.g. add a salary or IBAN) and recalculate, or hold/exclude those employees before submitting.
        </Alert>
      )}

      {run.status !== "DRAFT" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Employees paid", `${counts.included}`, counts.held ? `${counts.held} held / excluded` : "none held"],
            ["Gross", <Money key="g" minor={run.totalGross} currency={run.currency} showCode />, null],
            ["Deductions", <Money key="d" minor={run.totalDeductions} currency={run.currency} showCode />, null],
            ["Net pay", <Money key="n" minor={run.totalNet} currency={run.currency} showCode className="text-link" />, "to be transferred"],
          ].map(([label, value, hint]) => (
            <Card key={label as string} className="gap-1 py-4">
              <CardHeader>
                <CardDescription>{label}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{value}</p>
                {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {run.status !== "DRAFT" && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <nav className="flex flex-wrap gap-1 rounded-lg border p-0.5 text-sm" aria-label="Filter">
              {(
                [
                  ["all", "All"],
                  ["issues", "With issues"],
                  ["variance", "Big changes"],
                  ["held", "Held / excluded"],
                ] as const
              ).map(([v, label]) => (
                <Link key={v} href={hrefWith(path, sp, { view: v === "all" ? undefined : v })} aria-current={view === v ? "page" : undefined} className={cn("rounded-md px-3 py-1", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {label}
                </Link>
              ))}
            </nav>
            {exportable && (
              <div className="flex flex-wrap gap-2">
                <a href={`/api/payroll/runs/${run.id}/export?type=register`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Download aria-hidden /> Register (Excel)
                </a>
                {(run.status === "APPROVED" || run.status === "RELEASED") && (
                  <>
                    <a href={`/api/payroll/runs/${run.id}/export?type=sif`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <Download aria-hidden /> WPS SIF
                    </a>
                    <a href={`/api/payroll/runs/${run.id}/export?type=bank`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <Download aria-hidden /> Bank transfer CSV
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
          <Toolbar>
            <SearchInput placeholder="Search name, number, department…" />
          </Toolbar>
          {rows.length === 0 ? (
            <EmptyState title="No employees match" />
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="hidden text-end md:table-cell">Paid days</TableHead>
                    <TableHead className="hidden text-end lg:table-cell">Gross</TableHead>
                    <TableHead className="hidden text-end lg:table-cell">Deductions</TableHead>
                    <TableHead className="text-end">Net</TableHead>
                    <TableHead className="hidden text-end md:table-cell">Last month</TableHead>
                    <TableHead className="text-end">Change</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => {
                    const errors = e.issues.filter((i) => i.level === "error");
                    const warnings = e.issues.filter((i) => i.level === "warning");
                    const big = e.variance !== null && Math.abs(e.variance) >= 20;
                    return (
                      <TableRow key={e.id} className={cn(e.status !== "INCLUDED" && "opacity-60", errors.length > 0 && e.status === "INCLUDED" && "bg-destructive/5")}>
                        <TableCell>
                          <Link href={`/payroll/runs/${run.id}/entries/${e.id}`} className="font-medium hover:underline">
                            {e.name}
                          </Link>
                          <p className="text-muted-foreground text-xs">
                            {e.employeeNumber} · {e.department ?? "—"}
                          </p>
                          {[...errors, ...warnings].slice(0, 2).map((i) => (
                            <p key={i.message} className={cn("flex items-center gap-1 text-xs", i.level === "error" ? "text-destructive" : "text-warning")}>
                              {i.level === "error" ? <CircleAlert className="size-3" aria-hidden /> : <AlertTriangle className="size-3" aria-hidden />}
                              {i.message}
                            </p>
                          ))}
                        </TableCell>
                        <TableCell className="hidden text-end tabular-nums md:table-cell">
                          {Number(e.paidDays)}
                          {Number(e.unpaidLeaveDays) > 0 && <span className="text-destructive block text-xs">−{Number(e.unpaidLeaveDays)} unpaid</span>}
                        </TableCell>
                        <TableCell className="hidden text-end lg:table-cell">
                          <Money minor={e.gross} currency={run.currency} />
                        </TableCell>
                        <TableCell className="hidden text-end lg:table-cell">
                          <Money minor={e.deductions} currency={run.currency} />
                        </TableCell>
                        <TableCell className="text-end font-medium">
                          <Money minor={e.net} currency={run.currency} />
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden text-end md:table-cell">{e.previousNet === null ? "—" : <Money minor={e.previousNet} currency={run.currency} />}</TableCell>
                        <TableCell className="text-end">
                          {e.variance === null ? (
                            <Badge variant="secondary">new</Badge>
                          ) : (
                            <span className={cn("tabular-nums text-sm", big ? "font-semibold text-warning" : "text-muted-foreground")}>
                              {e.variance > 0 ? "+" : ""}
                              {e.variance}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editable && (can(ctx, "payroll.run.manage") || can(ctx, "payroll.run.approve")) ? (
                            <EntryStatusMenu entryId={e.id} name={e.name} status={e.status} reason={e.statusReason} />
                          ) : (
                            <Badge variant={e.status === "INCLUDED" ? "success" : "secondary"} title={e.statusReason ?? undefined}>
                              {e.status === "INCLUDED" ? "Included" : e.status === "HELD" ? "Held" : "Excluded"}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
