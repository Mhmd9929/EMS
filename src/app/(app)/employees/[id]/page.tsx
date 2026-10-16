import type { Metadata } from "next";
import Link from "next/link";
import { notFound, forbidden } from "next/navigation";
import { ChevronRight, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { requireAuth, can } from "@/server/auth/context";
import { getEmployeeDetail, getReportingChain, type EmployeeDetail } from "@/server/services/employee.service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { first, type SearchParams } from "@/lib/list-params";
import { useLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { daysBetween, todayInTimeZone, yearsBetween } from "@/lib/dates";
import { TERMINATION_REASONS } from "@/lib/constants";
import { createFormat } from "@/lib/format";
import { getFormat } from "@/server/i18n";
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

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("employees"))("meta.detail") };
}

const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"] as const;
const isOneOf = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v);

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
  const t = useTranslations("employees.detail.documents");
  const f = createFormat(useLocale());
  if (!date) return <>—</>;
  const days = daysBetween(today, date);
  return (
    <span className="inline-flex items-center gap-2">
      {f.date(date)}
      {days < 0 ? <Badge variant="destructive">{t("expired")}</Badge> : days <= 60 ? <Badge variant="warning">{t("daysLeft", { count: days })}</Badge> : null}
    </span>
  );
}

async function LeaveSection({ ctx, employeeId, year }: { ctx: Awaited<ReturnType<typeof requireAuth>>; employeeId: string; year: number }) {
  const [balances, requests] = await Promise.all([getEmployeeBalances(ctx, employeeId, year), recentRequestsFor(ctx, employeeId).catch(() => null)]);
  const [t, f] = await Promise.all([getTranslations("employees.detail.leave"), getFormat()]);
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{t("balances", { year: String(year) })}</h2>
      <BalanceCards balances={balances} />
      {requests && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("recentRequests")}</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noRequests")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/leave/requests/${r.id}`} className="hover:underline">
                      <LeaveTypeLabel name={r.leaveType.name} color={r.leaveType.color} />
                    </Link>
                    <span className="text-muted-foreground">
                      {f.date(r.startDate)}
                      {r.endDate.getTime() !== r.startDate.getTime() && ` – ${f.date(r.endDate)}`} · {t("days", { count: Number(r.days) })}
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
  const [t, tc, te, f] = await Promise.all([getTranslations("employees"), getTranslations("common"), getTranslations("enums"), getFormat()]);
  const reasonLabel = (r: string | null) => (r && isOneOf(TERMINATION_REASONS, r) ? te(`terminationReason.${r}`) : r);
  const maritalLabel = (m: string | null) => (m && isOneOf(MARITAL_STATUSES, m) ? t(`maritalStatus.${m}`) : m);

  // Tabs are gated on the server: only permitted tabs are listed and rendered.
  const tabs = [
    { key: "overview", label: t("detail.tabs.overview") },
    { key: "job", label: t("detail.tabs.job") },
    ...(e.access !== "team" ? [{ key: "documents", label: t("detail.tabs.documents") }] : []),
    { key: "leave", label: t("detail.tabs.leave") },
    ...(e.access === "self" || (e.access === "all" && (can(ctx, "employee.sensitive.read") || can(ctx, "payroll.salary.read"))) ? [{ key: "payroll", label: t("detail.tabs.payroll") }] : []),
  ];
  const requested = first(sp.tab) ?? "overview";
  const tab = tabs.some((x) => x.key === requested) ? requested : "overview";
  const name = `${e.preferredName || e.firstName} ${e.lastName}`;
  const LeaveTab = () => <LeaveSection ctx={ctx} employeeId={e.id} year={today.getUTCFullYear()} />;
  const serviceYears = yearsBetween(e.joinDate, e.lastWorkingDay && e.lastWorkingDay < today ? e.lastWorkingDay : today);

  return (
    <div className="space-y-6">
      {sp.created && <Alert variant="success">{e.account && !e.account.activated ? t("detail.createdInviteAlert") : t("detail.createdAlert")}</Alert>}
      {sp.updated && <Alert variant="success">{t("detail.updatedAlert")}</Alert>}

      <nav aria-label={t("detail.reportingChain")} className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
        {chain
          .slice()
          .reverse()
          .map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1">
              <Link href={`/employees/${m.id}`} className="hover:text-foreground hover:underline">
                {m.name}
              </Link>
              <ChevronRight className="size-3 rtl:-scale-x-100" aria-hidden />
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
              {e.position?.title ?? t("detail.noPosition")} · {e.department?.name ?? t("detail.noDepartment")} ·{" "}
              <span className="font-mono" dir="ltr">
                {e.employeeNumber}
              </span>
            </p>
            <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href={`mailto:${e.workEmail}`} className="hover:text-foreground inline-flex items-center gap-1">
                <Mail className="size-3.5" aria-hidden /> <span dir="ltr">{e.workEmail}</span>
              </a>
              {e.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3.5" aria-hidden /> <span dir="ltr">{e.phone}</span>
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
              <Pencil aria-hidden /> {tc("edit")}
            </Link>
          )}
          {e.canTerminate && !e.lastWorkingDay && <TerminateDialog employeeId={e.id} name={name} minDate={e.joinDate.toISOString().slice(0, 10)} />}
          {e.canTerminate && e.lastWorkingDay && <CancelTerminationButton employeeId={e.id} />}
        </div>
      </div>

      {e.lastWorkingDay && (
        <Alert variant={e.status === "TERMINATED" ? "error" : "warning"} title={e.status === "TERMINATED" ? t("detail.terminated") : t("detail.terminationScheduled")}>
          {t("detail.lastWorkingDayLine", { date: f.date(e.lastWorkingDay), reason: reasonLabel(e.terminationReason) ?? "" })}
          {e.terminationNotes && ` — ${e.terminationNotes}`}
        </Alert>
      )}

      <LinkTabs tabs={tabs} active={tab} baseHref={`/employees/${e.id}`} />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t("detail.personal.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <DL
                items={[
                  [t("detail.personal.fullName"), `${e.firstName} ${e.lastName}`],
                  [t("detail.personal.preferredName"), e.preferredName],
                  [t("detail.personal.dateOfBirth"), e.dateOfBirth ? t("detail.personal.dateWithAge", { date: f.date(e.dateOfBirth), years: yearsBetween(e.dateOfBirth, today) }) : null],
                  [t("detail.personal.gender"), e.gender ? te(`gender.${e.gender}`) : null],
                  [t("detail.personal.nationality"), e.nationality],
                  [t("detail.personal.maritalStatus"), maritalLabel(e.maritalStatus)],
                  [t("detail.personal.personalEmail"), e.personalEmail ? <span key="pe" dir="ltr">{e.personalEmail}</span> : null],
                  [t("detail.personal.mobile"), e.phone ? <span key="ph" dir="ltr">{e.phone}</span> : null],
                  [t("detail.personal.address"), e.address],
                ]}
              />
            </CardContent>
          </Card>
          <div className="space-y-4">
            {(e.access === "all" && e.canEdit) || e.access === "self" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("detail.photo")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <PhotoUpload employeeId={e.id} hasPhoto={!!e.photoPath} />
                </CardContent>
              </Card>
            ) : null}
            {e.account && can(ctx, "user.manage") && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("detail.account.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {!e.account.isActive ? (
                      <Badge variant="destructive">{t("detail.account.disabled")}</Badge>
                    ) : e.account.activated ? (
                      <Badge variant="success">{t("detail.account.active")}</Badge>
                    ) : (
                      <Badge variant="warning">{t("detail.account.invitationPending")}</Badge>
                    )}
                    {e.account.roles.map((r) => (
                      <Badge key={r.id} variant="secondary">
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-muted-foreground">{t("detail.account.lastSignIn", { date: f.dateTime(e.account.lastLoginAt, ctx.timezone) })}</p>
                  {e.account.isActive && <AccountActions userId={e.account.id} activated={e.account.activated} />}
                </CardContent>
              </Card>
            )}
          </div>
          {e.access !== "team" && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">{t("detail.emergencyContacts")}</CardTitle>
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
              <CardTitle className="text-base">{t("detail.job.employment")}</CardTitle>
            </CardHeader>
            <CardContent>
              <DL
                items={[
                  [t("detail.job.employeeNumber"), <span key="n" className="font-mono" dir="ltr">{e.employeeNumber}</span>],
                  [t("detail.job.employmentType"), te(`employmentType.${e.employmentType}`)],
                  [tc("position"), e.position ? `${e.position.title}${e.position.grade ? ` · ${e.position.grade}` : ""}` : null],
                  [tc("department"), e.department?.name],
                  [tc("location"), e.location?.name],
                  [t("detail.job.joinDate"), f.date(e.joinDate)],
                  [t("detail.job.yearsOfService"), t("detail.job.years", { count: serviceYears })],
                  [t("detail.job.probationEnd"), e.probationEndDate ? (
                    <span key="p" className="inline-flex items-center gap-2">
                      {f.date(e.probationEndDate)}
                      {e.probationEndDate >= today ? <Badge variant="secondary">{t("detail.job.onProbation")}</Badge> : <Badge variant="success">{t("detail.job.confirmed")}</Badge>}
                    </span>
                  ) : null],
                  [t("detail.job.lastWorkingDay"), e.lastWorkingDay ? f.date(e.lastWorkingDay) : null],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("detail.job.reportingLine")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1 text-xs">{tc("manager")}</p>
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
                <p className="text-muted-foreground mb-1 text-xs">{t("detail.job.directReports", { count: e.directReports.length })}</p>
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
            <CardTitle className="text-base">{t("detail.documents.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!e.canSeeSensitive && <Alert>{t("detail.documents.masked")}</Alert>}
            <DL
              items={[
                [t("detail.documents.emiratesId"), <span key="eid" className="font-mono" dir="ltr">{e.emiratesIdNumber ?? "—"}</span>],
                [t("detail.documents.emiratesIdExpiry"), <ExpiryBadge key="eidx" date={e.emiratesIdExpiry} today={today} />],
                [t("detail.documents.passport"), <span key="pp" className="font-mono" dir="ltr">{e.passportNumber ?? "—"}</span>],
                [t("detail.documents.passportExpiry"), <ExpiryBadge key="ppx" date={e.passportExpiry} today={today} />],
                [t("detail.documents.visa"), <span key="v" className="font-mono" dir="ltr">{e.visaNumber ?? "—"}</span>],
                [t("detail.documents.visaExpiry"), <ExpiryBadge key="vx" date={e.visaExpiry} today={today} />],
                [t("detail.documents.labourCard"), <span key="lc" className="font-mono" dir="ltr">{e.labourCardNumber ?? "—"}</span>],
                [t("detail.documents.labourCardExpiry"), <ExpiryBadge key="lcx" date={e.labourCardExpiry} today={today} />],
              ]}
            />
            <p className="text-muted-foreground text-xs">{t("detail.documents.comingSoon")}</p>
          </CardContent>
        </Card>
      )}

      {tab === "leave" && <LeaveTab />}

      {tab === "payroll" && <PayrollSection ctx={ctx} e={e} today={today} />}
    </div>
  );
}
