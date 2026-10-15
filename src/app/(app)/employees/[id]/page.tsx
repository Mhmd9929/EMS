import type { Metadata } from "next";
import Link from "next/link";
import { notFound, forbidden } from "next/navigation";
import { ChevronRight, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { requireAuth, can } from "@/server/auth/context";
import { getEmployeeDetail, getReportingChain, type EmployeeDetail } from "@/server/services/employee.service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { first, type SearchParams } from "@/lib/list-params";
import { daysBetween, formatDate, formatDateTime, todayInTimeZone, yearsBetween } from "@/lib/dates";
import { EMPLOYMENT_TYPES, GENDERS, labelOf } from "@/lib/constants";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/tabs";
import { Alert } from "@/components/ui/alert";
import { EmployeeStatusBadge } from "@/components/status-badge";
import { TerminateDialog, CancelTerminationButton } from "@/components/employees/terminate-dialog";
import { EmergencyContacts } from "@/components/employees/emergency-contacts";
import { AccountActions } from "@/components/employees/account-actions";
import { PhotoUpload } from "@/components/employees/photo-upload";
import { getEmployeeBalances } from "@/server/services/leave/balance.service";
import { recentRequestsFor } from "@/server/services/leave/request.service";
import { BalanceCards } from "@/components/leave/balance-cards";
import { LeaveStatusBadge, LeaveTypeLabel } from "@/components/leave/leave-badges";
import { PayrollSection } from "./payroll-section";

export const metadata: Metadata = { title: "Employee" };

function DL({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-muted-foreground text-xs">{k}</dt>
          <dd className="truncate text-sm">{v || v === 0 ? v : "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function ExpiryBadge({ date, today }: { date: Date | null; today: Date }) {
  if (!date) return <>—</>;
  const days = daysBetween(today, date);
  return (
    <span className="inline-flex items-center gap-2">
      {formatDate(date)}
      {days < 0 ? <Badge variant="destructive">Expired</Badge> : days <= 60 ? <Badge variant="warning">{days}d left</Badge> : null}
    </span>
  );
}

async function LeaveSection({ ctx, employeeId, year }: { ctx: Awaited<ReturnType<typeof requireAuth>>; employeeId: string; year: number }) {
  const [balances, requests] = await Promise.all([getEmployeeBalances(ctx, employeeId, year), recentRequestsFor(ctx, employeeId).catch(() => null)]);
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Balances {year}</h2>
      <BalanceCards balances={balances} />
      {requests && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent requests</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-muted-foreground text-sm">No leave requests yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/leave/requests/${r.id}`} className="hover:underline">
                      <LeaveTypeLabel name={r.leaveType.name} color={r.leaveType.color} />
                    </Link>
                    <span className="text-muted-foreground">
                      {formatDate(r.startDate)}
                      {r.endDate.getTime() !== r.startDate.getTime() && ` – ${formatDate(r.endDate)}`} · {r.days}d
                    </span>
                    <LeaveStatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default async function EmployeeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const ctx = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;
  const e: EmployeeDetail = await getEmployeeDetail(ctx, id).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    if (err instanceof ForbiddenError) forbidden();
    throw err;
  });
  const chain = await getReportingChain(ctx, id);
  const today = todayInTimeZone(ctx.timezone);

  // Tabs are gated on the server: only permitted tabs are listed and rendered.
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "job", label: "Job" },
    ...(e.access !== "team" ? [{ key: "documents", label: "Documents" }] : []),
    { key: "leave", label: "Leave" },
    ...(e.access === "self" || (e.access === "all" && (can(ctx, "employee.sensitive.read") || can(ctx, "payroll.salary.read"))) ? [{ key: "payroll", label: "Payroll" }] : []),
  ];
  const requested = first(sp.tab) ?? "overview";
  const tab = tabs.some((t) => t.key === requested) ? requested : "overview";
  const name = `${e.preferredName || e.firstName} ${e.lastName}`;
  const LeaveTab = () => <LeaveSection ctx={ctx} employeeId={e.id} year={today.getUTCFullYear()} />;
  const serviceYears = yearsBetween(e.joinDate, e.lastWorkingDay && e.lastWorkingDay < today ? e.lastWorkingDay : today);

  return (
    <div className="space-y-6">
      {sp.created && <Alert variant="success">Employee created.{e.account && !e.account.activated && " An invitation can be (re)sent from the Account card."}</Alert>}
      {sp.updated && <Alert variant="success">Changes saved.</Alert>}

      <nav aria-label="Reporting chain" className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
        {chain
          .slice()
          .reverse()
          .map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1">
              <Link href={`/employees/${m.id}`} className="hover:text-foreground hover:underline">
                {m.name}
              </Link>
              <ChevronRight className="size-3" aria-hidden />
            </span>
          ))}
        <span className="text-foreground">{name}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar employeeId={e.id} hasPhoto={!!e.photoPath} version={e.photoPath} firstName={e.firstName} lastName={e.lastName} size={72} />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
              <EmployeeStatusBadge status={e.status} lastWorkingDay={e.lastWorkingDay} />
            </div>
            <p className="text-muted-foreground text-sm">
              {e.position?.title ?? "No position"} · {e.department?.name ?? "No department"} · <span className="font-mono">{e.employeeNumber}</span>
            </p>
            <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href={`mailto:${e.workEmail}`} className="hover:text-foreground inline-flex items-center gap-1">
                <Mail className="size-3.5" aria-hidden /> {e.workEmail}
              </a>
              {e.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5" aria-hidden /> {e.phone}
                </span>
              )}
              {e.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {e.location.name}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {e.canEdit && (
            <Link href={`/employees/${e.id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil aria-hidden /> Edit
            </Link>
          )}
          {e.canTerminate && !e.lastWorkingDay && <TerminateDialog employeeId={e.id} name={name} minDate={e.joinDate.toISOString().slice(0, 10)} />}
          {e.canTerminate && e.lastWorkingDay && <CancelTerminationButton employeeId={e.id} />}
        </div>
      </div>

      {e.lastWorkingDay && (
        <Alert variant={e.status === "TERMINATED" ? "error" : "warning"} title={e.status === "TERMINATED" ? "Terminated" : "Termination scheduled"}>
          Last working day {formatDate(e.lastWorkingDay)} · {e.terminationReason}
          {e.terminationNotes && ` — ${e.terminationNotes}`}
        </Alert>
      )}

      <LinkTabs tabs={tabs} active={tab} baseHref={`/employees/${e.id}`} />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Personal information</CardTitle>
            </CardHeader>
            <CardContent>
              <DL
                items={[
                  ["Full name", `${e.firstName} ${e.lastName}`],
                  ["Preferred name", e.preferredName],
                  ["Date of birth", e.dateOfBirth ? `${formatDate(e.dateOfBirth)} (${yearsBetween(e.dateOfBirth, today)} yrs)` : null],
                  ["Gender", e.gender ? labelOf(GENDERS, e.gender) : null],
                  ["Nationality", e.nationality],
                  ["Marital status", e.maritalStatus],
                  ["Personal email", e.personalEmail],
                  ["Mobile", e.phone],
                  ["Address", e.address],
                ]}
              />
            </CardContent>
          </Card>
          <div className="space-y-4">
            {(e.access === "all" && e.canEdit) || e.access === "self" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Photo</CardTitle>
                </CardHeader>
                <CardContent>
                  <PhotoUpload employeeId={e.id} hasPhoto={!!e.photoPath} />
                </CardContent>
              </Card>
            ) : null}
            {e.account && can(ctx, "user.manage") && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Account</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {!e.account.isActive ? <Badge variant="destructive">Disabled</Badge> : e.account.activated ? <Badge variant="success">Active</Badge> : <Badge variant="warning">Invitation pending</Badge>}
                    {e.account.roles.map((r) => (
                      <Badge key={r.id} variant="secondary">
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-muted-foreground">Last sign-in: {formatDateTime(e.account.lastLoginAt, ctx.timezone)}</p>
                  {e.account.isActive && <AccountActions userId={e.account.id} activated={e.account.activated} />}
                </CardContent>
              </Card>
            )}
          </div>
          {e.access !== "team" && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">Emergency contacts</CardTitle>
              </CardHeader>
              <CardContent>
                <EmergencyContacts employeeId={e.id} contacts={e.emergencyContacts} canManage={e.canEdit || e.access === "self"} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "job" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Employment</CardTitle>
            </CardHeader>
            <CardContent>
              <DL
                items={[
                  ["Employee number", <span key="n" className="font-mono">{e.employeeNumber}</span>],
                  ["Employment type", labelOf(EMPLOYMENT_TYPES, e.employmentType)],
                  ["Position", e.position ? `${e.position.title}${e.position.grade ? ` · ${e.position.grade}` : ""}` : null],
                  ["Department", e.department?.name],
                  ["Location", e.location?.name],
                  ["Join date", formatDate(e.joinDate)],
                  ["Years of service", `${serviceYears} ${serviceYears === 1 ? "year" : "years"}`],
                  ["Probation end", e.probationEndDate ? (
                    <span key="p" className="inline-flex items-center gap-2">
                      {formatDate(e.probationEndDate)}
                      {e.probationEndDate >= today ? <Badge variant="secondary">On probation</Badge> : <Badge variant="success">Confirmed</Badge>}
                    </span>
                  ) : null],
                  ["Last working day", e.lastWorkingDay ? formatDate(e.lastWorkingDay) : null],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reporting line</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Manager</p>
                {e.manager ? (
                  <Link href={`/employees/${e.manager.id}`} className="hover:underline">
                    {e.manager.preferredName || e.manager.firstName} {e.manager.lastName}
                    <span className="text-muted-foreground"> · {e.manager.position?.title}</span>
                  </Link>
                ) : (
                  "—"
                )}
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Direct reports ({e.directReports.length})</p>
                {e.directReports.length === 0 ? (
                  "—"
                ) : (
                  <ul className="space-y-1">
                    {e.directReports.map((r) => (
                      <li key={r.id}>
                        <Link href={`/employees/${r.id}`} className="hover:underline">
                          {r.preferredName || r.firstName} {r.lastName}
                        </Link>
                        <span className="text-muted-foreground"> · {r.position?.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "documents" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">UAE identity documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!e.canSeeSensitive && <Alert>Document numbers are masked. You need the &ldquo;view sensitive data&rdquo; permission to see them in full.</Alert>}
            <DL
              items={[
                ["Emirates ID", <span key="eid" className="font-mono">{e.emiratesIdNumber ?? "—"}</span>],
                ["Emirates ID expiry", <ExpiryBadge key="eidx" date={e.emiratesIdExpiry} today={today} />],
                ["Passport", <span key="pp" className="font-mono">{e.passportNumber ?? "—"}</span>],
                ["Passport expiry", <ExpiryBadge key="ppx" date={e.passportExpiry} today={today} />],
                ["Visa", <span key="v" className="font-mono">{e.visaNumber ?? "—"}</span>],
                ["Visa expiry", <ExpiryBadge key="vx" date={e.visaExpiry} today={today} />],
                ["Labour card", <span key="lc" className="font-mono">{e.labourCardNumber ?? "—"}</span>],
                ["Labour card expiry", <ExpiryBadge key="lcx" date={e.labourCardExpiry} today={today} />],
              ]}
            />
            <p className="text-muted-foreground text-xs">Document uploads and automatic expiry alerts arrive in Phase 4.</p>
          </CardContent>
        </Card>
      )}

      {tab === "leave" && <LeaveTab />}

      {tab === "payroll" && <PayrollSection ctx={ctx} e={e} today={today} />}
    </div>
  );
}
