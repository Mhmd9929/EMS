import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CircleAlert, Download } from "lucide-react";
import { requireAuth, requirePermission, can } from "@/server/auth/context";
import { getRun } from "@/server/services/payroll/run.service";
import { NotFoundError } from "@/server/errors";
import { first, type SearchParams } from "@/lib/list-params";
import { issueText, runScopeText } from "@/lib/payroll/issues";
import { getFormat } from "@/server/i18n";
import { getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("payroll"))("meta.run") };
}

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
  const [t, te, f] = await Promise.all([getTranslations("payroll"), getTranslations("enums"), getFormat()]);
  const editable = run.status === "CALCULATED" || run.status === "UNDER_REVIEW";
  const exportable = can(ctx, "payroll.export");
  const path = `/payroll/runs/${run.id}`;
  const timeline = [
    [t("run.timeline.created"), people.createdBy, run.createdAt],
    [t("run.timeline.calculated"), people.calculatedBy, run.calculatedAt],
    [t("run.timeline.submitted"), people.submittedBy, run.submittedAt],
    [t("run.timeline.approved"), people.approvedBy, run.approvedAt],
    [t("run.timeline.released"), people.releasedBy, run.releasedAt],
    [t("run.timeline.cancelled"), people.cancelledBy, run.cancelledAt],
  ].filter(([, , at]) => at) as [string, string | null, Date][];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            <Link href="/payroll" className="hover:underline">
              {t("run.breadcrumb")}
            </Link>{" "}
            / {runScopeText(run, t)}
          </p>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {t("run.heading", { period: f.month(run.period) })} <RunStatusBadge status={run.status} />
          </h1>
          <RunStepper status={run.status} />
          <p className="text-muted-foreground text-xs">
            {run.prorationBasis === "THIRTY_DAYS" ? t("basis.thirty") : t("basis.calendar")} · {run.currency}
            {timeline.map(([label, who, at]) => ` · ${who ? t("run.timelineBy", { label, who, at: f.dateTime(at, ctx.timezone) }) : t("run.timelineAt", { label, at: f.dateTime(at, ctx.timezone) })}`).join("")}
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

      {run.reviewComment && (
        <Alert variant={run.status === "CALCULATED" ? "warning" : "info"} title={t("run.reviewerComment")}>
          {run.reviewComment.startsWith("Reopened: ") ? t("run.reopenedComment", { reason: run.reviewComment.slice("Reopened: ".length) }) : run.reviewComment}
        </Alert>
      )}
      {run.cancelReason && <Alert variant="error" title={t("run.cancelled")}>{run.cancelReason}</Alert>}
      {run.status === "DRAFT" && <Alert title={t("run.notCalculatedTitle")}>{t("run.notCalculatedBody")}</Alert>}
      {counts.errors > 0 && editable && (
        <Alert variant="error" title={t("run.blockingTitle", { count: counts.errors })}>
          {t("run.blockingBody")}
        </Alert>
      )}

      {run.status !== "DRAFT" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [t("run.employeesPaid"), `${counts.included}`, counts.held ? t("run.heldCount", { count: counts.held }) : t("run.noneHeld")],
            [t("run.gross"), <Money key="g" minor={run.totalGross} currency={run.currency} showCode />, null],
            [t("run.deductions"), <Money key="d" minor={run.totalDeductions} currency={run.currency} showCode />, null],
            [t("run.netPay"), <Money key="n" minor={run.totalNet} currency={run.currency} showCode className="text-link" />, t("run.toBeTransferred")],
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
            <nav className="flex flex-wrap gap-1 rounded-lg border p-0.5 text-sm" aria-label={t("run.filter")}>
              {(
                [
                  ["all", t("run.views.all")],
                  ["issues", t("run.views.issues")],
                  ["variance", t("run.views.variance")],
                  ["held", t("run.views.held")],
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
                  <Download aria-hidden /> {t("run.exportRegister")}
                </a>
                {(run.status === "APPROVED" || run.status === "RELEASED") && (
                  <>
                    <a href={`/api/payroll/runs/${run.id}/export?type=sif`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <Download aria-hidden /> {t("run.exportSif")}
                    </a>
                    <a href={`/api/payroll/runs/${run.id}/export?type=bank`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <Download aria-hidden /> {t("run.exportBank")}
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
          <Toolbar>
            <SearchInput placeholder={t("run.searchPlaceholder")} />
          </Toolbar>
          {rows.length === 0 ? (
            <EmptyState title={t("run.noMatches")} />
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("run.cols.employee")}</TableHead>
                    <TableHead className="hidden text-end md:table-cell">{t("run.cols.paidDays")}</TableHead>
                    <TableHead className="hidden text-end lg:table-cell">{t("run.cols.gross")}</TableHead>
                    <TableHead className="hidden text-end lg:table-cell">{t("run.cols.deductions")}</TableHead>
                    <TableHead className="text-end">{t("run.cols.net")}</TableHead>
                    <TableHead className="hidden text-end md:table-cell">{t("run.cols.lastMonth")}</TableHead>
                    <TableHead className="text-end">{t("run.cols.change")}</TableHead>
                    <TableHead>{t("run.cols.status")}</TableHead>
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
                            <span dir="ltr">{e.employeeNumber}</span> · {e.department ?? "—"}
                          </p>
                          {[...errors, ...warnings].slice(0, 2).map((i) => (
                            <p key={`${i.code ?? ""}${i.message}`} className={cn("flex items-center gap-1 text-xs", i.level === "error" ? "text-destructive" : "text-warning")}>
                              {i.level === "error" ? <CircleAlert className="size-3" aria-hidden /> : <AlertTriangle className="size-3" aria-hidden />}
                              {issueText(i, t)}
                            </p>
                          ))}
                        </TableCell>
                        <TableCell className="hidden text-end tabular-nums md:table-cell">
                          {Number(e.paidDays)}
                          {Number(e.unpaidLeaveDays) > 0 && <span className="text-destructive block text-xs">{t("run.unpaidDays", { days: Number(e.unpaidLeaveDays) })}</span>}
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
                            <Badge variant="secondary">{t("run.newBadge")}</Badge>
                          ) : (
                            <span dir="ltr" className={cn("tabular-nums text-sm", big ? "font-semibold text-warning" : "text-muted-foreground")}>
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
                              {te(`entryStatus.${e.status}`)}
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
