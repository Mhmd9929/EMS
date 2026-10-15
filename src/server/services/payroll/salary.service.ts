import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { writeAudit } from "@/server/audit";
import { NotFoundError, ValidationError } from "@/server/errors";
import { structureMonthlyAmounts } from "@/lib/payroll/calc";
import { toMinor } from "@/lib/payroll/money";
import { todayInTimeZone, toDateInput } from "@/lib/dates";
import { paginated, type ListParams } from "@/lib/list-params";
import { loadComponents, n, structureInclude, toComponentDef, toStructureInput } from "./common";

/** Salary history (newest first) with resolved monthly amounts per structure. */
export async function getSalaryHistory(ctx: AuthContext, employeeId: string) {
  assertCan(ctx, "payroll.salary.read");
  const employee = await db.employee.findFirst({ where: { id: employeeId, companyId: ctx.companyId }, select: { id: true } });
  if (!employee) throw new NotFoundError("Employee not found.");
  const [structures, components] = await Promise.all([
    db.salaryStructure.findMany({ where: { employeeId }, include: structureInclude, orderBy: { effectiveFrom: "desc" } }),
    loadComponents(db, ctx.companyId),
  ]);
  const defs = components.map(toComponentDef);
  const today = todayInTimeZone(ctx.timezone);
  const currentIndex = structures.findIndex((s) => s.effectiveFrom <= today);
  return structures.map((s, i) => {
    let amounts: Record<string, number> = {};
    let error: string | null = null;
    try {
      amounts = structureMonthlyAmounts(toStructureInput(s), defs, ctx.currency);
    } catch (e) {
      error = e instanceof Error ? e.message : "Formula error";
    }
    const lines = components
      .filter((c) => c.code in amounts)
      .map((c) => ({ componentId: c.id, code: c.code, name: c.name, kind: c.kind, calcType: c.calcType, formula: c.formula, amount: amounts[c.code], fixedAmount: n(s.lines.find((l) => l.componentId === c.id)?.amount) }));
    const gross = lines.filter((l) => l.kind === "EARNING").reduce((a, l) => a + l.amount, 0);
    return { id: s.id, effectiveFrom: s.effectiveFrom, reason: s.reason, createdAt: s.createdAt, lines, gross, error, status: i === currentIndex ? "current" : s.effectiveFrom > today ? "scheduled" : "past" } as const;
  });
}

/** New salary from a date. Past structures are never edited — history is append-only. */
export async function createSalaryStructure(
  ctx: AuthContext,
  input: { employeeId: string; effectiveFrom: Date; reason: string; componentIds: string[]; amounts: string[] },
) {
  assertCan(ctx, "payroll.salary.manage");
  if (input.componentIds.length !== input.amounts.length) throw new ValidationError("Invalid salary lines.");
  const [employee, components] = await Promise.all([
    db.employee.findFirst({ where: { id: input.employeeId, companyId: ctx.companyId }, select: { id: true, firstName: true, lastName: true, joinDate: true, status: true } }),
    loadComponents(db, ctx.companyId),
  ]);
  if (!employee) throw new NotFoundError("Employee not found.");
  if (employee.status === "TERMINATED") throw new ValidationError("Cannot change the salary of a terminated employee.");
  const byId = new Map(components.map((c) => [c.id, c]));
  const lines: { componentId: string; amount: bigint | null }[] = [];
  const seen = new Set<string>();
  input.componentIds.forEach((id, i) => {
    const c = byId.get(id);
    if (!c || !c.isRecurring || c.kind !== "EARNING" || !c.isActive) throw new ValidationError("Salary structures can only contain active recurring earnings.");
    if (seen.has(id)) throw new ValidationError(`${c.name} appears twice.`);
    seen.add(id);
    if (c.calcType === "FORMULA") return void lines.push({ componentId: id, amount: null });
    let minor: number;
    try {
      minor = toMinor(input.amounts[i] || "0", ctx.currency);
    } catch {
      throw new ValidationError(`Invalid amount for ${c.name}.`, { amounts: [`Invalid amount for ${c.name}`] });
    }
    if (minor < 0) throw new ValidationError(`${c.name} cannot be negative.`);
    lines.push({ componentId: id, amount: BigInt(minor) });
  });
  const basic = components.find((c) => c.code === "BASIC");
  if (basic && !seen.has(basic.id)) throw new ValidationError("Basic salary is required (it drives gratuity and leave encashment).");
  // Formulas must resolve with these lines.
  try {
    structureMonthlyAmounts(
      { effectiveFrom: input.effectiveFrom, lines: lines.map((l) => ({ code: byId.get(l.componentId)!.code, amount: l.amount === null ? null : Number(l.amount) })) },
      components.map(toComponentDef),
      ctx.currency,
    );
  } catch (e) {
    throw new ValidationError(e instanceof Error ? e.message : "Formula error");
  }
  if (input.effectiveFrom < employee.joinDate) throw new ValidationError("Effective date is before the join date.", { effectiveFrom: ["Before the join date"] });
  if (await db.salaryStructure.findUnique({ where: { employeeId_effectiveFrom: { employeeId: employee.id, effectiveFrom: input.effectiveFrom } } })) {
    throw new ValidationError("There is already a salary starting on that date.", { effectiveFrom: ["Already used"] });
  }
  const released = await db.payslip.findFirst({
    where: { employeeId: employee.id, voidedAt: null, runEmployee: { run: { periodEnd: { gte: input.effectiveFrom } } } },
    orderBy: { period: "desc" },
  });
  return db.$transaction(async (tx) => {
    const s = await tx.salaryStructure.create({
      data: { companyId: ctx.companyId, employeeId: employee.id, effectiveFrom: input.effectiveFrom, reason: input.reason, createdById: ctx.userId, lines: { create: lines } },
    });
    await writeAudit(ctx, {
      action: "payroll.salary.create",
      entityType: "SalaryStructure",
      entityId: s.id,
      summary: `New salary for ${employee.firstName} ${employee.lastName} from ${toDateInput(input.effectiveFrom)}: ${input.reason}`,
      after: { effectiveFrom: input.effectiveFrom, lines: lines.map((l) => ({ component: byId.get(l.componentId)!.code, amount: l.amount })) },
    }, tx);
    return { structure: s, backdatedOverReleased: released ? released.period : null };
  });
}

/** Only salaries that have not started yet can be deleted. */
export async function deleteSalaryStructure(ctx: AuthContext, structureId: string) {
  assertCan(ctx, "payroll.salary.manage");
  const s = await db.salaryStructure.findFirst({ where: { id: structureId, companyId: ctx.companyId }, include: structureInclude });
  if (!s) throw new NotFoundError("Salary not found.");
  if (s.effectiveFrom <= todayInTimeZone(ctx.timezone)) throw new ValidationError("Only future (scheduled) salary changes can be deleted. Add a new change instead.");
  await db.$transaction(async (tx) => {
    await tx.salaryStructure.delete({ where: { id: s.id } });
    await writeAudit(ctx, { action: "payroll.salary.delete", entityType: "SalaryStructure", entityId: s.id, summary: `Deleted scheduled salary from ${toDateInput(s.effectiveFrom)}`, before: toStructureInput(s) }, tx);
  });
}

export const SALARY_SORTS = ["name", "gross"] as const;

/** Current salary per employee. */
export async function listSalaries(ctx: AuthContext, params: ListParams<(typeof SALARY_SORTS)[number]>, filters: { departmentId?: string; missing?: boolean }) {
  assertCan(ctx, "payroll.salary.read");
  const today = todayInTimeZone(ctx.timezone);
  const terms = params.q.split(/\s+/).filter(Boolean);
  const where: Prisma.EmployeeWhereInput = {
    companyId: ctx.companyId,
    status: { not: "TERMINATED" },
    ...(filters.departmentId && { departmentId: filters.departmentId }),
    ...(filters.missing && { salaryStructures: { none: { effectiveFrom: { lte: today } } } }),
    AND: terms.map((t) => ({ OR: [{ firstName: { contains: t, mode: "insensitive" as const } }, { lastName: { contains: t, mode: "insensitive" as const } }, { employeeNumber: { contains: t, mode: "insensitive" as const } }] })),
  };
  const [employees, components] = await Promise.all([
    db.employee.findMany({
      where,
      select: {
        id: true, employeeNumber: true, firstName: true, lastName: true, preferredName: true,
        department: { select: { name: true } }, position: { select: { title: true, grade: true } },
        salaryStructures: { where: { effectiveFrom: { lte: today } }, orderBy: { effectiveFrom: "desc" }, take: 1, include: structureInclude },
        _count: { select: { salaryStructures: { where: { effectiveFrom: { gt: today } } } } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    loadComponents(db, ctx.companyId),
  ]);
  const defs = components.map(toComponentDef);
  let rows = employees.map((e) => {
    const s = e.salaryStructures[0];
    let amounts: Record<string, number> = {};
    if (s) {
      try {
        amounts = structureMonthlyAmounts(toStructureInput(s), defs, ctx.currency);
      } catch {
        amounts = {};
      }
    }
    const gross = Object.entries(amounts).reduce((a, [code, v]) => a + (defs.find((d) => d.code === code)?.kind === "EARNING" ? v : 0), 0);
    return { employee: e, effectiveFrom: s?.effectiveFrom ?? null, basic: amounts.BASIC ?? 0, gross, scheduled: e._count.salaryStructures };
  });
  if (params.sort === "gross") rows.sort((a, b) => a.gross - b.gross);
  if (params.dir === "desc") rows.reverse();
  const total = rows.length;
  rows = rows.slice((params.page - 1) * params.pageSize, params.page * params.pageSize);
  return paginated(rows, total, params.page, params.pageSize);
}
