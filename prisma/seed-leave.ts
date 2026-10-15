/**
 * Phase 2 demo data: leave types, a couple of policies, last year's history and carry-forward, this year's
 * accruals and a realistic mix of requests (taken, upcoming, pending in each inbox, rejected, cancelled).
 * Uses the real services for accrual and year-end so the ledger matches production behaviour.
 */
import type { HalfDayPeriod, LeaveRequestStatus, PrismaClient } from "@prisma/client";
import { ensureDefaultLeaveTypes } from "./leave-defaults";
import { closeLeaveYear, expireCarryForward, syncAccruals } from "../src/server/services/leave/balance.service";
import { runLeaveDaily } from "../src/server/services/leave/jobs";
import { countLeaveDays } from "../src/lib/leave/days";
import { addDays, isoWeekday, toDateInput } from "../src/lib/dates";

type Approval = { role: "MANAGER" | "HR"; decision: "APPROVED" | "REJECTED" | "PENDING"; comment?: string };

export async function seedLeave(db: PrismaClient, companyId: string, today: Date, employeeIds: Record<string, string>) {
  await ensureDefaultLeaveTypes(db, companyId);
  const types = Object.fromEntries((await db.leaveType.findMany({ where: { companyId } })).map((t) => [t.code, t]));
  const year = today.getUTCFullYear();

  await db.leavePolicy.createMany({
    data: [
      { companyId, name: "Contract staff — Annual 22 days", leaveTypeId: types.AL.id, employmentType: "CONTRACT", annualEntitlement: 22 },
      { companyId, name: "Part-time staff — Annual 15 days", leaveTypeId: types.AL.id, employmentType: "PART_TIME", annualEntitlement: 15 },
    ],
  });

  const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { workWeek: true } });
  const holidays = new Set((await db.publicHoliday.findMany({ where: { companyId } })).map((h) => toDateInput(h.date)));
  const employees = await db.employee.findMany({ where: { companyId }, include: { manager: { select: { userId: true } } } });
  const byKey = (k: string) => employees.find((e) => e.id === employeeIds[k])!;
  const hrUser = await db.user.findUniqueOrThrow({ where: { email: "hr@falcongulf.ae" } });

  /** Next working day on/after a date. */
  const workday = (d: Date) => {
    let x = d;
    while (!company.workWeek.includes(isoWeekday(x)) || holidays.has(toDateInput(x))) x = addDays(x, 1);
    return x;
  };

  async function request(
    key: string,
    code: string,
    start: Date,
    end: Date,
    status: LeaveRequestStatus,
    approvals: Approval[],
    opts: { reason?: string; halfDay?: HalfDayPeriod; cancellationReason?: string } = {},
  ) {
    const e = byKey(key);
    const type = types[code];
    const count = countLeaveDays({ start, end, halfDay: opts.halfDay ?? "NONE", workWeek: company.workWeek, holidays, countWeekends: type.countWeekends, countHolidays: type.countHolidays });
    if (!count.total) return;
    const created = addDays(start, -14) < today ? addDays(start, -14) : addDays(today, -2);
    const firstPending = approvals.findIndex((a) => a.decision === "PENDING");
    await db.leaveRequest.create({
      data: {
        companyId, employeeId: e.id, leaveTypeId: type.id, startDate: start, endDate: end, halfDay: opts.halfDay ?? "NONE",
        days: count.total, reason: opts.reason ?? null, status, currentStep: firstPending === -1 ? Math.max(0, approvals.length - 1) : firstPending,
        cancellationReason: opts.cancellationReason ?? null, createdAt: created, createdById: e.userId,
        decidedAt: status === "PENDING" ? null : addDays(created, 1),
        dayRows: { create: count.days.map((d) => ({ date: d.date, amount: d.amount })) },
        approvals: {
          create: approvals.map((a, i) => ({
            kind: "REQUEST" as const, step: i, approverRole: a.role,
            approverUserId: a.role === "MANAGER" ? e.manager?.userId ?? null : null,
            decision: a.decision, comment: a.comment ?? null,
            actedById: a.decision === "PENDING" ? null : a.role === "MANAGER" ? e.manager?.userId ?? hrUser.id : hrUser.id,
            actedAt: a.decision === "PENDING" ? null : addDays(created, 1),
            activatedAt: a.decision === "PENDING" && i !== firstPending ? null : addDays(created, i),
          })),
        },
      },
    });
  }
  const approved: Approval[] = [{ role: "MANAGER", decision: "APPROVED" }];
  const Y = (m: number, d: number, y = year) => new Date(Date.UTC(y, m - 1, d));

  // ── Last year: accrue, take some leave, close the year (carry forward into this year) ──
  await syncAccruals(companyId, year - 1, Y(1, 1));
  const lastYearTakers = ["acc1", "acc2", "hr1", "swe1", "swe3", "it1", "sal1", "sal2", "mkt1", "log1", "log2", "mgrFin", "mgrSal", "dirTech", "ta1"];
  for (const [i, key] of lastYearTakers.entries()) {
    const start = workday(Y(3 + (i % 8), 3 + ((i * 5) % 20), year - 1));
    await request(key, "AL", start, addDays(start, 6 + (i % 10)), "APPROVED", approved, { reason: "Annual vacation" });
  }
  await closeLeaveYear(companyId, year - 1);

  // ── This year ──
  await syncAccruals(companyId, year, today);

  // Taken earlier this year
  const takers = ["acc1", "acc3", "pay1", "hr1", "ta1", "swe1", "swe3", "it1", "it2", "sal1", "sal3", "mkt1", "log1", "log2", "mgrEng", "mgrHr", "dirFin", "ea"];
  for (const [i, key] of takers.entries()) {
    const start = workday(Y(2 + (i % 7), 2 + ((i * 7) % 22)));
    if (start >= today) continue;
    await request(key, "AL", start, addDays(start, 3 + (i % 8)), "APPROVED", approved, { reason: "Family vacation" });
  }
  for (const [i, key] of ["acc2", "swe2", "sal2", "mkt2", "log1"].entries()) {
    const start = workday(Y(3 + i, 10 + i));
    if (start < today) await request(key, "SL", start, i === 1 ? start : addDays(start, 1), "APPROVED", approved, { reason: "Flu", halfDay: i === 1 ? "FIRST_HALF" : "NONE" });
  }

  // On leave today (status becomes ON_LEAVE) and upcoming approved leave for the calendar
  const todayWork = workday(today);
  await request("sal1", "AL", todayWork, addDays(todayWork, 4), "APPROVED", approved, { reason: "Trip home" });
  await request("acc3", "AL", workday(addDays(today, 10)), addDays(workday(addDays(today, 10)), 4), "APPROVED", approved);
  await request("mkt1", "AL", workday(addDays(today, 18)), addDays(workday(addDays(today, 18)), 9), "APPROVED", approved);
  await request("dirOps", "AL", workday(addDays(today, 25)), addDays(workday(addDays(today, 25)), 6), "APPROVED", approved);

  // Pending in the Engineering manager's inbox
  await request("swe2", "AL", workday(addDays(today, 21)), addDays(workday(addDays(today, 21)), 4), "PENDING", [{ role: "MANAGER", decision: "PENDING" }], { reason: "Visiting family in Al Ain" });
  await request("swe3", "AL", workday(addDays(today, 14)), addDays(workday(addDays(today, 14)), 2), "PENDING", [{ role: "MANAGER", decision: "PENDING" }], { reason: "Wedding" });
  await request("swe1", "AL", workday(addDays(today, 30)), addDays(workday(addDays(today, 30)), 9), "PENDING", [{ role: "MANAGER", decision: "PENDING" }], { reason: "Holiday abroad" });
  // Waiting for HR (manager already approved) and a cancellation request
  await request("swe1", "ST", workday(addDays(today, 40)), addDays(workday(addDays(today, 40)), 1), "PENDING", [{ role: "MANAGER", decision: "APPROVED" }, { role: "HR", decision: "PENDING" }], { reason: "Final exams — MSc" });
  await request("hr2", "UL", workday(addDays(today, 45)), addDays(workday(addDays(today, 45)), 2), "PENDING", [{ role: "MANAGER", decision: "PENDING" }, { role: "HR", decision: "PENDING" }], { reason: "Personal matters" });
  // History for the demo employee
  await request("swe2", "AL", workday(Y(4, 13)), addDays(workday(Y(4, 13)), 1), "REJECTED", [{ role: "MANAGER", decision: "REJECTED", comment: "Sprint release that week — please pick other dates." }]);
  await request("swe2", "AL", workday(Y(5, 18)), addDays(workday(Y(5, 18)), 4), "APPROVED", approved, { reason: "Eid break" });
  await request("swe2", "SL", workday(Y(8, 4)), workday(Y(8, 4)), "CANCELLED", [{ role: "MANAGER", decision: "PENDING" }], { cancellationReason: "Withdrawn by employee" });

  const cancelReq = await db.leaveRequest.findFirst({ where: { employeeId: employeeIds.mkt1, startDate: { gt: today } }, orderBy: { startDate: "asc" } });
  if (cancelReq) {
    const mgr = byKey("mkt1").manager?.userId ?? null;
    await db.leaveRequest.update({ where: { id: cancelReq.id }, data: { status: "CANCELLATION_REQUESTED", cancellationReason: "Trip postponed" } });
    await db.leaveApproval.create({ data: { requestId: cancelReq.id, kind: "CANCELLATION", step: 0, approverRole: mgr ? "MANAGER" : "HR", approverUserId: mgr, activatedAt: addDays(today, -1) } });
  }
  // Clear stale PENDING approvals on closed requests
  await db.leaveApproval.updateMany({ where: { decision: "PENDING", request: { status: { in: ["CANCELLED", "REJECTED", "APPROVED"] } }, kind: "REQUEST" }, data: { decision: "SKIPPED" } });

  // Carried-forward days expire after the requests above exist, as they would in production.
  await expireCarryForward(companyId, today);
  await runLeaveDaily();

  // A few notifications so the bell isn't empty
  const users = await db.user.findMany({ where: { email: { in: ["manager@falcongulf.ae", "employee@falcongulf.ae", "hr@falcongulf.ae"] } } });
  const uid = (email: string) => users.find((u) => u.email === email)!.id;
  await db.notification.createMany({
    data: [
      { companyId, userId: uid("manager@falcongulf.ae"), type: "leave.submitted", title: "Leave request from Sara Al Hammadi", body: "Sara requested Annual Leave. Please review it.", link: "/leave/approvals" },
      { companyId, userId: uid("employee@falcongulf.ae"), type: "leave.approved", title: "Annual Leave approved", body: "Your Eid break was approved by Yousef Qasim.", link: "/leave", readAt: new Date() },
      { companyId, userId: uid("employee@falcongulf.ae"), type: "leave.submitted_self", title: "Annual Leave request submitted", body: "Your request was sent to your manager for approval.", link: "/leave" },
      { companyId, userId: uid("hr@falcongulf.ae"), type: "leave.submitted", title: "Study Leave needs HR approval", body: "Elena Petrova's Study Leave was approved by her manager.", link: "/leave/approvals" },
    ],
  });
}
