import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CalendarDays, FileWarning, Mail, UserMinus, UserPlus, Users, Wallet, Plane } from "lucide-react";
import { requireAuth, can } from "@/server/auth/context";
import { getEmployeeDashboard, getHrDashboard, getManagerDashboard, getRecentActivity } from "@/server/services/dashboard.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPayslips } from "@/server/services/payroll/payslip.service";
import { currentRunSummary } from "@/server/services/payroll/run.service";
import { Money, RunStatusBadge } from "@/components/payroll/badges";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { daysBetween } from "@/lib/dates";
import { getFormat } from "@/server/i18n";
import type { ExpiringDocument } from "@/server/services/dashboard.service";
import { EmptyState } from "@/components/empty-state";
import { getEmployeeBalances } from "@/server/services/leave/balance.service";
import { approvalInbox, whoIsOff } from "@/server/services/leave/request.service";
import { LeaveTypeLabel } from "@/components/leave/leave-badges";
import { CheckSquare } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("dashboard"))("meta.title") };
}

const DOCUMENT_KEYS = { "Emirates ID": "emiratesId", Passport: "passport", Visa: "visa", "Labour card": "labourCard" } as const satisfies Record<ExpiringDocument["document"], string>;

function Stat({ label, value, icon: Icon, hint, href }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; hint?: string; href?: string }) {
  const body = (
    <Card className="h-full gap-2 transition-colors hover:bg-accent/40">
      <CardHeader className="flex-row items-center justify-between">
        <CardDescription>{label}</CardDescription>
        <Icon className="text-muted-foreground size-4" aria-hidden />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage() {
  const ctx = await requireAuth();
  const isHr = can(ctx, "dashboard.hr");
  const isManager = can(ctx, "employee.read.team") && !!ctx.employeeId;
  const [hr, mgr, me, activity] = await Promise.all([
    isHr ? getHrDashboard(ctx) : null,
    isManager ? getManagerDashboard(ctx) : null,
    getEmployeeDashboard(ctx),
    can(ctx, "audit.read") ? getRecentActivity(ctx) : null,
  ]);
  const firstName = (ctx.employeeName ?? ctx.name).split(" ")[0];
  const canApprove = can(ctx, "leave.approve.team") || can(ctx, "leave.approve.all");
  const [balances, inbox, offToday] = await Promise.all([
    ctx.employeeId ? getEmployeeBalances(ctx, ctx.employeeId, me.today.getUTCFullYear()) : null,
    canApprove ? approvalInbox(ctx, "mine") : null,
    isHr || isManager ? whoIsOff(ctx, me.today) : null,
  ]);
  const period = `${me.today.getUTCFullYear()}-${String(me.today.getUTCMonth() + 1).padStart(2, "0")}`;
  const [latestPayslip, payrollRuns] = await Promise.all([
    ctx.employeeId ? listPayslips(ctx, ctx.employeeId).then((p) => p[0] ?? null) : null,
    currentRunSummary(ctx, period),
  ]);
  const t = await getTranslations("dashboard");
  const tEnums = await getTranslations("enums");
  const f = await getFormat();
  const scopeName = (label: string) => label.slice(label.indexOf(": ") + 2);
  const runScope = (r: { scope: string; scopeLabel: string }) =>
    r.scope === "ALL"
      ? tEnums("runScope.ALL")
      : r.scopeLabel.includes(": ")
        ? t(r.scope === "DEPARTMENT" ? "payroll.scopeDepartment" : "payroll.scopeLocation", { name: scopeName(r.scopeLabel) })
        : r.scopeLabel;
  const runState = (status: string) =>
    status === "UNDER_REVIEW" ? t("payroll.waitingForApproval") : status === "APPROVED" ? t("payroll.readyToRelease") : status === "RELEASED" ? t("payroll.payslipsIssued") : t("payroll.inPreparation");
  const shownBalances = (balances ?? []).filter((b) => b.eligible && b.tracked && b.accrued + b.carriedForward + b.adjustments > 0).slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("welcome", { name: firstName })}</h1>
        <p className="text-muted-foreground text-sm">
          {ctx.companyName} · {f.date(me.today)}
        </p>
      </div>

      {/* ── Employee self-service ── */}
      <section aria-labelledby="me-heading" className="space-y-3">
        <h2 id="me-heading" className="text-lg font-semibold">
          {t("me.heading")}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plane className="size-4" aria-hidden /> {t("me.leaveBalance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shownBalances.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("me.noLeaveBalance")}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {shownBalances.map((b) => (
                    <li key={b.leaveType.id} className="flex justify-between gap-2">
                      <LeaveTypeLabel name={b.leaveType.name} color={b.leaveType.color} />
                      <span className="tabular-nums">
                        <strong>{b.available}</strong> <span className="text-muted-foreground">
                          {t("me.daysUnit", { count: b.available })}
                          {b.pending ? ` · ${t("me.pending", { count: b.pending })}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-3 text-sm">
                <Link href="/leave/apply" className="text-link hover:underline">
                  {t("me.applyForLeave")}
                </Link>
                <Link href="/leave" className="text-link hover:underline">
                  {t("me.allBalances")}
                </Link>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="size-4" aria-hidden /> {t("me.latestPayslip")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestPayslip ? (
                <>
                  <p className="text-muted-foreground text-sm">{t("me.netPay", { period: f.month(latestPayslip.period) })}</p>
                  <p className="text-2xl font-semibold">
                    <Money minor={latestPayslip.net} currency={latestPayslip.currency} showCode />
                  </p>
                  <div className="mt-3 flex gap-3 text-sm">
                    <Link href={`/payslips/${latestPayslip.id}`} className="text-link hover:underline">
                      {t("me.viewPayslip")}
                    </Link>
                    <Link href="/payslips" className="text-link hover:underline">
                      {t("me.allPayslips")}
                    </Link>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">{t("me.noPayslips")}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4" aria-hidden /> {t("me.upcomingHolidays")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {me.holidays.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("me.noHolidays")}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {me.holidays.map((h) => (
                    <li key={h.id} className="flex justify-between gap-2">
                      <span>{h.name}</span>
                      <span className="text-muted-foreground tabular-nums">{f.date(h.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        {me.employee && (
          <p className="text-muted-foreground text-sm">
            {me.employee.position?.title ?? "—"} · {me.employee.department?.name ?? "—"}
            {me.employee.manager && (
              <>
                {" "}
                · {t("me.reportsTo", { name: `${me.employee.manager.preferredName || me.employee.manager.firstName} ${me.employee.manager.lastName}` })}
              </>
            )}
            {me.employee.probationEndDate && me.employee.probationEndDate >= me.today && <> · {t("me.probationEnds", { date: f.date(me.employee.probationEndDate) })}</>}
          </p>
        )}
      </section>

      {/* ── Payroll ── */}
      {payrollRuns && (
        <section aria-labelledby="payroll-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="payroll-heading" className="text-lg font-semibold">
              {t("payroll.heading", { period: f.month(period) })}
            </h2>
            <Link href="/payroll" className="text-link text-sm hover:underline">
              {t("payroll.allRuns")}
            </Link>
          </div>
          {payrollRuns.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground text-sm">{t("payroll.noRun")}</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {payrollRuns.map((r) => (
                <Link key={r.id} href={`/payroll/runs/${r.id}`}>
                  <Card className="hover:bg-accent/40 h-full gap-2 transition-colors">
                    <CardHeader>
                      <CardDescription className="flex items-center justify-between gap-2">
                        {runScope(r)} <RunStatusBadge status={r.status} />
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">
                        <Money minor={r.totalNet} currency={r.currency} showCode />
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {t("payroll.employees", { count: r.employeeCount })} · {runState(r.status)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Manager ── */}
      {mgr && (mgr.direct.length > 0 || mgr.totalTeam > 0) && (
        <section aria-labelledby="team-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="team-heading" className="text-lg font-semibold">
              {t("team.heading")}
            </h2>
            <Link href="/employees" className="text-link text-sm hover:underline">
              {t("team.viewAll")}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={t("team.directReports")} value={mgr.direct.length} icon={Users} />
            <Stat label={t("team.wholeTeam")} value={mgr.totalTeam} icon={Users} />
            <Stat label={t("team.approvalsWaiting")} value={inbox?.length ?? 0} icon={CheckSquare} href="/leave/approvals" hint={t("team.probationsEnding", { count: mgr.probation.length })} />
          </div>
          <Card>
            <CardContent>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mgr.direct.map((e) => (
                  <li key={e.id}>
                    <Link href={`/employees/${e.id}`} className="hover:bg-accent flex items-center gap-3 rounded-md p-1.5">
                      <Avatar employeeId={e.id} hasPhoto={!!e.photoPath} firstName={e.firstName} lastName={e.lastName} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {e.preferredName || e.firstName} {e.lastName}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">{e.position?.title ?? "—"}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {offToday && offToday.length > 0 && (
        <section aria-labelledby="off-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="off-heading" className="text-lg font-semibold">
              {t("offToday.heading")}
            </h2>
            <Link href="/leave/calendar" className="text-link text-sm hover:underline">
              {t("offToday.leaveCalendar")}
            </Link>
          </div>
          <Card>
            <CardContent>
              <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {offToday.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <Link href={`/leave/requests/${r.id}`} className="hover:underline">
                      {r.employee.preferredName || r.employee.firstName} {r.employee.lastName}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      <LeaveTypeLabel name={r.leaveType.name} color={r.leaveType.color} /> · {t("offToday.back", { date: f.date(new Date(r.endDate.getTime() + 86_400_000)) })}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── HR ── */}
      {hr && (
        <section aria-labelledby="hr-heading" className="space-y-3">
          <h2 id="hr-heading" className="text-lg font-semibold">
            {t("hr.heading")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t("hr.headcount")} value={hr.headcount} icon={Users} hint={t("hr.onLeave", { count: hr.onLeave })} href="/employees" />
            <Stat label={t("hr.joinersThisMonth")} value={hr.joiners.length} icon={UserPlus} />
            <Stat label={t("hr.leaversThisMonth")} value={hr.leavers.length} icon={UserMinus} hint={t("hr.scheduledTerminations", { count: hr.scheduledTerminations })} />
            <Stat label={t("hr.pendingInvitations")} value={hr.pendingInvites} icon={Mail} hint={t("hr.pendingInvitationsHint", { count: offToday?.length ?? 0 })} href="/admin/users?state=pending" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">{t("hr.headcountByDepartment")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {hr.headcountByDepartment.map((d) => (
                    <li key={d.name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{d.name}</span>
                        <span className="tabular-nums">{d.count}</span>
                      </div>
                      <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
                        <div className="bg-primary h-full rounded-full" style={{ width: `${(d.count / Math.max(1, hr.headcount)) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  {hr.headcountByType.map((g) => (
                    <Badge key={g.type} variant="secondary">
                      {tEnums(`employmentType.${g.type}`)}: {g.count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileWarning className="size-4" aria-hidden /> {t("hr.documentsExpiring")}
                  <Badge variant={hr.expiringTotal ? "warning" : "secondary"}>{hr.expiringTotal}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hr.expiring.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t("hr.noDocumentsExpiring")}</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {hr.expiring.map((x) => {
                      const days = daysBetween(hr.today, x.expiry);
                      return (
                        <li key={`${x.employeeId}-${x.document}`} className="flex items-center justify-between gap-2 py-2">
                          <Link href={`/employees/${x.employeeId}?tab=documents`} className="hover:underline">
                            {x.name} <span className="text-muted-foreground">· {t(`hr.documents.${DOCUMENT_KEYS[x.document]}`)}</span>
                          </Link>
                          <Badge variant={days < 0 ? "destructive" : days <= 30 ? "warning" : "secondary"}>
                            {days < 0 ? t("hr.expiredAgo", { days: -days }) : t("hr.expiresIn", { date: f.date(x.expiry), days })}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <ListCard title={t("hr.joinersThisMonth")} empty={t("hr.noJoiners")} items={hr.joiners.map((j) => ({ id: j.id, name: `${j.preferredName || j.firstName} ${j.lastName}`, meta: f.date(j.joinDate) }))} />
            <ListCard title={t("hr.leaversThisMonth")} empty={t("hr.noLeavers")} items={hr.leavers.map((j) => ({ id: j.id, name: `${j.preferredName || j.firstName} ${j.lastName}`, meta: f.date(j.lastWorkingDay) }))} />
            <ListCard title={t("hr.probationEnding")} empty={t("hr.noProbations")} items={hr.probationEnding.map((j) => ({ id: j.id, name: `${j.preferredName || j.firstName} ${j.lastName}`, meta: f.date(j.probationEndDate) }))} />
          </div>
        </section>
      )}

      {activity && (
        <section aria-labelledby="activity-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="activity-heading" className="text-lg font-semibold">
              {t("activity.heading")}
            </h2>
            <Link href="/admin/audit" className="text-link text-sm hover:underline">
              {t("activity.auditLog")}
            </Link>
          </div>
          <Card>
            <CardContent>
              {activity.length === 0 ? (
                <EmptyState title={t("activity.empty")} />
              ) : (
                <ul className="divide-y text-sm">
                  {activity.map((a) => (
                    <li key={a.id} className="flex flex-col justify-between gap-1 py-2 sm:flex-row">
                      <span>
                        <span className="font-medium">{a.actor?.name ?? t("activity.system")}</span> <span className="text-muted-foreground">{a.action}</span> {a.summary && `— ${a.summary}`}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">{f.dateTime(a.createdAt, ctx.timezone)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function ListCard({ title, items, empty }: { title: string; items: { id: string; name: string; meta: string }[]; empty: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{empty}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <Link href={`/employees/${i.id}`} className="hover:underline">
                  {i.name}
                </Link>
                <span className="text-muted-foreground tabular-nums">{i.meta}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
