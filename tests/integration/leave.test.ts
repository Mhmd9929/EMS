import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, ValidationError } from "@/server/errors";
import type { AuthContext } from "@/server/auth/permissions";
import { decideLeave, getLeaveRequest, previewLeave, requestCancellation, submitLeave, withdrawLeave, approvalInbox } from "@/server/services/leave/request.service";
import { adjustBalance, closeLeaveYear, expireCarryForward, getEmployeeBalances, syncAccruals } from "@/server/services/leave/balance.service";
import { createDelegation } from "@/server/services/leave/delegation.service";
import { unpaidLeaveDays } from "@/server/services/leave/report.service";
import { runLeaveEscalations } from "@/server/services/leave/jobs";
import { contextFor, employeeIdByEmail, DOMAIN } from "./helpers";
import { todayInTimeZone } from "@/lib/dates";

let hr: AuthContext, manager: AuthContext, employee: AuthContext, payroll: AuthContext;
let annualId: string, unpaidId: string, maternityId: string, studyId: string;
const created: string[] = [];

/** Monday on/after today + offset (UTC date). */
function monday(offset: number) {
  const d = todayInTimeZone("Asia/Dubai");
  d.setUTCDate(d.getUTCDate() + offset);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
const plus = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

beforeAll(async () => {
  [hr, manager, employee, payroll] = await Promise.all(["hr", "manager", "employee", "payroll"].map((u) => contextFor(`${u}@${DOMAIN}`)));
  const types = await db.leaveType.findMany({ where: { companyId: hr.companyId } });
  annualId = types.find((t) => t.code === "AL")!.id;
  unpaidId = types.find((t) => t.code === "UL")!.id;
  maternityId = types.find((t) => t.code === "ML")!.id;
  studyId = types.find((t) => t.code === "ST")!.id;
});

afterAll(async () => {
  await db.leaveRequest.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

async function submit(ctx: AuthContext, leaveTypeId: string, start: Date, end: Date, halfDay: "NONE" | "FIRST_HALF" | "SECOND_HALF" = "NONE", attachmentPath: string | null = null) {
  const r = await submitLeave(ctx, { leaveTypeId, startDate: start, endDate: end, halfDay, reason: "integration test", attachmentPath });
  created.push(r.id);
  return r;
}

describe("leave rules on submit", () => {
  it("previews working days and balance without side effects", async () => {
    const mon = monday(91);
    const p = await previewLeave(employee, { leaveTypeId: annualId, startDate: mon, endDate: plus(mon, 6), halfDay: "NONE" });
    expect(p.count?.total).toBe(5);
    expect(p.balances[0].requested).toBe(5);
    expect(p.approvalSteps).toEqual(["MANAGER"]);
  });

  it("rejects gender-ineligible types, half days over ranges, insufficient balance and short notice", async () => {
    const mon = monday(91);
    const maternity = await previewLeave(manager, { leaveTypeId: maternityId, startDate: mon, endDate: plus(mon, 4), halfDay: "NONE" });
    expect(maternity.ok).toBe(false); // manager is male
    await expect(submit(employee, annualId, mon, plus(mon, 1), "FIRST_HALF")).rejects.toBeInstanceOf(ValidationError);
    await expect(submit(employee, annualId, mon, plus(mon, 60))).rejects.toThrow(/Not enough Annual Leave balance/);
    const tomorrow = plus(todayInTimeZone("Asia/Dubai"), 1);
    await expect(submit(employee, annualId, tomorrow, tomorrow)).rejects.toThrow(/notice/);
  });

  it("blocks overlapping requests", async () => {
    const mon = monday(98);
    await submit(employee, annualId, mon, plus(mon, 1));
    await expect(submit(employee, unpaidId, plus(mon, 1), plus(mon, 2))).rejects.toThrow(/Overlaps/);
  });
});

describe("approval workflow and authorisation", () => {
  it("only the line manager (or HR / a delegate) can decide, never the requester", async () => {
    const mon = monday(105);
    const r = await submit(employee, annualId, mon, mon);
    await expect(decideLeave(employee, r.id, "APPROVED", null)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(decideLeave(payroll, r.id, "APPROVED", null)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await approvalInbox(manager)).some((i) => i.request.id === r.id)).toBe(true);
    await expect(decideLeave(manager, r.id, "REJECTED", null)).rejects.toThrow(/reason/);
    const out = await decideLeave(manager, r.id, "APPROVED", "ok");
    expect(out.status).toBe("APPROVED");
    await expect(decideLeave(hr, r.id, "APPROVED", null)).rejects.toThrow(/no longer waiting/);
  });

  it("HR cannot approve their own leave even with leave.approve.all", async () => {
    const mon = monday(112);
    const r = await submit(hr, annualId, mon, mon);
    await expect(decideLeave(hr, r.id, "APPROVED", null)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("runs multi-step chains (manager → HR) in order", async () => {
    // Study leave needs 2 years' service: Sara joined 2022, eligible.
    const mon = monday(119);
    await expect(submit(employee, studyId, mon, mon)).rejects.toThrow(/supporting document/);
    const r = await submit(employee, studyId, mon, mon, "NONE", "test/leave/exam-timetable.pdf");
    const afterManager = await decideLeave(manager, r.id, "APPROVED", null);
    expect(afterManager.status).toBe("PENDING");
    await expect(decideLeave(manager, r.id, "APPROVED", null)).rejects.toBeInstanceOf(ForbiddenError); // HR step now
    expect((await decideLeave(hr, r.id, "APPROVED", null)).status).toBe("APPROVED");
  });

  it("delegates can act for the manager during the delegation", async () => {
    const mon = monday(126);
    const r = await submit(employee, annualId, mon, mon);
    await expect(decideLeave(payroll, r.id, "APPROVED", null)).rejects.toBeInstanceOf(ForbiddenError);
    const d = await createDelegation(manager, { delegateId: payroll.userId, startDate: todayInTimeZone("Asia/Dubai"), endDate: plus(todayInTimeZone("Asia/Dubai"), 3), reason: "test" });
    expect((await decideLeave(payroll, r.id, "APPROVED", null)).status).toBe("APPROVED");
    const approval = await db.leaveApproval.findFirstOrThrow({ where: { requestId: r.id, decision: "APPROVED" } });
    expect(approval.onBehalfOfId).toBe(manager.userId);
    await db.approvalDelegation.delete({ where: { id: d.id } });
  });

  it("employees cannot view other people's requests; managers can view their team's", async () => {
    const mon = monday(133);
    const r = await submit(employee, annualId, mon, mon);
    await expect(getLeaveRequest(payroll, r.id)).rejects.toBeInstanceOf(ForbiddenError); // company-wide HR data access ≠ leave access
    expect((await getLeaveRequest(manager, r.id)).canDecide).toBe(true);
    await withdrawLeave(employee, r.id);
    await expect(withdrawLeave(employee, r.id)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("balances", () => {
  it("moves days from pending to taken and back on cancellation", async () => {
    const year = monday(140).getUTCFullYear();
    const bal = async () => (await getEmployeeBalances(employee, employee.employeeId!, year)).find((b) => b.leaveType.id === annualId)!;
    const start = await bal();
    const mon = monday(140);
    const n = (await previewLeave(employee, { leaveTypeId: annualId, startDate: mon, endDate: plus(mon, 1), halfDay: "NONE" })).count!.total;
    expect(n).toBeGreaterThan(0);
    const r = await submit(employee, annualId, mon, plus(mon, 1));
    expect((await bal()).pending).toBe(start.pending + n);
    await decideLeave(manager, r.id, "APPROVED", null);
    expect((await bal()).taken).toBe(start.taken + n);
    await requestCancellation(employee, r.id, "Plans changed");
    expect((await bal()).taken).toBe(start.taken + n); // still booked until decided
    await decideLeave(manager, r.id, "APPROVED", null);
    const end = await bal();
    expect(end.taken).toBe(start.taken);
    expect(end.available).toBe(start.available);
  });

  it("manual adjustments are HR-only, never on yourself, and audited", async () => {
    const year = todayInTimeZone("Asia/Dubai").getUTCFullYear();
    const saraId = await employeeIdByEmail(`employee@${DOMAIN}`);
    await expect(adjustBalance(manager, { employeeId: saraId, leaveTypeId: annualId, year, days: 1, reason: "x" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(adjustBalance(hr, { employeeId: hr.employeeId!, leaveTypeId: annualId, year, days: 1, reason: "x" })).rejects.toBeInstanceOf(ForbiddenError);
    const entry = await adjustBalance(hr, { employeeId: saraId, leaveTypeId: annualId, year, days: 1.5, reason: "Integration test" });
    expect(Number(entry.days)).toBe(1.5);
    expect(await db.auditLog.count({ where: { action: "leave.balance.adjust", entityId: saraId } })).toBeGreaterThan(0);
    await db.leaveLedgerEntry.delete({ where: { id: entry.id } });
  });

  it("accrual, year-end close and carry-forward expiry are idempotent", async () => {
    const year = todayInTimeZone("Asia/Dubai").getUTCFullYear();
    const today = todayInTimeZone("Asia/Dubai");
    expect(await syncAccruals(hr.companyId, year, today)).toBe(0);
    expect(await closeLeaveYear(hr.companyId, year - 1)).toBe(0);
    expect(await expireCarryForward(hr.companyId, today)).toBe(0);
  });

  it("reports approved unpaid leave days for payroll", async () => {
    const mon = monday(147);
    const r = await submit(employee, unpaidId, mon, plus(mon, 2));
    await decideLeave(manager, r.id, "APPROVED", null);
    expect(r.status).toBe("PENDING"); // unpaid needs Manager → HR
    await decideLeave(hr, r.id, "APPROVED", null);
    const days = await unpaidLeaveDays(hr.companyId, mon, plus(mon, 6), [employee.employeeId!]);
    expect(days.get(employee.employeeId!)).toBe(3);
  });

  it("reminds approvers about stale requests and escalates manager steps to HR", async () => {
    const mon = monday(154);
    const r = await submit(employee, annualId, mon, mon);
    const approval = await db.leaveApproval.findFirstOrThrow({ where: { requestId: r.id, decision: "PENDING" } });
    const old = new Date(Date.now() - 10 * 86_400_000);
    await db.leaveApproval.update({ where: { id: approval.id }, data: { activatedAt: old } });
    await runLeaveEscalations();
    expect(await db.notification.count({ where: { type: "leave.reminder", userId: manager.userId, body: { contains: "still waiting" }, createdAt: { gte: new Date(Date.now() - 60_000) } } })).toBeGreaterThan(0);
    // Second reminder escalates to HR
    await db.leaveApproval.update({ where: { id: approval.id }, data: { lastReminderAt: old } });
    await runLeaveEscalations();
    expect(await db.notification.count({ where: { type: "leave.escalated", userId: hr.userId, createdAt: { gte: new Date(Date.now() - 60_000) } } })).toBeGreaterThan(0);
  });
});
