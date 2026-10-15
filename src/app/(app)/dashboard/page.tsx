import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, FileWarning, Hourglass, Mail, UserMinus, UserPlus, Users, Wallet, Plane } from "lucide-react";
import { requireAuth, can } from "@/server/auth/context";
import { getEmployeeDashboard, getHrDashboard, getManagerDashboard, getRecentActivity } from "@/server/services/dashboard.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { daysBetween, formatDate, formatDateTime } from "@/lib/dates";
import { labelOf, EMPLOYMENT_TYPES } from "@/lib/constants";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Dashboard" };

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
        <p className="text-muted-foreground text-sm">
          {ctx.companyName} · {formatDate(me.today)}
        </p>
      </div>

      {/* ── Employee self-service ── */}
      <section aria-labelledby="me-heading" className="space-y-3">
        <h2 id="me-heading" className="text-lg font-semibold">
          My workspace
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plane className="size-4" aria-hidden /> Leave balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Leave management arrives in Phase 2. Your balances will appear here.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="size-4" aria-hidden /> Latest payslip
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Payroll arrives in Phase 3. Released payslips will appear here.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4" aria-hidden /> Upcoming holidays
              </CardTitle>
            </CardHeader>
            <CardContent>
              {me.holidays.length === 0 ? (
                <p className="text-muted-foreground text-sm">No upcoming public holidays on the calendar.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {me.holidays.map((h) => (
                    <li key={h.id} className="flex justify-between gap-2">
                      <span>{h.name}</span>
                      <span className="text-muted-foreground tabular-nums">{formatDate(h.date)}</span>
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
                · Reports to {me.employee.manager.preferredName || me.employee.manager.firstName} {me.employee.manager.lastName}
              </>
            )}
            {me.employee.probationEndDate && me.employee.probationEndDate >= me.today && <> · Probation ends {formatDate(me.employee.probationEndDate)}</>}
          </p>
        )}
      </section>

      {/* ── Manager ── */}
      {mgr && (mgr.direct.length > 0 || mgr.totalTeam > 0) && (
        <section aria-labelledby="team-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="team-heading" className="text-lg font-semibold">
              My team
            </h2>
            <Link href="/employees" className="text-primary text-sm hover:underline">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Direct reports" value={mgr.direct.length} icon={Users} />
            <Stat label="Whole team (incl. indirect)" value={mgr.totalTeam} icon={Users} />
            <Stat label="Probation ending ≤ 30 days" value={mgr.probation.length} icon={Hourglass} />
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

      {/* ── HR ── */}
      {hr && (
        <section aria-labelledby="hr-heading" className="space-y-3">
          <h2 id="hr-heading" className="text-lg font-semibold">
            HR overview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Headcount" value={hr.headcount} icon={Users} hint={`${hr.onLeave} on leave`} href="/employees" />
            <Stat label="Joiners this month" value={hr.joiners.length} icon={UserPlus} />
            <Stat label="Leavers this month" value={hr.leavers.length} icon={UserMinus} hint={`${hr.scheduledTerminations} scheduled terminations`} />
            <Stat label="Pending invitations" value={hr.pendingInvites} icon={Mail} hint="Accounts not yet activated" href="/admin/users?state=pending" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Headcount by department</CardTitle>
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
                  {hr.headcountByType.map((t) => (
                    <Badge key={t.type} variant="secondary">
                      {labelOf(EMPLOYMENT_TYPES, t.type)}: {t.count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileWarning className="size-4" aria-hidden /> Documents expiring within 60 days
                  <Badge variant={hr.expiringTotal ? "warning" : "secondary"}>{hr.expiringTotal}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hr.expiring.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No identity documents are expiring soon.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {hr.expiring.map((x) => {
                      const days = daysBetween(hr.today, x.expiry);
                      return (
                        <li key={`${x.employeeId}-${x.document}`} className="flex items-center justify-between gap-2 py-2">
                          <Link href={`/employees/${x.employeeId}?tab=documents`} className="hover:underline">
                            {x.name} <span className="text-muted-foreground">· {x.document}</span>
                          </Link>
                          <Badge variant={days < 0 ? "destructive" : days <= 30 ? "warning" : "secondary"}>
                            {days < 0 ? `expired ${-days}d ago` : `${formatDate(x.expiry)} (${days}d)`}
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
            <ListCard title="Joiners this month" empty="No joiners this month." items={hr.joiners.map((j) => ({ id: j.id, name: `${j.preferredName || j.firstName} ${j.lastName}`, meta: formatDate(j.joinDate) }))} />
            <ListCard title="Leavers this month" empty="No leavers this month." items={hr.leavers.map((j) => ({ id: j.id, name: `${j.preferredName || j.firstName} ${j.lastName}`, meta: formatDate(j.lastWorkingDay) }))} />
            <ListCard title="Probation ending (30 days)" empty="No probations ending soon." items={hr.probationEnding.map((j) => ({ id: j.id, name: `${j.preferredName || j.firstName} ${j.lastName}`, meta: formatDate(j.probationEndDate) }))} />
          </div>
        </section>
      )}

      {activity && (
        <section aria-labelledby="activity-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="activity-heading" className="text-lg font-semibold">
              Recent activity
            </h2>
            <Link href="/admin/audit" className="text-primary text-sm hover:underline">
              Audit log
            </Link>
          </div>
          <Card>
            <CardContent>
              {activity.length === 0 ? (
                <EmptyState title="No activity yet" />
              ) : (
                <ul className="divide-y text-sm">
                  {activity.map((a) => (
                    <li key={a.id} className="flex flex-col justify-between gap-1 py-2 sm:flex-row">
                      <span>
                        <span className="font-medium">{a.actor?.name ?? "System"}</span> <span className="text-muted-foreground">{a.action}</span> {a.summary && `— ${a.summary}`}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">{formatDateTime(a.createdAt, ctx.timezone)}</span>
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
