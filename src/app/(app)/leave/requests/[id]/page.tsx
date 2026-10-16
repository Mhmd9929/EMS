import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { CheckCircle2, Circle, Clock, FileText, MinusCircle, XCircle } from "lucide-react";
import { requireAuth } from "@/server/auth/context";
import { getLeaveRequest } from "@/server/services/leave/request.service";
import { getEmployeeBalances } from "@/server/services/leave/balance.service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { getTranslations } from "next-intl/server";
import { getFormat } from "@/server/i18n";
import { num } from "@/lib/leave/numbers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LeaveStatusBadge, LeaveTypeLabel } from "@/components/leave/leave-badges";
import { DecisionForm, HrCancelButton, RequestCancellationButton, WithdrawButton } from "@/components/leave/request-actions";
import { displayName } from "@/lib/utils-names";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("leave"))("meta.request") };
}

const DECISION_ICON = { APPROVED: CheckCircle2, REJECTED: XCircle, PENDING: Clock, SKIPPED: MinusCircle } as const;

export default async function LeaveRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;
  const { submitted } = await searchParams;
  const data = await getLeaveRequest(ctx, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    if (e instanceof ForbiddenError) forbidden();
    throw e;
  });
  const r = data.request;
  const year = r.startDate.getUTCFullYear();
  const typeBalance = data.canDecide ? (await getEmployeeBalances(ctx, r.employeeId, year)).find((b) => b.leaveType.id === r.leaveTypeId) : null;
  const isCancellationStep = r.status === "CANCELLATION_REQUESTED";
  const [t, tc, te, f] = await Promise.all([getTranslations("leave.request"), getTranslations("common"), getTranslations("enums"), getFormat()]);
  const tl = await getTranslations("leave");
  const approverName = (a: (typeof r.approvals)[number]) => (a.approverRole === "HR" || !a.approver ? te("approvalRole.HR") : a.approver.name);

  return (
    <div className="space-y-6">
      {submitted && (
        <Alert variant="success" title={r.status === "APPROVED" ? te("leaveStatus.APPROVED") : t("submittedTitle")}>
          {r.status === "APPROVED" ? t("autoApproved") : t("approverNotified")}
        </Alert>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">
            <Link href={r.employeeId === ctx.employeeId ? "/leave" : "/leave/approvals"} className="hover:underline">
              {t("breadcrumbLeave")}
            </Link>{" "}
            / {t("breadcrumbRequest")}
          </p>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            <LeaveTypeLabel name={r.leaveType.name} color={r.leaveType.color} />
            <LeaveStatusBadge status={r.status} />
          </h1>
          <p className="text-muted-foreground">
            {f.date(r.startDate)}
            {r.endDate.getTime() !== r.startDate.getTime() && ` – ${f.date(r.endDate)}`} · {tc("days", { count: num(r.days) })}
            {r.halfDay !== "NONE" && ` (${tl(`halfDayPart.${r.halfDay}`)})`}
            {!r.leaveType.isPaid && ` · ${t("unpaid")}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.canWithdraw && <WithdrawButton requestId={r.id} />}
          {data.canRequestCancellation && <RequestCancellationButton requestId={r.id} />}
          {data.canHrCancel && <HrCancelButton requestId={r.id} />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tc("details")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <Avatar employeeId={r.employee.id} hasPhoto={!!r.employee.photoPath} firstName={r.employee.firstName} lastName={r.employee.lastName} size={40} />
                <div>
                  <p className="font-medium">{displayName(r.employee)}</p>
                  <p className="text-muted-foreground text-xs">
                    {r.employee.position?.title ?? "—"} · {r.employee.department?.name ?? "—"} · {r.employee.employeeNumber}
                  </p>
                </div>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground text-xs">{tc("reason")}</dt>
                  <dd className="whitespace-pre-wrap">{r.reason || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">{t("requested")}</dt>
                  <dd>{f.dateTime(r.createdAt, ctx.timezone)}</dd>
                </div>
                {r.cancellationReason && (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-xs">{t("cancellationReason")}</dt>
                    <dd>{r.cancellationReason}</dd>
                  </div>
                )}
                {r.attachmentPath && (
                  <div>
                    <dt className="text-muted-foreground text-xs">{t("attachment")}</dt>
                    <dd>
                      <a href={`/api/files/leave/${r.id}`} target="_blank" rel="noopener" className="text-link inline-flex items-center gap-1 hover:underline">
                        <FileText className="size-4" aria-hidden /> {t("viewDocument")}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {data.canDecide && (
            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle className="text-base">{isCancellationStep ? t("decideCancellation") : t("yourDecision")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {typeBalance && typeBalance.tracked && (
                  <p className="text-muted-foreground text-sm">
                    {t.rich("balanceNote", {
                      name: displayName(r.employee),
                      type: r.leaveType.name,
                      year: String(year),
                      available: String(typeBalance.available),
                      strong: (chunks) => <strong className="text-foreground">{chunks}</strong>,
                    })}
                  </p>
                )}
                <DecisionForm requestId={r.id} isCancellation={isCancellationStep} onBehalfOf={data.actingOnBehalfOf ? (r.approvals.find((a) => a.approverUserId === data.actingOnBehalfOf)?.approver?.name ?? null) : null} />
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">{t("trail")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex gap-3">
                <Circle className="text-link mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="text-sm">
                  <p className="font-medium">{t("submitted")}</p>
                  <p className="text-muted-foreground text-xs">{f.dateTime(r.createdAt, ctx.timezone)}</p>
                </div>
              </li>
              {r.approvals.map((a) => {
                const Icon = DECISION_ICON[a.decision];
                const waiting = a.decision === "PENDING" && a.activatedAt;
                return (
                  <li key={a.id} className="flex gap-3">
                    <Icon
                      className={`mt-0.5 size-4 shrink-0 ${a.decision === "APPROVED" ? "text-success" : a.decision === "REJECTED" ? "text-destructive" : waiting ? "text-warning" : "text-muted-foreground"}`}
                      aria-hidden
                    />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {a.kind === "CANCELLATION" ? t("cancellationPrefix") : ""}
                        {a.approverRole === "HR" ? t("hrApproval") : t("managerApproval")}
                        <Badge variant="outline" className="ms-2 align-middle">
                          {a.decision === "PENDING" ? (waiting ? t("waiting") : t("notStarted")) : t(`decision.${a.decision}`)}
                        </Badge>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {a.actedBy
                          ? t(a.onBehalfOfId ? "actedByDelegate" : "actedBy", { name: a.actedBy.name, date: f.dateTime(a.actedAt, ctx.timezone) })
                          : waiting
                            ? t("waitingFor", { name: approverName(a), date: f.dateTime(a.activatedAt, ctx.timezone) })
                            : approverName(a)}
                      </p>
                      {a.comment && <p className="mt-1 rounded-md bg-muted px-2 py-1 text-xs">“{a.comment}”</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
