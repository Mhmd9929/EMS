import "server-only";
import { db } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { writeAudit } from "@/server/audit";
import { NotFoundError, ValidationError } from "@/server/errors";
import { toMinor, formatMoney } from "@/lib/payroll/money";
import { periodBounds } from "@/lib/payroll/calc";

export async function listAdjustments(ctx: AuthContext, period: string) {
  assertCan(ctx, ["payroll.salary.manage", "payroll.run.manage"]);
  return db.payrollAdjustment.findMany({
    where: { companyId: ctx.companyId, period },
    include: {
      employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, preferredName: true } },
      component: { select: { code: true, name: true, kind: true } },
      run: { select: { id: true, status: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

/** Is a period locked for an employee (already paid in a released run)? */
async function releasedFor(employeeId: string, period: string) {
  return db.payrollRunEmployee.findFirst({ where: { employeeId, run: { period, status: "RELEASED" } }, select: { id: true } });
}

export async function createAdjustment(ctx: AuthContext, input: { employeeId: string; period: string; componentId: string; amount: string; description: string }) {
  assertCan(ctx, "payroll.salary.manage");
  periodBounds(input.period);
  const [employee, component] = await Promise.all([
    db.employee.findFirst({ where: { id: input.employeeId, companyId: ctx.companyId }, select: { id: true, firstName: true, lastName: true } }),
    db.payComponent.findFirst({ where: { id: input.componentId, companyId: ctx.companyId } }),
  ]);
  if (!employee) throw new ValidationError("Choose an employee.", { employeeId: ["Unknown employee"] });
  if (!component || component.isRecurring || component.isSystem || !component.isActive) throw new ValidationError("Choose a one-time component.", { componentId: ["Only active one-time components"] });
  let amount: number;
  try {
    amount = toMinor(input.amount, ctx.currency);
  } catch {
    throw new ValidationError("Invalid amount.", { amount: ["Invalid amount"] });
  }
  if (amount <= 0) throw new ValidationError("Amount must be positive.", { amount: ["Must be greater than zero"] });
  if (await releasedFor(employee.id, input.period)) throw new ValidationError(`${input.period} payroll is already released for this employee. Enter it in a later month.`);
  return db.$transaction(async (tx) => {
    const a = await tx.payrollAdjustment.create({
      data: { companyId: ctx.companyId, employeeId: employee.id, period: input.period, componentId: component.id, amount: BigInt(amount), description: input.description, createdById: ctx.userId },
    });
    await writeAudit(ctx, {
      action: "payroll.adjustment.create",
      entityType: "PayrollAdjustment",
      entityId: a.id,
      summary: `${component.name} ${formatMoney(amount, ctx.currency)} for ${employee.firstName} ${employee.lastName} (${input.period}): ${input.description}`,
      after: { period: input.period, component: component.code, amount, description: input.description },
    }, tx);
    return a;
  });
}

export async function deleteAdjustment(ctx: AuthContext, id: string) {
  assertCan(ctx, "payroll.salary.manage");
  const a = await db.payrollAdjustment.findFirst({ where: { id, companyId: ctx.companyId }, include: { component: true } });
  if (!a) throw new NotFoundError("Adjustment not found.");
  if (a.runId || (await releasedFor(a.employeeId, a.period))) throw new ValidationError("This adjustment was paid in a released payroll and can't be deleted.");
  await db.$transaction(async (tx) => {
    await tx.payrollAdjustment.delete({ where: { id } });
    await writeAudit(ctx, { action: "payroll.adjustment.delete", entityType: "PayrollAdjustment", entityId: id, summary: `Deleted ${a.component.name} (${a.period})`, before: a }, tx);
  });
}
