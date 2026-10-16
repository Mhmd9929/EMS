import "server-only";
import { db } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { writeAudit } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { calculatePay, periodBounds, structureMonthlyAmounts } from "@/lib/payroll/calc";
import { calculateGratuity } from "@/lib/payroll/gratuity";
import { formatMoney, toMinor } from "@/lib/payroll/money";
import { addDays, formatDate, todayInTimeZone } from "@/lib/dates";
import { round2 } from "@/lib/leave/numbers";
import { unpaidLeaveDays } from "@/server/services/leave/report.service";
import { computeBalances, loadLeaveEmployee } from "@/server/services/leave/balance.service";
import { serverT } from "@/server/i18n";
import { gratuityConfig, loadComponents, n, periodKey, structureInclude, toComponentDef, toStructureInput } from "./common";

/**
 * End-of-service figures for an employee as of `endDate` (their last working day, or today for an estimate):
 *   unpaid salary (days after the last released payslip) + leave encashment + gratuity + other − deductions
 */
export async function computeSettlement(ctx: AuthContext, employeeId: string, opts: { endDate?: Date; otherEarnings?: number; deductions?: number } = {}) {
  assertCan(ctx, ["payroll.settlement.manage", "payroll.salary.read"]);
  const [employee, company, components] = await Promise.all([
    db.employee.findFirst({ where: { id: employeeId, companyId: ctx.companyId }, include: { salaryStructures: { include: structureInclude } } }),
    db.company.findUniqueOrThrow({ where: { id: ctx.companyId } }),
    loadComponents(db, ctx.companyId),
  ]);
  const t = await serverT("payroll");
  if (!employee) throw new NotFoundError(t("errors.employeeNotFound"));
  const endDate = opts.endDate ?? employee.lastWorkingDay ?? todayInTimeZone(ctx.timezone);
  const defs = components.map(toComponentDef);
  const structure = employee.salaryStructures.filter((s) => s.effectiveFrom <= endDate).sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
  if (!structure) throw new ValidationError(t("errors.noStructure"));
  const monthly = structureMonthlyAmounts(toStructureInput(structure), defs, company.currency);
  const basic = monthly.BASIC ?? 0;
  const grossRecurring = Object.entries(monthly).reduce((a, [code, v]) => a + (defs.find((d) => d.code === code)?.kind === "EARNING" ? v : 0), 0);

  // Gratuity: service excludes unpaid leave
  const unpaidAll = (await unpaidLeaveDays(ctx.companyId, employee.joinDate, endDate, [employee.id])).get(employee.id) ?? 0;
  const gratuity = calculateGratuity({ basicMonthly: basic, joinDate: employee.joinDate, endDate, unpaidLeaveDays: unpaidAll, config: gratuityConfig(company) });

  // Leave encashment: remaining balance of encashable leave types in the final year
  const leaveEmployee = await loadLeaveEmployee(db, ctx.companyId, employee.id);
  const encashable = await db.leaveType.findMany({ where: { companyId: ctx.companyId, isEncashable: true, accrualMethod: { not: "NONE" } }, select: { id: true, name: true } });
  const { balances } = await computeBalances(ctx.companyId, [leaveEmployee], endDate.getUTCFullYear(), { typeIds: encashable.map((t) => t.id) });
  const leaveLines = (balances.get(employee.id) ?? []).map((b) => ({ type: b.leaveType.name, days: Math.max(0, b.available) }));
  const leaveDays = round2(leaveLines.reduce((a, l) => a + l.days, 0));
  const encashmentDaily = (company.leaveEncashmentBasis === "GROSS" ? grossRecurring : basic) / 30;
  const leaveEncashment = Math.round(encashmentDaily * leaveDays);

  // Salary not yet paid: from the day after the last released payslip period (or join date) to endDate
  const lastPaid = await db.payslip.findFirst({ where: { employeeId: employee.id, voidedAt: null, runEmployee: { run: { status: "RELEASED" } } }, orderBy: { period: "desc" }, include: { runEmployee: { select: { run: { select: { periodEnd: true } } } } } });
  const unpaidFrom = lastPaid ? addDays(lastPaid.runEmployee.run.periodEnd, 1) : employee.joinDate;
  let unpaidSalary = 0;
  let unpaidSalaryDays = 0;
  const salaryNotes: string[] = [];
  for (let cursor = unpaidFrom; cursor <= endDate; ) {
    const { start, end } = periodBounds(periodKey(cursor));
    const r = calculatePay({
      periodStart: start, periodEnd: end, basis: company.payrollProrationBasis, currency: company.currency,
      joinDate: cursor > employee.joinDate ? cursor : employee.joinDate, lastWorkingDay: endDate,
      components: defs, structures: employee.salaryStructures.map(toStructureInput),
      unpaidLeaveDays: (await unpaidLeaveDays(ctx.companyId, cursor, end < endDate ? end : endDate, [employee.id])).get(employee.id) ?? 0,
      adjustments: [],
    });
    if (r.payable) {
      unpaidSalary += r.net;
      unpaidSalaryDays += r.paidDays;
      salaryNotes.push(`${periodKey(start)}: ${r.paidDays} days`);
    }
    cursor = addDays(end, 1);
  }

  const otherEarnings = opts.otherEarnings ?? 0;
  const deductions = opts.deductions ?? 0;
  const total = unpaidSalary + leaveEncashment + gratuity.amount + otherEarnings - deductions;
  return {
    employee: { id: employee.id, name: `${employee.firstName} ${employee.lastName}`, joinDate: employee.joinDate, lastWorkingDay: employee.lastWorkingDay },
    currency: company.currency,
    endDate,
    basic,
    grossRecurring,
    gratuity,
    unpaidLeaveExcluded: unpaidAll,
    leaveLines,
    leaveDays,
    leaveEncashment,
    encashmentBasis: company.leaveEncashmentBasis,
    unpaidFrom,
    unpaidSalary,
    unpaidSalaryDays: round2(unpaidSalaryDays),
    salaryNotes,
    otherEarnings,
    deductions,
    total,
  };
}

export async function saveSettlement(ctx: AuthContext, input: { employeeId: string; otherEarnings: string; deductions: string; notes: string | null }) {
  assertCan(ctx, "payroll.settlement.manage");
  const employee = await db.employee.findFirst({ where: { id: input.employeeId, companyId: ctx.companyId }, select: { id: true, lastWorkingDay: true, firstName: true, lastName: true } });
  const t = await serverT("payroll");
  if (!employee) throw new NotFoundError(t("errors.employeeNotFound"));
  if (!employee.lastWorkingDay) throw new ValidationError(t("errors.recordTermination"));
  const other = toMinor(input.otherEarnings, ctx.currency);
  const ded = toMinor(input.deductions, ctx.currency);
  const s = await computeSettlement(ctx, employee.id, { endDate: employee.lastWorkingDay, otherEarnings: other, deductions: ded });
  return db.$transaction(async (tx) => {
    await tx.finalSettlement.updateMany({ where: { employeeId: employee.id, status: "DRAFT" }, data: { status: "CANCELLED" } });
    const created = await tx.finalSettlement.create({
      data: {
        companyId: ctx.companyId, employeeId: employee.id, lastWorkingDay: employee.lastWorkingDay!, serviceYears: s.gratuity.serviceYears,
        basicSalary: BigInt(s.basic), unpaidSalaryDays: s.unpaidSalaryDays, unpaidSalary: BigInt(s.unpaidSalary), leaveDays: s.leaveDays,
        leaveEncashment: BigInt(s.leaveEncashment), gratuity: BigInt(s.gratuity.amount), otherEarnings: BigInt(other), deductions: BigInt(ded),
        total: BigInt(s.total), notes: input.notes, createdById: ctx.userId,
        breakdown: JSON.parse(JSON.stringify(s)),
      },
    });
    await writeAudit(ctx, { action: "payroll.settlement.save", entityType: "FinalSettlement", entityId: created.id, summary: `Final settlement for ${employee.firstName} ${employee.lastName}: ${formatMoney(s.total, ctx.currency)} (last day ${formatDate(employee.lastWorkingDay)})`, after: { total: s.total, gratuity: s.gratuity.amount, leaveEncashment: s.leaveEncashment, unpaidSalary: s.unpaidSalary, other, deductions: ded } }, tx);
    return created;
  });
}

export async function approveSettlement(ctx: AuthContext, settlementId: string) {
  assertCan(ctx, "payroll.settlement.manage");
  const s = await db.finalSettlement.findFirst({ where: { id: settlementId, companyId: ctx.companyId }, include: { employee: { select: { firstName: true, lastName: true } } } });
  const t = await serverT("payroll");
  if (!s) throw new NotFoundError(t("errors.settlementNotFound"));
  if (s.status !== "DRAFT") throw new ValidationError(t("errors.onlyDraft"));
  if (s.createdById === ctx.userId) throw new ForbiddenError(t("errors.settlementMakerChecker"));
  await db.$transaction(async (tx) => {
    await tx.finalSettlement.update({ where: { id: s.id }, data: { status: "APPROVED", approvedById: ctx.userId, approvedAt: new Date() } });
    await writeAudit(ctx, { action: "payroll.settlement.approve", entityType: "FinalSettlement", entityId: s.id, summary: `Approved final settlement for ${s.employee.firstName} ${s.employee.lastName} (${formatMoney(n(s.total), ctx.currency)})` }, tx);
  });
}

export async function listSettlements(ctx: AuthContext, status?: "DRAFT" | "APPROVED" | "CANCELLED") {
  assertCan(ctx, "payroll.settlement.manage");
  return db.finalSettlement.findMany({
    where: { companyId: ctx.companyId, ...(status && { status }) },
    include: { employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, department: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function settlementsFor(ctx: AuthContext, employeeId: string) {
  assertCan(ctx, ["payroll.settlement.manage", "payroll.salary.read"]);
  return db.finalSettlement.findMany({ where: { companyId: ctx.companyId, employeeId, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" } });
}

/** Leavers who still need a settlement (for the settlements page). */
export async function leaversWithoutSettlement(ctx: AuthContext) {
  assertCan(ctx, "payroll.settlement.manage");
  const since = addDays(todayInTimeZone(ctx.timezone), -365);
  return db.employee.findMany({
    where: { companyId: ctx.companyId, lastWorkingDay: { gte: since }, finalSettlements: { none: { status: { in: ["DRAFT", "APPROVED"] } } } },
    select: { id: true, employeeNumber: true, firstName: true, lastName: true, lastWorkingDay: true, terminationReason: true },
    orderBy: { lastWorkingDay: "asc" },
  });
}

