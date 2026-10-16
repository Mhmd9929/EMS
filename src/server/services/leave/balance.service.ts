import "server-only";
import type { LeaveType } from "@prisma/client";
import { db, type DbClient } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { getEmployeeAccess, getVisibleEmployeeScope } from "@/server/rbac/scope";
import { writeAudit } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { addMonthsClamped, expectedCredits } from "@/lib/leave/accrual";
import { carryForwardExpiry, computeBalance, yearEndCarry, type Balance, type LedgerKind } from "@/lib/leave/balance";
import { effectiveRules, type PolicyLike } from "@/lib/leave/policy";
import { num, round2, sum } from "@/lib/leave/numbers";
import { todayInTimeZone } from "@/lib/dates";
import { paginated, type ListParams } from "@/lib/list-params";
import { serverT } from "@/server/i18n";
import { accrualRule, displayName, leaveEmployeeSelect, loadPolicies, requestDayTotals, typeRules, yearBounds, type LeaveEmployee } from "./common";
import { notify, deliverEmailsInBackground } from "../notification.service";

export type TypeBalance = Balance & {
  leaveType: Pick<LeaveType, "id" | "code" | "name" | "color" | "isPaid" | "accrualMethod">;
  eligible: boolean;
  ineligibleReason: string | null;
  tracked: boolean;
};

const employeeFacts = (e: LeaveEmployee) => ({
  departmentId: e.departmentId,
  positionId: e.positionId,
  employmentType: e.employmentType,
  gender: e.gender,
  joinDate: e.joinDate,
});

// ───────────────────────────── Accrual sync ─────────────────────────────

/**
 * Write any missing ENTITLEMENT/ACCRUAL ledger entries for `year` up to `asOf`. Idempotent (unique period
 * keys), so the worker can run it every day and a missed run is caught up next time.
 */
export async function syncAccruals(companyId: string, year: number, asOf: Date, employeeIds?: string[]) {
  const { from } = yearBounds(year);
  const [types, policies, employees] = await Promise.all([
    db.leaveType.findMany({ where: { companyId, isActive: true, accrualMethod: { not: "NONE" } } }),
    loadPolicies(db, companyId),
    db.employee.findMany({
      where: {
        companyId,
        ...(employeeIds && { id: { in: employeeIds } }),
        joinDate: { lte: yearBounds(year).to },
        OR: [{ status: { not: "TERMINATED" } }, { lastWorkingDay: { gte: from } }],
      },
      select: leaveEmployeeSelect,
    }),
  ]);
  const rows: { companyId: string; employeeId: string; leaveTypeId: string; year: number; kind: "ENTITLEMENT" | "ACCRUAL"; days: number; effectiveDate: Date; periodKey: string }[] = [];
  for (const e of employees) {
    for (const t of types) {
      const rules = effectiveRules(typeRules(t), policies, employeeFacts(e));
      if (!rules.eligible) continue;
      for (const c of expectedCredits(accrualRule(t, rules.entitlement), { joinDate: e.joinDate, lastWorkingDay: e.lastWorkingDay }, year, asOf)) {
        rows.push({ companyId, employeeId: e.id, leaveTypeId: t.id, year, kind: c.kind, days: c.amount, effectiveDate: c.effectiveDate, periodKey: c.periodKey });
      }
    }
  }
  if (!rows.length) return 0;
  const result = await db.leaveLedgerEntry.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

// ───────────────────────────── Balance reads ─────────────────────────────

async function ledgerFor(client: DbClient, employeeIds: string[], year: number) {
  const rows = await client.leaveLedgerEntry.groupBy({
    by: ["employeeId", "leaveTypeId", "kind"],
    where: { employeeId: { in: employeeIds }, year },
    _sum: { days: true },
  });
  const map = new Map<string, { kind: LedgerKind; days: number }[]>();
  for (const r of rows) {
    const key = `${r.employeeId}:${r.leaveTypeId}`;
    map.set(key, [...(map.get(key) ?? []), { kind: r.kind, days: num(r._sum.days) }]);
  }
  return map;
}

/** Balances for many employees at once (used by the employee view and the HR balances table). */
export async function computeBalances(companyId: string, employees: LeaveEmployee[], year: number, opts: { typeIds?: string[] } = {}) {
  const ids = employees.map((e) => e.id);
  const { from, to } = yearBounds(year);
  const [types, policies, ledger, dayTotals] = await Promise.all([
    db.leaveType.findMany({ where: { companyId, isActive: true, ...(opts.typeIds && { id: { in: opts.typeIds } }) }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    loadPolicies(db, companyId),
    ledgerFor(db, ids, year),
    requestDayTotals(db, companyId, ids, from, to),
  ]);
  const tl = await serverT("leave");
  const result = new Map<string, TypeBalance[]>();
  for (const e of employees) {
    result.set(
      e.id,
      types.map((t) => {
        const rules = effectiveRules(typeRules(t), policies, employeeFacts(e));
        const key = `${e.id}:${t.id}`;
        const totals = dayTotals.get(key) ?? { taken: 0, pending: 0 };
        const b = computeBalance({ entitled: rules.eligible ? rules.entitlement : 0, ledger: ledger.get(key) ?? [], takenDays: totals.taken, pendingDays: totals.pending });
        return {
          ...b,
          leaveType: { id: t.id, code: t.code, name: t.name, color: t.color, isPaid: t.isPaid, accrualMethod: t.accrualMethod },
          eligible: rules.eligible,
          ineligibleReason: rules.reasonCode ? tl(`ineligible.${rules.reasonCode}`) : null,
          tracked: t.accrualMethod !== "NONE",
        };
      }),
    );
  }
  return { types, balances: result };
}

export async function loadLeaveEmployee(client: DbClient, companyId: string, employeeId: string) {
  const e = await client.employee.findFirst({ where: { id: employeeId, companyId }, select: leaveEmployeeSelect });
  if (!e) throw new NotFoundError((await serverT("leave"))("errors.employeeNotFound"));
  return e;
}

/** Balances for one employee; self, their managers (team) and HR may look. */
export async function getEmployeeBalances(ctx: AuthContext, employeeId: string, year: number) {
  const access = await getEmployeeAccess(ctx, employeeId);
  if (access === "none") throw new ForbiddenError();
  const e = await loadLeaveEmployee(db, ctx.companyId, employeeId);
  const { balances } = await computeBalances(ctx.companyId, [e], year);
  return balances.get(e.id)!;
}

/**
 * Projected credits an employee will have accrued by `date` that are not in the ledger yet (e.g. future
 * months of a monthly accrual). Used so people can book leave against what they'll have earned by then.
 */
export async function projectedCredits(companyId: string, e: LeaveEmployee, type: LeaveType, year: number, date: Date, policies: PolicyLike[]) {
  const rules = effectiveRules(typeRules(type), policies, employeeFacts(e));
  if (!rules.eligible || type.accrualMethod === "NONE") return 0;
  const expected = expectedCredits(accrualRule(type, rules.entitlement), { joinDate: e.joinDate, lastWorkingDay: e.lastWorkingDay }, year, date);
  const existing = await db.leaveLedgerEntry.findMany({
    where: { employeeId: e.id, leaveTypeId: type.id, year, periodKey: { in: expected.map((c) => c.periodKey) } },
    select: { periodKey: true },
  });
  const have = new Set(existing.map((x) => x.periodKey));
  return sum(expected.filter((c) => !have.has(c.periodKey)).map((c) => c.amount));
}

// ───────────────────────────── HR balances table ─────────────────────────────

export const BALANCE_SORTS = ["name", "available"] as const;

export async function listBalances(
  ctx: AuthContext,
  params: ListParams<(typeof BALANCE_SORTS)[number]>,
  filters: { year: number; leaveTypeId: string; departmentId?: string },
) {
  assertCan(ctx, ["leave.balance.adjust", "leave.report.read"]);
  const scope = await getVisibleEmployeeScope(ctx);
  if (scope !== "all") throw new ForbiddenError();
  const type = await db.leaveType.findFirst({ where: { id: filters.leaveTypeId, companyId: ctx.companyId } });
  if (!type) throw new NotFoundError((await serverT("leave"))("errors.typeNotFound"));
  const terms = params.q.split(/\s+/).filter(Boolean);
  const employees = await db.employee.findMany({
    where: {
      companyId: ctx.companyId,
      OR: [{ status: { not: "TERMINATED" } }, { lastWorkingDay: { gte: yearBounds(filters.year).from } }],
      ...(filters.departmentId && { departmentId: filters.departmentId }),
      AND: terms.map((t) => ({
        OR: [
          { firstName: { contains: t, mode: "insensitive" as const } },
          { lastName: { contains: t, mode: "insensitive" as const } },
          { employeeNumber: { contains: t, mode: "insensitive" as const } },
        ],
      })),
    },
    select: { ...leaveEmployeeSelect, employeeNumber: true, department: { select: { name: true } } },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  const { balances } = await computeBalances(ctx.companyId, employees, filters.year, { typeIds: [type.id] });
  let rows = employees.map((e) => ({ employee: e, balance: balances.get(e.id)![0] }));
  if (params.sort === "available") rows.sort((a, b) => a.balance.available - b.balance.available);
  if (params.dir === "desc") rows.reverse();
  const total = rows.length;
  rows = rows.slice((params.page - 1) * params.pageSize, params.page * params.pageSize);
  return { ...paginated(rows, total, params.page, params.pageSize), type };
}

/** Every employee × tracked type for a year (export). */
export async function exportBalances(ctx: AuthContext, year: number) {
  assertCan(ctx, "leave.report.read");
  const employees = await db.employee.findMany({
    where: { companyId: ctx.companyId, OR: [{ status: { not: "TERMINATED" } }, { lastWorkingDay: { gte: yearBounds(year).from } }] },
    select: { ...leaveEmployeeSelect, employeeNumber: true, department: { select: { name: true } } },
    orderBy: { employeeNumber: "asc" },
  });
  const { types, balances } = await computeBalances(ctx.companyId, employees, year);
  return { employees, types, balances };
}

// ───────────────────────────── Manual adjustment ─────────────────────────────

export async function adjustBalance(ctx: AuthContext, input: { employeeId: string; leaveTypeId: string; year: number; days: number; reason: string }) {
  assertCan(ctx, "leave.balance.adjust");
  if ((await getEmployeeAccess(ctx, input.employeeId)) !== "all") throw new ForbiddenError();
  const t = await serverT("leave");
  if (input.employeeId === ctx.employeeId) throw new ForbiddenError(t("errors.ownBalance"));
  if (input.days === 0) throw new ValidationError(t("errors.zeroAdjustment"), { days: [t("errors.zeroAdjustmentField")] });
  const ids: string[] = [];
  const entry = await db.$transaction(async (tx) => {
    const [employee, type] = await Promise.all([
      tx.employee.findFirst({ where: { id: input.employeeId, companyId: ctx.companyId }, select: { id: true, userId: true, firstName: true, lastName: true, preferredName: true } }),
      tx.leaveType.findFirst({ where: { id: input.leaveTypeId, companyId: ctx.companyId } }),
    ]);
    if (!employee) throw new NotFoundError(t("errors.employeeNotFound"));
    if (!type) throw new NotFoundError(t("errors.typeNotFound"));
    if (type.accrualMethod === "NONE") throw new ValidationError(t("errors.notTracked", { type: type.name }));
    const created = await tx.leaveLedgerEntry.create({
      data: {
        companyId: ctx.companyId,
        employeeId: employee.id,
        leaveTypeId: type.id,
        year: input.year,
        kind: "ADJUSTMENT",
        days: round2(input.days),
        effectiveDate: todayInTimeZone(ctx.timezone),
        reason: input.reason,
        createdById: ctx.userId,
      },
    });
    await writeAudit(ctx, {
      action: "leave.balance.adjust",
      entityType: "LeaveBalance",
      entityId: employee.id,
      summary: `${round2(input.days) > 0 ? "+" : ""}${round2(input.days)} days ${type.name} ${input.year} for ${displayName(employee)}: ${input.reason}`,
      after: { leaveType: type.code, year: input.year, days: round2(input.days), reason: input.reason },
    }, tx);
    ids.push(
      ...(await notify(tx, {
        companyId: ctx.companyId,
        userIds: [employee.userId],
        type: "leave.balance_adjusted",
        message: { key: "leaveBalanceAdjusted", params: { type: type.name, year: String(input.year), days: round2(input.days), reason: input.reason } },
        link: "/leave",
      })),
    );
    return created;
  });
  deliverEmailsInBackground(ids);
  return entry;
}

export async function listLedger(ctx: AuthContext, employeeId: string, year: number) {
  const access = await getEmployeeAccess(ctx, employeeId);
  if (access === "none") throw new ForbiddenError();
  return db.leaveLedgerEntry.findMany({
    where: { employeeId, year, leaveType: { companyId: ctx.companyId } },
    include: { leaveType: { select: { name: true, code: true, color: true } } },
    orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
  });
}

// ───────────────────────────── Year end & expiry (jobs) ─────────────────────────────

/**
 * Close `year`: credit any missing accruals, then move what's left into `year + 1` (capped at
 * carryForwardMax, with an expiry date) and lapse the rest. Idempotent per employee/type.
 */
export async function closeLeaveYear(companyId: string, year: number) {
  const nextYear = year + 1;
  await syncAccruals(companyId, year, new Date(Date.UTC(nextYear, 0, 1)));
  const types = await db.leaveType.findMany({ where: { companyId, accrualMethod: { not: "NONE" } } });
  const employees = await db.employee.findMany({
    where: { companyId, joinDate: { lte: yearBounds(year).to }, OR: [{ status: { not: "TERMINATED" } }, { lastWorkingDay: { gte: yearBounds(year).from } }] },
    select: leaveEmployeeSelect,
  });
  const { balances } = await computeBalances(companyId, employees, year);
  let closed = 0;
  for (const e of employees) {
    const stillEmployed = !e.lastWorkingDay || e.lastWorkingDay > yearBounds(year).to;
    for (const b of balances.get(e.id)!) {
      const type = types.find((t) => t.id === b.leaveType.id);
      if (!type) continue;
      const already = await db.leaveLedgerEntry.findFirst({ where: { employeeId: e.id, leaveTypeId: type.id, periodKey: `close-${year}` } });
      if (already) continue;
      const remaining = b.available;
      const { carry, lapse } = stillEmployed ? yearEndCarry(remaining, num(type.carryForwardMax)) : { carry: 0, lapse: Math.max(0, remaining) };
      const yearEnd = yearBounds(year).to;
      const nextStart = yearBounds(nextYear).from;
      await db.$transaction(async (tx) => {
        await tx.leaveLedgerEntry.create({
          data: { companyId, employeeId: e.id, leaveTypeId: type.id, year, kind: "CARRY_OUT", days: round2(-carry), effectiveDate: yearEnd, periodKey: `close-${year}`, reason: "Year-end close" },
        });
        if (lapse > 0) {
          await tx.leaveLedgerEntry.create({
            data: { companyId, employeeId: e.id, leaveTypeId: type.id, year, kind: "LAPSE", days: round2(-lapse), effectiveDate: yearEnd, periodKey: `lapse-${year}`, reason: "Unused days above the carry-forward limit" },
          });
        }
        if (carry !== 0) {
          await tx.leaveLedgerEntry.create({
            data: {
              companyId, employeeId: e.id, leaveTypeId: type.id, year: nextYear, kind: "CARRY_FORWARD", days: carry, effectiveDate: nextStart,
              periodKey: `cf-${nextYear}`, reason: `Carried forward from ${year}`,
              expiresOn: carry > 0 && type.carryForwardExpiryMonths ? addMonthsClamped(nextStart, type.carryForwardExpiryMonths) : null,
            },
          });
        }
      });
      closed++;
    }
  }
  return closed;
}

/** Lapse carried-forward days not used by their expiry date. Idempotent. */
export async function expireCarryForward(companyId: string, today: Date) {
  const due = await db.leaveLedgerEntry.findMany({
    where: { companyId, kind: "CARRY_FORWARD", expiresOn: { lte: today }, days: { gt: 0 } },
  });
  let expired = 0;
  for (const cf of due) {
    const key = `cfexp-${cf.year}`;
    if (await db.leaveLedgerEntry.findFirst({ where: { employeeId: cf.employeeId, leaveTypeId: cf.leaveTypeId, periodKey: key } })) continue;
    const taken = await db.$queryRaw<{ days: unknown }[]>`
      SELECT COALESCE(SUM(d.amount), 0) AS days FROM "LeaveRequestDay" d JOIN "LeaveRequest" r ON r.id = d."requestId"
      WHERE r."employeeId" = ${cf.employeeId} AND r."leaveTypeId" = ${cf.leaveTypeId}
        AND r.status IN ('APPROVED', 'CANCELLATION_REQUESTED')
        AND d.date >= ${yearBounds(cf.year).from} AND d.date < ${cf.expiresOn!}`;
    const amount = carryForwardExpiry(num(cf.days), num(taken[0]?.days));
    await db.leaveLedgerEntry.create({
      data: {
        companyId, employeeId: cf.employeeId, leaveTypeId: cf.leaveTypeId, year: cf.year, kind: "CARRY_FORWARD_EXPIRY",
        days: -amount, effectiveDate: cf.expiresOn!, periodKey: key, reason: "Carried-forward days expired unused",
      },
    });
    expired++;
  }
  return expired;
}
