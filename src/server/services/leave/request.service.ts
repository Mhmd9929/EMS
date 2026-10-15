import "server-only";
import { Prisma, type LeaveRequestStatus, type LeaveType } from "@prisma/client";
import { db, type DbClient } from "@/server/db";
import type { AuthContext } from "@/server/auth/permissions";
import { getEmployeeAccess, getTeamEmployeeIds, getVisibleEmployeeScope } from "@/server/rbac/scope";
import { writeAudit } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { addDays, formatDate, todayInTimeZone, toDateInput } from "@/lib/dates";
import { countLeaveDays, type DayCount } from "@/lib/leave/days";
import { eligibilityDate } from "@/lib/leave/accrual";
import { effectiveRules } from "@/lib/leave/policy";
import { formatDays, num, round2 } from "@/lib/leave/numbers";
import { paginated, type ListParams } from "@/lib/list-params";
import type { LeaveApplyInput } from "@/lib/validation/leave";
import { BOOKED_STATUSES, displayName, holidaySet, leaveEmployeeSelect, loadPolicies, typeRules, type LeaveEmployee } from "./common";
import { computeBalances, loadLeaveEmployee, projectedCredits } from "./balance.service";
import { delegatorsFor, stepRecipients } from "./approvers";
import { deliverEmailsInBackground, notify } from "../notification.service";

const BACKDATE_LIMIT_DAYS = 30;

// ───────────────────────────── Evaluation (preview + submit) ─────────────────────────────

export type LeaveEvaluation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  count: { total: number; byYear: Record<number, number>; skipped: { date: string; reason: string }[] } | null;
  balances: { year: number; available: number; projected: number; requested: number; after: number; tracked: boolean }[];
  attachmentRequired: boolean;
  teammatesOff: { name: string; from: string; to: string }[];
  approvalSteps: string[];
};

/**
 * Validate a leave request against the leave type's rules, the calendar and the employee's balance.
 * Pure read: used for the live preview and again (inside the transaction) on submit.
 */
export async function evaluateLeave(
  client: DbClient,
  e: LeaveEmployee,
  type: LeaveType,
  input: Pick<LeaveApplyInput, "startDate" | "endDate" | "halfDay">,
  opts: { timezone: string; workWeek: number[]; hasAttachment?: boolean; excludeRequestId?: string },
): Promise<LeaveEvaluation & { dayCount: DayCount | null }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const today = todayInTimeZone(opts.timezone);
  const { startDate: start, endDate: end, halfDay } = input;
  const result = (extra: Partial<LeaveEvaluation> & { dayCount?: DayCount | null } = {}) => ({
    ok: errors.length === 0,
    errors,
    warnings,
    count: null,
    balances: [],
    attachmentRequired: false,
    teammatesOff: [],
    approvalSteps: type.approvalChain,
    dayCount: null,
    ...extra,
  });

  if (!type.isActive) errors.push(`${type.name} is not available.`);
  if (e.status === "TERMINATED") errors.push("Terminated employees cannot apply for leave.");
  if (end < start) {
    errors.push("The end date is before the start date.");
    return result();
  }
  if (halfDay !== "NONE" && start.getTime() !== end.getTime()) errors.push("Half days can only be requested for a single day.");
  if (halfDay !== "NONE" && !type.allowHalfDay) errors.push(`${type.name} cannot be taken as a half day.`);
  if (errors.length) return result();

  const policies = await loadPolicies(client, e.companyId);
  const rules = effectiveRules(typeRules(type), policies, {
    departmentId: e.departmentId,
    positionId: e.positionId,
    employmentType: e.employmentType,
    gender: e.gender,
    joinDate: e.joinDate,
  });
  if (!rules.eligible) errors.push(rules.reason!);
  const eligibleFrom = eligibilityDate(type, e.joinDate);
  if (start < eligibleFrom) errors.push(`${type.name} can be used from ${formatDate(eligibleFrom)} (after ${type.accrualStartAfterMonths} months of service).`);
  if (start < e.joinDate) errors.push("Leave cannot start before your join date.");
  if (e.lastWorkingDay && end > e.lastWorkingDay) errors.push(`Leave cannot extend past your last working day (${formatDate(e.lastWorkingDay)}).`);

  if (type.minNoticeDays > 0) {
    const earliest = addDays(today, type.minNoticeDays);
    if (start < earliest) errors.push(`${type.name} needs ${type.minNoticeDays} days' notice — the earliest start date is ${formatDate(earliest)}.`);
  } else if (start < addDays(today, -BACKDATE_LIMIT_DAYS)) {
    errors.push(`${type.name} can be backdated by at most ${BACKDATE_LIMIT_DAYS} days.`);
  }

  let dayCount: DayCount;
  try {
    const holidays = await holidaySet(client, e.companyId, e.locationId, start, end);
    dayCount = countLeaveDays({ start, end, halfDay, workWeek: opts.workWeek, holidays, countWeekends: type.countWeekends, countHolidays: type.countHolidays });
  } catch (err) {
    errors.push(err instanceof RangeError ? err.message : "Invalid date range.");
    return result();
  }
  const count = {
    total: dayCount.total,
    byYear: dayCount.byYear,
    skipped: dayCount.skipped.map((s) => ({ date: toDateInput(s.date), reason: s.reason })),
  };
  if (dayCount.total === 0) errors.push("The selected dates are all weekends or public holidays — there is nothing to book.");
  if (type.maxConsecutiveDays && dayCount.total > type.maxConsecutiveDays) {
    errors.push(`${type.name} allows at most ${type.maxConsecutiveDays} days in one request.`);
  }
  const attachmentRequired = type.requiresAttachmentAfterDays !== null && dayCount.total > type.requiresAttachmentAfterDays;
  if (attachmentRequired && opts.hasAttachment === false) {
    errors.push(type.requiresAttachmentAfterDays === 0 ? `${type.name} requires a supporting document.` : `A supporting document is required for more than ${type.requiresAttachmentAfterDays} days of ${type.name}.`);
  }

  // Overlaps with the employee's own booked leave
  const overlapping = await client.leaveRequest.findMany({
    where: {
      employeeId: e.id,
      status: { in: [...BOOKED_STATUSES] },
      startDate: { lte: end },
      endDate: { gte: start },
      ...(opts.excludeRequestId && { id: { not: opts.excludeRequestId } }),
    },
    include: { leaveType: { select: { name: true } } },
  });
  for (const o of overlapping) {
    errors.push(`Overlaps your ${o.leaveType.name} request ${formatDate(o.startDate)} – ${formatDate(o.endDate)} (${o.status.toLowerCase().replace("_", " ")}).`);
  }

  // Balance per leave year
  const balances: LeaveEvaluation["balances"] = [];
  const tracked = type.accrualMethod !== "NONE";
  const years = Object.keys(dayCount.byYear).map(Number);
  if (years.length) {
    const balanceByYear = new Map<number, number>();
    for (const year of years) {
      const { balances: all } = await computeBalances(e.companyId, [e], year, { typeIds: [type.id] });
      let available = all.get(e.id)![0].available;
      if (opts.excludeRequestId) {
        const own = await client.leaveRequestDay.aggregate({
          where: { requestId: opts.excludeRequestId, date: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } },
          _sum: { amount: true },
        });
        available = round2(available + num(own._sum.amount));
      }
      balanceByYear.set(year, available);
    }
    for (const year of years) {
      const requested = dayCount.byYear[year];
      const firstDay = dayCount.days.find((d) => d.date.getUTCFullYear() === year)!.date;
      let projected = tracked ? await projectedCredits(e.companyId, e, type, year, firstDay, policies) : 0;
      // Booking next year's leave before year end: count what will carry forward from this year.
      const currentYear = today.getUTCFullYear();
      if (tracked && year === currentYear + 1 && num(type.carryForwardMax) > 0) {
        const closed = await client.leaveLedgerEntry.count({ where: { employeeId: e.id, leaveTypeId: type.id, periodKey: `cf-${year}` } });
        if (!closed) {
          const { balances: cur } = await computeBalances(e.companyId, [e], currentYear, { typeIds: [type.id] });
          const leftThisYear = round2(cur.get(e.id)![0].available - (dayCount.byYear[currentYear] ?? 0));
          projected = round2(projected + Math.max(0, Math.min(leftThisYear, num(type.carryForwardMax))));
        }
      }
      const available = balanceByYear.get(year)!;
      const after = round2(available + projected - requested);
      balances.push({ year, available, projected, requested, after, tracked });
      if (tracked && after < 0) {
        if (type.allowNegativeBalance) warnings.push(`This takes your ${type.name} balance for ${year} to ${formatDays(after)}.`);
        else errors.push(`Not enough ${type.name} balance for ${year}: ${formatDays(round2(available + projected))} available, ${formatDays(requested)} requested.`);
      }
    }
  }

  // Colleagues already off (same manager or same department) — names and dates only, never leave types.
  const colleagues = await client.leaveRequest.findMany({
    where: {
      companyId: e.companyId,
      employeeId: { not: e.id },
      status: { in: ["APPROVED", "PENDING", "CANCELLATION_REQUESTED"] },
      startDate: { lte: end },
      endDate: { gte: start },
      employee: {
        status: { not: "TERMINATED" },
        OR: [...(e.managerId ? [{ managerId: e.managerId }] : []), ...(e.departmentId ? [{ departmentId: e.departmentId }] : []), { managerId: e.id }],
      },
    },
    select: { startDate: true, endDate: true, employee: { select: { firstName: true, lastName: true, preferredName: true } } },
    orderBy: { startDate: "asc" },
    take: 10,
  });
  const teammatesOff = colleagues.map((c) => ({ name: displayName(c.employee), from: toDateInput(c.startDate), to: toDateInput(c.endDate) }));
  if (teammatesOff.length) warnings.push(`${teammatesOff.length} ${teammatesOff.length === 1 ? "colleague is" : "colleagues are"} also off during these dates.`);

  return { ...result({ count, balances, attachmentRequired, teammatesOff }), dayCount, ok: errors.length === 0 };
}

async function contextEmployee(ctx: AuthContext) {
  if (!ctx.employeeId) throw new ValidationError("Your account is not linked to an employee record.");
  return loadLeaveEmployee(db, ctx.companyId, ctx.employeeId);
}

async function loadType(client: DbClient, companyId: string, leaveTypeId: string) {
  const type = await client.leaveType.findFirst({ where: { id: leaveTypeId, companyId } });
  if (!type) throw new ValidationError("Choose a leave type.", { leaveTypeId: ["Unknown leave type"] });
  return type;
}

/** Live preview for the apply form. */
export async function previewLeave(ctx: AuthContext, input: Pick<LeaveApplyInput, "leaveTypeId" | "startDate" | "endDate" | "halfDay">): Promise<LeaveEvaluation> {
  const e = await contextEmployee(ctx);
  const type = await loadType(db, ctx.companyId, input.leaveTypeId);
  const { dayCount, ...evaluation } = await evaluateLeave(db, e, type, input, { timezone: ctx.timezone, workWeek: ctx.workWeek });
  void dayCount;
  return evaluation;
}

/** Leave types the current user can choose from, with eligibility. */
export async function applicableLeaveTypes(ctx: AuthContext) {
  const e = await contextEmployee(ctx);
  const [types, policies] = await Promise.all([
    db.leaveType.findMany({ where: { companyId: ctx.companyId, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    loadPolicies(db, ctx.companyId),
  ]);
  return types.map((t) => {
    const rules = effectiveRules(typeRules(t), policies, { departmentId: e.departmentId, positionId: e.positionId, employmentType: e.employmentType, gender: e.gender, joinDate: e.joinDate });
    return {
      id: t.id,
      name: t.name,
      code: t.code,
      color: t.color,
      description: t.description,
      allowHalfDay: t.allowHalfDay,
      minNoticeDays: t.minNoticeDays,
      requiresAttachmentAfterDays: t.requiresAttachmentAfterDays,
      isPaid: t.isPaid,
      eligible: rules.eligible,
      reason: rules.reason,
    };
  });
}

// ───────────────────────────── Submit ─────────────────────────────

export async function submitLeave(ctx: AuthContext, input: LeaveApplyInput & { attachmentPath: string | null }) {
  const notificationIds: string[] = [];
  const request = await db.$transaction(
    async (tx) => {
      // Serialise submissions per employee so two tabs can't double-book.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`leave:${ctx.employeeId}`}))`;
      const e = await contextEmployee(ctx);
      const type = await loadType(tx, ctx.companyId, input.leaveTypeId);
      const evaluation = await evaluateLeave(tx, e, type, input, { timezone: ctx.timezone, workWeek: ctx.workWeek, hasAttachment: !!input.attachmentPath });
      if (!evaluation.ok || !evaluation.dayCount) throw new ValidationError(evaluation.errors[0] ?? "This request is not valid.", { _form: evaluation.errors });

      const managerUserId = e.manager?.userId && e.manager.user?.isActive ? e.manager.userId : null;
      const chain = type.approvalChain.filter((s) => s === "MANAGER" || s === "HR");
      const steps = chain.map((role) => ({ role, approverUserId: role === "MANAGER" ? managerUserId : null }));
      // No manager and an HR step follows: skip the manager step instead of asking HR twice.
      const skipped = steps.map((s, i) => s.role === "MANAGER" && !s.approverUserId && steps.slice(i + 1).some((n) => n.role === "HR"));
      const firstActive = skipped.findIndex((s) => !s);
      const autoApprove = steps.length === 0 || firstActive === -1;
      const now = new Date();

      const created = await tx.leaveRequest.create({
        data: {
          companyId: ctx.companyId,
          employeeId: e.id,
          leaveTypeId: type.id,
          startDate: input.startDate,
          endDate: input.endDate,
          halfDay: input.halfDay,
          days: evaluation.dayCount.total,
          reason: input.reason,
          attachmentPath: input.attachmentPath,
          status: autoApprove ? "APPROVED" : "PENDING",
          currentStep: autoApprove ? 0 : firstActive,
          decidedAt: autoApprove ? now : null,
          createdById: ctx.userId,
          dayRows: { create: evaluation.dayCount.days.map((d) => ({ date: d.date, amount: d.amount })) },
          approvals: {
            create: steps.map((s, i) => ({
              kind: "REQUEST" as const,
              step: i,
              approverRole: s.role,
              approverUserId: s.approverUserId,
              decision: skipped[i] ? ("SKIPPED" as const) : ("PENDING" as const),
              activatedAt: i === firstActive ? now : null,
              comment: skipped[i] ? "No line manager — routed to HR" : null,
            })),
          },
        },
        include: { approvals: true },
      });
      await writeAudit(ctx, {
        action: "leave.request.submit",
        entityType: "LeaveRequest",
        entityId: created.id,
        summary: `${type.name} ${toDateInput(created.startDate)} → ${toDateInput(created.endDate)} (${formatDays(evaluation.dayCount.total)})${autoApprove ? " — auto-approved" : ""}`,
        after: { leaveType: type.code, startDate: created.startDate, endDate: created.endDate, halfDay: created.halfDay, days: evaluation.dayCount.total, status: created.status },
      }, tx);

      const summary = `${displayName(e)} requested ${formatDays(evaluation.dayCount.total)} of ${type.name} (${formatDate(created.startDate)} – ${formatDate(created.endDate)}).`;
      if (!autoApprove) {
        const active = created.approvals.find((a) => a.step === firstActive)!;
        const recipients = await stepRecipients(tx, ctx.companyId, active, e.userId, todayInTimeZone(ctx.timezone));
        notificationIds.push(
          ...(await notify(tx, { companyId: ctx.companyId, userIds: recipients, type: "leave.submitted", title: `Leave request from ${displayName(e)}`, body: `${summary} Please review it.`, link: `/leave/requests/${created.id}` })),
        );
      }
      notificationIds.push(
        ...(await notify(tx, {
          companyId: ctx.companyId,
          userIds: [e.userId],
          type: autoApprove ? "leave.approved" : "leave.submitted_self",
          title: autoApprove ? `${type.name} approved` : `${type.name} request submitted`,
          body: autoApprove ? `Your ${type.name} (${formatDate(created.startDate)} – ${formatDate(created.endDate)}) was approved automatically.` : `Your request was sent for approval (${chain.join(" → ")}).`,
          link: `/leave/requests/${created.id}`,
          email: autoApprove,
        })),
      );
      return created;
    },
    { timeout: 20_000 },
  );
  deliverEmailsInBackground(notificationIds);
  return request;
}

// ───────────────────────────── Access ─────────────────────────────

const requestInclude = {
  leaveType: true,
  employee: { select: { ...leaveEmployeeSelect, employeeNumber: true, photoPath: true, department: { select: { name: true } }, position: { select: { title: true } } } },
  approvals: {
    orderBy: [{ kind: "asc" as const }, { step: "asc" as const }],
    include: {
      approver: { select: { id: true, name: true } },
      actedBy: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.LeaveRequestInclude;

export type LeaveRequestDetail = Prisma.LeaveRequestGetPayload<{ include: typeof requestInclude }>;

function currentApproval(r: { status: LeaveRequestStatus; approvals: { kind: string; decision: string; activatedAt: Date | null; step: number }[] }) {
  const kind = r.status === "CANCELLATION_REQUESTED" ? "CANCELLATION" : r.status === "PENDING" ? "REQUEST" : null;
  if (!kind) return null;
  return r.approvals.find((a) => a.kind === kind && a.decision === "PENDING" && a.activatedAt) ?? null;
}

/** Can the user act on the request's current approval step? Returns the delegator id when acting as a delegate. */
async function actingAs(ctx: AuthContext, r: LeaveRequestDetail): Promise<{ allowed: boolean; onBehalfOfId: string | null }> {
  const approval = currentApproval(r) as (LeaveRequestDetail["approvals"][number] | null);
  if (!approval) return { allowed: false, onBehalfOfId: null };
  if (r.employee.userId === ctx.userId) return { allowed: false, onBehalfOfId: null }; // never approve your own leave
  if (approval.approverRole === "MANAGER" && approval.approverUserId) {
    if (approval.approverUserId === ctx.userId) return { allowed: true, onBehalfOfId: null };
    const delegators = await delegatorsFor(db, ctx.userId, todayInTimeZone(ctx.timezone));
    if (delegators.includes(approval.approverUserId)) return { allowed: true, onBehalfOfId: approval.approverUserId };
  }
  if (ctx.permissions.has("leave.approve.all")) return { allowed: true, onBehalfOfId: null };
  return { allowed: false, onBehalfOfId: null };
}

async function canView(ctx: AuthContext, r: LeaveRequestDetail) {
  if (r.employeeId === ctx.employeeId) return true;
  if (ctx.permissions.has("leave.request.read.all")) return true;
  if (r.approvals.some((a) => a.approverUserId === ctx.userId || a.actedById === ctx.userId)) return true;
  if ((await actingAs(ctx, r)).allowed) return true;
  // Line managers see their (direct + indirect) team's requests.
  if (!ctx.permissions.has("leave.approve.team") || !ctx.employeeId) return false;
  return (await getTeamEmployeeIds(ctx.companyId, ctx.employeeId)).includes(r.employeeId);
}

export async function getLeaveRequest(ctx: AuthContext, id: string) {
  const r = await db.leaveRequest.findFirst({ where: { id, companyId: ctx.companyId }, include: requestInclude });
  if (!r) throw new NotFoundError("Leave request not found.");
  if (!(await canView(ctx, r))) throw new ForbiddenError();
  const acting = await actingAs(ctx, r);
  const today = todayInTimeZone(ctx.timezone);
  const isOwner = r.employeeId === ctx.employeeId;
  return {
    request: r,
    canDecide: acting.allowed,
    actingOnBehalfOf: acting.onBehalfOfId,
    canWithdraw: isOwner && r.status === "PENDING",
    canRequestCancellation: isOwner && r.status === "APPROVED" && r.endDate >= today,
    canHrCancel: !isOwner && ctx.permissions.has("leave.approve.all") && ["PENDING", "APPROVED", "CANCELLATION_REQUESTED"].includes(r.status),
    canViewAttachment: !!r.attachmentPath,
  };
}

// ───────────────────────────── Decisions ─────────────────────────────

/** Approve/reject the current step of one request (also used for cancellation requests). */
export async function decideLeave(ctx: AuthContext, requestId: string, decision: "APPROVED" | "REJECTED", comment: string | null) {
  const notificationIds: string[] = [];
  const outcome = await db.$transaction(async (tx) => {
    const r = await tx.leaveRequest.findFirst({ where: { id: requestId, companyId: ctx.companyId }, include: requestInclude });
    if (!r) throw new NotFoundError("Leave request not found.");
    const approval = currentApproval(r) as LeaveRequestDetail["approvals"][number] | null;
    if (!approval) throw new ValidationError("This request is no longer waiting for a decision.");
    const acting = await actingAs(ctx, r);
    if (!acting.allowed) throw new ForbiddenError("You are not an approver for this request.");
    if (decision === "REJECTED" && !comment) throw new ValidationError("Please give a reason when rejecting.", { comment: ["Required when rejecting"] });

    const now = new Date();
    // Optimistic lock: only one approver can act on a step.
    const updated = await tx.leaveApproval.updateMany({
      where: { id: approval.id, decision: "PENDING" },
      data: { decision, actedById: ctx.userId, onBehalfOfId: acting.onBehalfOfId, comment, actedAt: now },
    });
    if (updated.count !== 1) throw new ValidationError("Someone else has already acted on this request.");

    const isCancellation = approval.kind === "CANCELLATION";
    const typeName = r.leaveType.name;
    const range = `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`;
    let status: LeaveRequestStatus = r.status;
    let nextStep: number | null = null;

    if (isCancellation) {
      status = decision === "APPROVED" ? "CANCELLED" : "APPROVED";
    } else if (decision === "REJECTED") {
      status = "REJECTED";
      await tx.leaveApproval.updateMany({ where: { requestId: r.id, kind: "REQUEST", decision: "PENDING" }, data: { decision: "SKIPPED" } });
    } else {
      const next = r.approvals.find((a) => a.kind === "REQUEST" && a.step > approval.step && a.decision === "PENDING");
      if (next) {
        nextStep = next.step;
        await tx.leaveApproval.update({ where: { id: next.id }, data: { activatedAt: now } });
      } else {
        status = "APPROVED";
      }
    }
    await tx.leaveRequest.update({
      where: { id: r.id },
      data: { status, ...(nextStep !== null && { currentStep: nextStep }), ...(status !== r.status && { decidedAt: now }) },
    });

    const verb = isCancellation ? (decision === "APPROVED" ? "approved the cancellation of" : "declined the cancellation of") : decision === "APPROVED" ? "approved" : "rejected";
    await writeAudit(ctx, {
      action: isCancellation ? `leave.cancellation.${decision === "APPROVED" ? "approve" : "reject"}` : `leave.${decision === "APPROVED" ? "approve" : "reject"}`,
      entityType: "LeaveRequest",
      entityId: r.id,
      summary: `${verb} ${displayName(r.employee)}'s ${typeName} ${range}${acting.onBehalfOfId ? " (as delegate)" : ""}${comment ? `: ${comment}` : ""}`,
      before: { status: r.status, step: approval.step },
      after: { status, step: nextStep ?? approval.step, decision, comment },
    }, tx);

    // Notify the requester at every step, and the next approvers if any.
    const requesterTitle =
      isCancellation
        ? decision === "APPROVED" ? `${typeName} cancelled` : `${typeName} cancellation declined`
        : status === "APPROVED" ? `${typeName} approved` : status === "REJECTED" ? `${typeName} rejected` : `${typeName} approved by your manager`;
    notificationIds.push(
      ...(await notify(tx, {
        companyId: ctx.companyId,
        userIds: [r.employee.userId],
        type: isCancellation ? "leave.cancellation_decided" : status === "PENDING" ? "leave.step_approved" : `leave.${status.toLowerCase()}`,
        title: requesterTitle,
        body: `${ctx.employeeName ?? ctx.name} ${verb} your ${typeName} (${range}).${status === "PENDING" ? " It now needs HR approval." : ""}${comment ? `\nComment: ${comment}` : ""}`,
        link: `/leave/requests/${r.id}`,
      })),
    );
    if (nextStep !== null) {
      const next = r.approvals.find((a) => a.kind === "REQUEST" && a.step === nextStep)!;
      const recipients = await stepRecipients(tx, ctx.companyId, next, r.employee.userId, todayInTimeZone(ctx.timezone));
      notificationIds.push(
        ...(await notify(tx, {
          companyId: ctx.companyId,
          userIds: recipients,
          type: "leave.submitted",
          title: `Leave request from ${displayName(r.employee)} needs ${next.approverRole === "HR" ? "HR" : "your"} approval`,
          body: `${displayName(r.employee)}'s ${typeName} (${range}, ${formatDays(num(r.days))}) was approved at the previous step.`,
          link: `/leave/requests/${r.id}`,
        })),
      );
    }
    return { id: r.id, status };
  });
  deliverEmailsInBackground(notificationIds);
  return outcome;
}

export async function decideMany(ctx: AuthContext, requestIds: string[], decision: "APPROVED" | "REJECTED", comment: string | null) {
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of requestIds) {
    try {
      await decideLeave(ctx, id, decision, comment);
      results.push({ id, ok: true });
    } catch (e) {
      results.push({ id, ok: false, error: e instanceof Error ? e.message : "Failed" });
    }
  }
  return results;
}

// ───────────────────────────── Cancellation ─────────────────────────────

/** Employee withdraws a pending request. */
export async function withdrawLeave(ctx: AuthContext, requestId: string) {
  const notificationIds: string[] = [];
  await db.$transaction(async (tx) => {
    const r = await tx.leaveRequest.findFirst({ where: { id: requestId, companyId: ctx.companyId }, include: requestInclude });
    if (!r) throw new NotFoundError("Leave request not found.");
    if (r.employeeId !== ctx.employeeId) throw new ForbiddenError();
    if (r.status !== "PENDING") throw new ValidationError("Only pending requests can be withdrawn. Ask to cancel approved leave instead.");
    const current = currentApproval(r) as LeaveRequestDetail["approvals"][number] | null;
    await tx.leaveRequest.update({ where: { id: r.id }, data: { status: "CANCELLED", cancellationReason: "Withdrawn by employee", decidedAt: new Date() } });
    await tx.leaveApproval.updateMany({ where: { requestId: r.id, decision: "PENDING" }, data: { decision: "SKIPPED" } });
    await writeAudit(ctx, { action: "leave.request.withdraw", entityType: "LeaveRequest", entityId: r.id, summary: `Withdrew ${r.leaveType.name} ${toDateInput(r.startDate)} → ${toDateInput(r.endDate)}`, before: { status: r.status }, after: { status: "CANCELLED" } }, tx);
    if (current) {
      const recipients = await stepRecipients(tx, ctx.companyId, current, r.employee.userId, todayInTimeZone(ctx.timezone));
      notificationIds.push(
        ...(await notify(tx, { companyId: ctx.companyId, userIds: recipients, type: "leave.withdrawn", title: `${displayName(r.employee)} withdrew a leave request`, body: `${r.leaveType.name} ${formatDate(r.startDate)} – ${formatDate(r.endDate)} no longer needs your approval.`, link: `/leave/requests/${r.id}`, email: false })),
      );
    }
  });
  deliverEmailsInBackground(notificationIds);
}

/** Employee asks to cancel approved leave; the manager (or HR) decides. Days stay booked until then. */
export async function requestCancellation(ctx: AuthContext, requestId: string, reason: string | null) {
  if (!reason) throw new ValidationError("Please give a reason.", { reason: ["Required"] });
  const notificationIds: string[] = [];
  await db.$transaction(async (tx) => {
    const r = await tx.leaveRequest.findFirst({ where: { id: requestId, companyId: ctx.companyId }, include: requestInclude });
    if (!r) throw new NotFoundError("Leave request not found.");
    if (r.employeeId !== ctx.employeeId) throw new ForbiddenError();
    if (r.status !== "APPROVED") throw new ValidationError("Only approved leave can be cancelled this way.");
    if (r.endDate < todayInTimeZone(ctx.timezone)) throw new ValidationError("This leave has already ended. Contact HR to correct past leave.");
    const managerUserId = r.employee.manager?.userId && r.employee.manager.user?.isActive ? r.employee.manager.userId : null;
    const step = (await tx.leaveApproval.count({ where: { requestId: r.id, kind: "CANCELLATION" } })) + 0;
    const approval = await tx.leaveApproval.create({
      data: { requestId: r.id, kind: "CANCELLATION", step, approverRole: managerUserId ? "MANAGER" : "HR", approverUserId: managerUserId, activatedAt: new Date() },
    });
    await tx.leaveRequest.update({ where: { id: r.id }, data: { status: "CANCELLATION_REQUESTED", cancellationReason: reason } });
    await writeAudit(ctx, { action: "leave.cancellation.request", entityType: "LeaveRequest", entityId: r.id, summary: `Asked to cancel ${r.leaveType.name} ${toDateInput(r.startDate)} → ${toDateInput(r.endDate)}: ${reason}`, before: { status: r.status }, after: { status: "CANCELLATION_REQUESTED", reason } }, tx);
    const recipients = await stepRecipients(tx, ctx.companyId, approval, r.employee.userId, todayInTimeZone(ctx.timezone));
    notificationIds.push(
      ...(await notify(tx, { companyId: ctx.companyId, userIds: recipients, type: "leave.cancellation_requested", title: `${displayName(r.employee)} wants to cancel approved leave`, body: `${r.leaveType.name} ${formatDate(r.startDate)} – ${formatDate(r.endDate)}. Reason: ${reason}`, link: `/leave/requests/${r.id}` })),
    );
  });
  deliverEmailsInBackground(notificationIds);
}

/** HR cancels any booked leave directly (e.g. employee returned early). Audited, reason required. */
export async function hrCancelLeave(ctx: AuthContext, requestId: string, reason: string | null) {
  if (!ctx.permissions.has("leave.approve.all")) throw new ForbiddenError();
  if (!reason) throw new ValidationError("Please give a reason.", { reason: ["Required"] });
  const notificationIds: string[] = [];
  await db.$transaction(async (tx) => {
    const r = await tx.leaveRequest.findFirst({ where: { id: requestId, companyId: ctx.companyId }, include: requestInclude });
    if (!r) throw new NotFoundError("Leave request not found.");
    if (r.employeeId === ctx.employeeId) throw new ForbiddenError("Use the normal cancellation flow for your own leave.");
    if (!["PENDING", "APPROVED", "CANCELLATION_REQUESTED"].includes(r.status)) throw new ValidationError("This request is already closed.");
    await tx.leaveRequest.update({ where: { id: r.id }, data: { status: "CANCELLED", cancellationReason: reason, decidedAt: new Date() } });
    await tx.leaveApproval.updateMany({ where: { requestId: r.id, decision: "PENDING" }, data: { decision: "SKIPPED" } });
    await writeAudit(ctx, { action: "leave.cancel.hr", entityType: "LeaveRequest", entityId: r.id, summary: `HR cancelled ${displayName(r.employee)}'s ${r.leaveType.name} ${toDateInput(r.startDate)} → ${toDateInput(r.endDate)}: ${reason}`, before: { status: r.status }, after: { status: "CANCELLED", reason } }, tx);
    notificationIds.push(
      ...(await notify(tx, { companyId: ctx.companyId, userIds: [r.employee.userId], type: "leave.cancelled", title: `${r.leaveType.name} cancelled by HR`, body: `Your ${r.leaveType.name} (${formatDate(r.startDate)} – ${formatDate(r.endDate)}) was cancelled. Reason: ${reason}`, link: `/leave/requests/${r.id}` })),
    );
  });
  deliverEmailsInBackground(notificationIds);
}

// ───────────────────────────── Lists ─────────────────────────────

export const REQUEST_SORTS = ["startDate", "createdAt", "employee", "days"] as const;

export type RequestFilters = { status?: LeaveRequestStatus; leaveTypeId?: string; year?: number; departmentId?: string; from?: Date; to?: Date };

function requestOrder(sort: (typeof REQUEST_SORTS)[number], dir: "asc" | "desc"): Prisma.LeaveRequestOrderByWithRelationInput[] {
  if (sort === "employee") return [{ employee: { firstName: dir } }, { startDate: "desc" }];
  if (sort === "createdAt") return [{ createdAt: dir }];
  if (sort === "days") return [{ days: dir }, { startDate: "desc" }];
  return [{ startDate: dir }, { createdAt: "desc" }];
}

/** `mine` (self), `team` (direct + indirect reports) or `all` (HR). */
export async function listLeaveRequests(ctx: AuthContext, scope: "mine" | "team" | "all", params: ListParams<(typeof REQUEST_SORTS)[number]>, filters: RequestFilters) {
  let employeeFilter: Prisma.LeaveRequestWhereInput;
  if (scope === "mine") {
    if (!ctx.employeeId) return paginated([], 0, params.page, params.pageSize);
    employeeFilter = { employeeId: ctx.employeeId };
  } else if (scope === "all") {
    if (!ctx.permissions.has("leave.request.read.all")) throw new ForbiddenError();
    employeeFilter = {};
  } else {
    if (!ctx.permissions.has("leave.approve.team") || !ctx.employeeId) throw new ForbiddenError();
    employeeFilter = { employeeId: { in: await getTeamEmployeeIds(ctx.companyId, ctx.employeeId) } };
  }
  const terms = params.q.split(/\s+/).filter(Boolean);
  const where: Prisma.LeaveRequestWhereInput = {
    companyId: ctx.companyId,
    ...employeeFilter,
    ...(filters.status && { status: filters.status }),
    ...(filters.leaveTypeId && { leaveTypeId: filters.leaveTypeId }),
    ...(filters.departmentId && { employee: { departmentId: filters.departmentId } }),
    ...(filters.year && { startDate: { lte: new Date(Date.UTC(filters.year, 11, 31)) }, endDate: { gte: new Date(Date.UTC(filters.year, 0, 1)) } }),
    ...(filters.from && { endDate: { gte: filters.from } }),
    ...(filters.to && { startDate: { lte: filters.to } }),
    AND: terms.map((t) => ({
      employee: {
        OR: [
          { firstName: { contains: t, mode: "insensitive" as const } },
          { lastName: { contains: t, mode: "insensitive" as const } },
          { employeeNumber: { contains: t, mode: "insensitive" as const } },
        ],
      },
    })),
  };
  const [items, total] = await Promise.all([
    db.leaveRequest.findMany({
      where,
      orderBy: requestOrder(params.sort, params.dir),
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        leaveType: { select: { name: true, code: true, color: true } },
        employee: { select: { id: true, firstName: true, lastName: true, preferredName: true, photoPath: true, department: { select: { name: true } } } },
      },
    }),
    db.leaveRequest.count({ where }),
  ]);
  return paginated(items.map((r) => ({ ...r, days: num(r.days) })), total, params.page, params.pageSize);
}

/** Requests waiting for the current user (as manager, delegate or HR). `all` = every pending step (HR). */
export async function approvalInbox(ctx: AuthContext, view: "mine" | "all" = "mine") {
  const canAll = ctx.permissions.has("leave.approve.all");
  if (view === "all" && !canAll) throw new ForbiddenError();
  const delegators = await delegatorsFor(db, ctx.userId, todayInTimeZone(ctx.timezone));
  const approvalWhere: Prisma.LeaveApprovalWhereInput =
    view === "all"
      ? {}
      : {
          OR: [
            { approverUserId: { in: [ctx.userId, ...delegators] } },
            ...(canAll ? [{ approverRole: "HR" }, { approverUserId: null }] : []),
          ],
        };
  const rows = await db.leaveApproval.findMany({
    where: {
      decision: "PENDING",
      activatedAt: { not: null },
      ...approvalWhere,
      request: {
        companyId: ctx.companyId,
        status: { in: ["PENDING", "CANCELLATION_REQUESTED"] },
        ...(ctx.employeeId && { employeeId: { not: ctx.employeeId } }),
      },
    },
    include: {
      approver: { select: { name: true } },
      request: {
        include: {
          leaveType: { select: { name: true, code: true, color: true } },
          employee: { select: { id: true, firstName: true, lastName: true, preferredName: true, photoPath: true, department: { select: { name: true } }, position: { select: { title: true } } } },
        },
      },
    },
    orderBy: { activatedAt: "asc" },
    take: 200,
  });
  // A request can only be at one step; keep rows matching the request's state.
  return rows
    .filter((a) => (a.request.status === "CANCELLATION_REQUESTED" ? a.kind === "CANCELLATION" : a.kind === "REQUEST"))
    .map((a) => ({
      approvalId: a.id,
      kind: a.kind,
      approverRole: a.approverRole,
      approverName: a.approver?.name ?? null,
      onBehalfOf: a.approverUserId && a.approverUserId !== ctx.userId && delegators.includes(a.approverUserId) ? a.approver?.name ?? null : null,
      waitingSince: a.activatedAt!,
      request: { ...a.request, days: num(a.request.days) },
    }));
}

export async function pendingApprovalCount(ctx: AuthContext) {
  if (!ctx.permissions.has("leave.approve.team") && !ctx.permissions.has("leave.approve.all")) {
    // delegates without the permission still get a count
    const delegators = await delegatorsFor(db, ctx.userId, todayInTimeZone(ctx.timezone));
    if (!delegators.length) return 0;
  }
  return (await approvalInbox(ctx, "mine")).length;
}

/** For the employee page "Leave" tab. */
export async function recentRequestsFor(ctx: AuthContext, employeeId: string, take = 10) {
  const access = await getEmployeeAccess(ctx, employeeId);
  if (access === "none") throw new ForbiddenError();
  if (access === "team" && !ctx.permissions.has("leave.approve.team")) throw new ForbiddenError();
  const rows = await db.leaveRequest.findMany({
    where: { employeeId, companyId: ctx.companyId },
    include: { leaveType: { select: { name: true, color: true } } },
    orderBy: { startDate: "desc" },
    take,
  });
  return rows.map((r) => ({ ...r, days: num(r.days) }));
}

export async function whoIsOff(ctx: AuthContext, date: Date) {
  const scope = await getVisibleEmployeeScope(ctx);
  if (scope !== "all" && !scope.length) return [];
  const rows = await db.leaveRequest.findMany({
    where: {
      companyId: ctx.companyId,
      status: { in: ["APPROVED", "CANCELLATION_REQUESTED"] },
      startDate: { lte: date },
      endDate: { gte: date },
      ...(scope !== "all" && { employeeId: { in: scope } }),
      dayRows: { some: { date } },
    },
    include: { leaveType: { select: { name: true, color: true } }, employee: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
    orderBy: { endDate: "asc" },
  });
  return rows;
}
