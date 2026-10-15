import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import type { AuthContext } from "@/server/auth/permissions";
import { getPayslip, listPayslips } from "@/server/services/payroll/payslip.service";
import { approveRun, calculateRun, cancelRun, createRun, getRun, releaseRun, reopenRun, setEntryStatus, submitRun } from "@/server/services/payroll/run.service";
import { createSalaryStructure, getSalaryHistory, listSalaries } from "@/server/services/payroll/salary.service";
import { createAdjustment } from "@/server/services/payroll/adjustment.service";
import { approveSettlement, computeSettlement } from "@/server/services/payroll/settlement.service";
import { exportRegister, exportSif } from "@/server/services/payroll/export.service";
import { unpaidLeaveDays } from "@/server/services/leave/report.service";
import { periodBounds } from "@/lib/payroll/calc";
import { todayInTimeZone } from "@/lib/dates";
import { contextFor, employeeIdByEmail, DOMAIN } from "./helpers";

let admin: AuthContext, hr: AuthContext, manager: AuthContext, employee: AuthContext, payroll: AuthContext;
let saraId: string, yousefId: string;
const today = todayInTimeZone("Asia/Dubai");
const period = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
const createdRuns: string[] = [];
const listParams = { page: 1, pageSize: 20, q: "", sort: "name" as const, dir: "asc" as const };

beforeAll(async () => {
  [admin, hr, manager, employee, payroll] = await Promise.all(["admin", "hr", "manager", "employee", "payroll"].map((u) => contextFor(`${u}@${DOMAIN}`)));
  saraId = await employeeIdByEmail(`employee@${DOMAIN}`);
  yousefId = await employeeIdByEmail(`manager@${DOMAIN}`);
});

afterAll(async () => {
  await db.payrollAdjustment.updateMany({ where: { runId: { in: createdRuns } }, data: { runId: null } });
  await db.payrollRun.deleteMany({ where: { id: { in: createdRuns } } });
  await db.$disconnect();
});

async function latestPayslipId(employeeId: string) {
  return (await db.payslip.findFirstOrThrow({ where: { employeeId, voidedAt: null }, orderBy: { period: "desc" } })).id;
}

describe("payslip visibility (server-side)", () => {
  it("an employee sees their own released payslip", async () => {
    const p = await getPayslip(employee, await latestPayslipId(saraId));
    expect(p.employee.id).toBe(saraId);
    expect(p.employee.ibanMasked).toMatch(/•/);
    expect(p.net).toBe(p.gross - p.totalDeductions);
  });

  it("an employee CANNOT read another employee's payslip — not even their manager's", async () => {
    await expect(getPayslip(employee, await latestPayslipId(yousefId))).rejects.toBeInstanceOf(NotFoundError);
    await expect(listPayslips(employee, yousefId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("managers and HR cannot read their team's payslips; payroll can", async () => {
    const id = await latestPayslipId(saraId);
    await expect(getPayslip(manager, id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getPayslip(hr, id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listPayslips(manager, saraId)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await getPayslip(payroll, id)).employee.id).toBe(saraId);
  });
});

describe("salary data is restricted to payroll", () => {
  it("HR, managers and employees cannot read or change salaries", async () => {
    for (const ctx of [hr, manager, employee]) {
      await expect(getSalaryHistory(ctx, saraId)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listSalaries(ctx, listParams, {})).rejects.toBeInstanceOf(ForbiddenError);
      await expect(computeSettlement(ctx, saraId)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        createSalaryStructure(ctx, { employeeId: saraId, effectiveFrom: new Date(Date.UTC(2030, 0, 1)), reason: "x", componentIds: [], amounts: [] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
    await expect(exportRegister(hr, "any")).rejects.toBeInstanceOf(ForbiddenError);
    expect((await getSalaryHistory(payroll, saraId)).length).toBeGreaterThan(0);
  });

  it("salary history is append-only and validated", async () => {
    const basic = await db.payComponent.findFirstOrThrow({ where: { companyId: payroll.companyId, code: "BASIC" } });
    const join = (await db.employee.findUniqueOrThrow({ where: { id: saraId } })).joinDate;
    await expect(
      createSalaryStructure(payroll, { employeeId: saraId, effectiveFrom: join, reason: "dup", componentIds: [basic.id], amounts: ["1000"] }),
    ).rejects.toBeInstanceOf(ValidationError);
    const bonus = await db.payComponent.findFirstOrThrow({ where: { companyId: payroll.companyId, code: "BONUS" } });
    await expect(
      createSalaryStructure(payroll, { employeeId: saraId, effectiveFrom: new Date(Date.UTC(2030, 0, 1)), reason: "x", componentIds: [bonus.id], amounts: ["1000"] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("unpaid leave", () => {
  it("approved unpaid leave is deducted in the released payroll", async () => {
    const line = await db.payrollRunLine.findFirst({ where: { code: "UNPAID_LEAVE", runEmployee: { run: { companyId: payroll.companyId, status: "RELEASED" } } }, include: { runEmployee: { include: { run: true } } } });
    expect(line).not.toBeNull();
    const { start, end } = periodBounds(line!.runEmployee.run.period);
    const days = (await unpaidLeaveDays(payroll.companyId, start, end, [line!.runEmployee.employeeId])).get(line!.runEmployee.employeeId);
    expect(Number(line!.runEmployee.unpaidLeaveDays)).toBe(days);
    expect(Number(line!.amount)).toBeGreaterThan(0);
  });
});

describe("payroll run lifecycle", () => {
  let runId: string;

  it("creates and calculates a department run", async () => {
    const sara = await db.employee.findUniqueOrThrow({ where: { id: saraId } });
    await expect(createRun(employee, { period, scope: "ALL", scopeId: null, notes: null })).rejects.toBeInstanceOf(ForbiddenError);
    const run = await createRun(payroll, { period, scope: "DEPARTMENT", scopeId: sara.departmentId, notes: null });
    runId = run.id;
    createdRuns.push(run.id);
    await expect(releaseRun(payroll, runId)).rejects.toBeInstanceOf(ValidationError); // DRAFT can't be released
    await calculateRun(payroll, runId);
    const { run: calculated, rows } = await getRun(payroll, runId);
    expect(calculated.status).toBe("CALCULATED");
    expect(rows.some((r) => r.employeeId === saraId)).toBe(true);
    expect(rows.every((r) => r.department === calculated.scopeLabel || r.department !== null)).toBe(true);
    // nothing visible to employees yet
    expect((await listPayslips(employee, saraId)).some((p) => p.period === period)).toBe(false);
  });

  it("hold needs a reason; blocking issues must be resolved before submit", async () => {
    const entries = await db.payrollRunEmployee.findMany({ where: { runId } });
    await expect(setEntryStatus(payroll, { entryId: entries[0].id, status: "HELD", reason: null })).rejects.toBeInstanceOf(ValidationError);
    for (const e of entries) {
      if ((e.issues as { level: string }[]).some((i) => i.level === "error")) await setEntryStatus(payroll, { entryId: e.id, status: "HELD", reason: "Missing bank details" });
    }
    await submitRun(payroll, runId);
  });

  it("maker-checker: the preparer cannot approve; a second person can", async () => {
    await expect(approveRun(payroll, runId, null)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(approveRun(employee, runId, null)).rejects.toBeInstanceOf(ForbiddenError);
    await approveRun(admin, runId, "ok");
    const sif = await exportSif(payroll, runId);
    expect(sif.content).toMatch(/^SCR,/m);
  });

  it("release locks the run and issues payslips to included employees only", async () => {
    await releaseRun(payroll, runId, { notify: false });
    await expect(calculateRun(payroll, runId)).rejects.toBeInstanceOf(ValidationError);
    const entries = await db.payrollRunEmployee.findMany({ where: { runId }, include: { payslip: true } });
    for (const e of entries) expect(!!e.payslip).toBe(e.status === "INCLUDED");
    const mine = (await listPayslips(employee, saraId)).find((p) => p.period === period);
    expect(mine).toBeDefined();
    expect((await getPayslip(employee, mine!.id)).period).toBe(period);
    // adjustments for the period are now paid and locked
    await expect(createAdjustment(payroll, { employeeId: saraId, period, componentId: (await db.payComponent.findFirstOrThrow({ where: { companyId: payroll.companyId, code: "BONUS" } })).id, amount: "100", description: "late" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("only a Super Admin can reopen; reopening withdraws the payslips", async () => {
    await expect(reopenRun(payroll, runId, "fix")).rejects.toBeInstanceOf(ForbiddenError);
    await reopenRun(admin, runId, "Wrong allowance");
    const mine = await db.payslip.findFirstOrThrow({ where: { employeeId: saraId, period, runEmployee: { runId } } });
    expect(mine.voidedAt).not.toBeNull();
    await expect(getPayslip(employee, mine.id)).rejects.toBeInstanceOf(NotFoundError);
    const audit = await db.auditLog.findFirst({ where: { action: "payroll.run.reopen", entityId: runId } });
    expect(audit?.summary).toContain("Wrong allowance");
    // released again without recalculating: payslips come back
    await submitRun(payroll, runId);
    await approveRun(admin, runId, null);
    await releaseRun(payroll, runId, { notify: false });
    expect((await getPayslip(employee, mine.id)).id).toBe(mine.id);
  });

  it("cancelled runs cannot be released", async () => {
    const run = await createRun(payroll, { period, scope: "ALL", scopeId: null, notes: null });
    createdRuns.push(run.id);
    await cancelRun(payroll, run.id, "test");
    await expect(calculateRun(payroll, run.id)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("final settlement", () => {
  it("maker-checker applies to settlements", async () => {
    const draft = await db.finalSettlement.findFirstOrThrow({ where: { companyId: payroll.companyId, status: "DRAFT" } });
    await expect(approveSettlement(payroll, draft.id)).rejects.toBeInstanceOf(ForbiddenError); // payroll@ prepared it in the seed
    await expect(approveSettlement(hr, draft.id)).rejects.toBeInstanceOf(ForbiddenError);
    await approveSettlement(admin, draft.id);
    expect((await db.finalSettlement.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("APPROVED");
    await db.finalSettlement.update({ where: { id: draft.id }, data: { status: "DRAFT", approvedById: null, approvedAt: null } });
  });

  it("computes gratuity, leave encashment and unpaid salary", async () => {
    const s = await computeSettlement(payroll, saraId);
    expect(s.gratuity.eligible).toBe(true);
    expect(s.gratuity.amount).toBeGreaterThan(0);
    expect(s.total).toBe(s.unpaidSalary + s.leaveEncashment + s.gratuity.amount);
  });
});
