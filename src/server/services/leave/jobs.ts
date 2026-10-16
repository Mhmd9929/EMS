import "server-only";
import { db } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { todayInTimeZone } from "@/lib/dates";
import { closeLeaveYear, expireCarryForward, syncAccruals } from "./balance.service";
import { stepRecipients, usersWithPermission } from "./approvers";
import { deliverEmailsInBackground, notify } from "../notification.service";
import { displayName } from "./common";

const companies = () => db.company.findMany({ select: { id: true, timezone: true, leaveEscalationDays: true } });

/** Credit accruals/entitlements up to today (idempotent; also catches up missed runs). */
export async function runLeaveAccruals(now = new Date()) {
  let created = 0;
  for (const c of await companies()) {
    const today = todayInTimeZone(c.timezone, now);
    created += await syncAccruals(c.id, today.getUTCFullYear(), today);
  }
  return { created };
}

/** In January, close the previous leave year (carry forward / lapse). Idempotent. */
export async function runLeaveYearEnd(now = new Date()) {
  let closed = 0;
  for (const c of await companies()) {
    const today = todayInTimeZone(c.timezone, now);
    if (today.getUTCMonth() !== 0) continue;
    closed += await closeLeaveYear(c.id, today.getUTCFullYear() - 1);
  }
  return { closed };
}

/** Daily: expire unused carried-forward days and keep ACTIVE/ON_LEAVE in sync with approved leave. */
export async function runLeaveDaily(now = new Date()) {
  let expired = 0;
  let statusChanges = 0;
  for (const c of await companies()) {
    const today = todayInTimeZone(c.timezone, now);
    expired += await expireCarryForward(c.id, today);
    const onLeaveIds = (
      await db.leaveRequest.findMany({
        where: { companyId: c.id, status: { in: ["APPROVED", "CANCELLATION_REQUESTED"] }, dayRows: { some: { date: today } } },
        select: { employeeId: true },
      })
    ).map((r) => r.employeeId);
    const toLeave = await db.employee.updateMany({ where: { companyId: c.id, id: { in: onLeaveIds }, status: "ACTIVE" }, data: { status: "ON_LEAVE" } });
    const back = await db.employee.updateMany({ where: { companyId: c.id, id: { notIn: onLeaveIds }, status: "ON_LEAVE" }, data: { status: "ACTIVE" } });
    statusChanges += toLeave.count + back.count;
  }
  return { expired, statusChanges };
}

/**
 * Remind approvers about steps waiting longer than the company's escalation threshold. From the second
 * reminder on, manager steps are escalated to HR as well.
 */
export async function runLeaveEscalations(now = new Date()) {
  let reminded = 0;
  for (const c of await companies()) {
    const threshold = new Date(now.getTime() - c.leaveEscalationDays * 86_400_000);
    const waiting = await db.leaveApproval.findMany({
      where: {
        decision: "PENDING",
        activatedAt: { not: null, lte: threshold },
        OR: [{ lastReminderAt: null }, { lastReminderAt: { lte: threshold } }],
        request: { companyId: c.id, status: { in: ["PENDING", "CANCELLATION_REQUESTED"] } },
      },
      include: { request: { include: { leaveType: { select: { name: true } }, employee: { select: { userId: true, firstName: true, lastName: true, preferredName: true } } } } },
    });
    const today = todayInTimeZone(c.timezone, now);
    for (const a of waiting) {
      if ((a.request.status === "CANCELLATION_REQUESTED") !== (a.kind === "CANCELLATION")) continue;
      const ids = await db.$transaction(async (tx) => {
        const recipients = await stepRecipients(tx, c.id, a, a.request.employee.userId, today);
        const escalate = a.lastReminderAt !== null && a.approverRole === "MANAGER";
        const hr = escalate ? await usersWithPermission(tx, c.id, "leave.approve.all") : [];
        const days = Math.floor((now.getTime() - a.activatedAt!.getTime()) / 86_400_000);
        const what = { name: displayName(a.request.employee), type: a.request.leaveType.name, start: a.request.startDate, end: a.request.endDate, days };
        const out = [
          ...(await notify(tx, { companyId: c.id, userIds: recipients, type: "leave.reminder", message: { key: "leaveReminder", params: what }, link: `/leave/requests/${a.requestId}` })),
          ...(escalate
            ? await notify(tx, { companyId: c.id, userIds: hr.filter((u) => !recipients.includes(u) && u !== a.request.employee.userId), type: "leave.escalated", message: { key: "leaveEscalated", params: what }, link: `/leave/requests/${a.requestId}` })
            : []),
        ];
        await tx.leaveApproval.update({ where: { id: a.id }, data: { lastReminderAt: now } });
        if (escalate) await writeAudit({ companyId: c.id, userId: null }, { action: "leave.escalate", entityType: "LeaveRequest", entityId: a.requestId, summary: `Escalated to HR after ${days} days` }, tx);
        return out;
      });
      deliverEmailsInBackground(ids);
      reminded++;
    }
  }
  return { reminded };
}
