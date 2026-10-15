import "server-only";
import { Prisma, type LeaveType } from "@prisma/client";
import type { DbClient } from "@/server/db";
import { toDateInput } from "@/lib/dates";
import { num } from "@/lib/leave/numbers";
import type { AccrualRule } from "@/lib/leave/accrual";
import type { LeaveTypeRules, PolicyLike } from "@/lib/leave/policy";

/** Statuses whose days count against a balance (taken or pending). */
export const BOOKED_STATUSES = ["PENDING", "APPROVED", "CANCELLATION_REQUESTED"] as const;
export const TAKEN_STATUSES = ["APPROVED", "CANCELLATION_REQUESTED"] as const;

export const leaveEmployeeSelect = {
  id: true,
  companyId: true,
  userId: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  gender: true,
  joinDate: true,
  lastWorkingDay: true,
  status: true,
  employmentType: true,
  departmentId: true,
  positionId: true,
  locationId: true,
  managerId: true,
  manager: { select: { id: true, userId: true, firstName: true, lastName: true, preferredName: true, user: { select: { isActive: true } } } },
} satisfies Prisma.EmployeeSelect;

export type LeaveEmployee = Prisma.EmployeeGetPayload<{ select: typeof leaveEmployeeSelect }>;

export const displayName = (e: { firstName: string; lastName: string; preferredName?: string | null }) => `${e.preferredName || e.firstName} ${e.lastName}`;

export function accrualRule(type: LeaveType, entitlement: number): AccrualRule {
  return {
    accrualMethod: type.accrualMethod,
    annualEntitlement: entitlement,
    accrualStartAfterMonths: type.accrualStartAfterMonths,
    prorateUpfront: type.prorateUpfront,
  };
}

export function typeRules(type: LeaveType): LeaveTypeRules {
  return {
    id: type.id,
    annualEntitlement: num(type.annualEntitlement),
    genderEligibility: type.genderEligibility,
    accrualStartAfterMonths: type.accrualStartAfterMonths,
    accrualMethod: type.accrualMethod,
  };
}

export async function loadPolicies(client: DbClient, companyId: string): Promise<PolicyLike[]> {
  const rows = await client.leavePolicy.findMany({ where: { companyId, isActive: true } });
  return rows.map((p) => ({ ...p, annualEntitlement: p.annualEntitlement === null ? null : num(p.annualEntitlement) }));
}

/** Public holidays ("YYYY-MM-DD") that apply to an employee's location between two dates. */
export async function holidaySet(client: DbClient, companyId: string, locationId: string | null, from: Date, to: Date) {
  const rows = await client.publicHoliday.findMany({
    where: { companyId, date: { gte: from, lte: to }, OR: [{ locationId: null }, ...(locationId ? [{ locationId }] : [])] },
    select: { date: true },
  });
  return new Set(rows.map((r) => toDateInput(r.date)));
}

export const yearBounds = (year: number) => ({ from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year, 11, 31)) });

/** Sum of booked request days per employee/type/bucket in a date window (cross-year requests split by day). */
export async function requestDayTotals(client: DbClient, companyId: string, employeeIds: string[] | null, from: Date, to: Date) {
  const rows = await client.$queryRaw<{ employeeId: string; leaveTypeId: string; bucket: "taken" | "pending"; days: Prisma.Decimal }[]>`
    SELECT r."employeeId", r."leaveTypeId",
           CASE WHEN r.status = 'PENDING' THEN 'pending' ELSE 'taken' END AS bucket,
           SUM(d.amount) AS days
    FROM "LeaveRequestDay" d
    JOIN "LeaveRequest" r ON r.id = d."requestId"
    WHERE r."companyId" = ${companyId}
      AND r.status IN ('PENDING', 'APPROVED', 'CANCELLATION_REQUESTED')
      AND d.date >= ${from} AND d.date <= ${to}
      ${employeeIds ? Prisma.sql`AND r."employeeId" IN (${Prisma.join(employeeIds.length ? employeeIds : ["-"])})` : Prisma.empty}
    GROUP BY 1, 2, 3`;
  const map = new Map<string, { taken: number; pending: number }>();
  for (const r of rows) {
    const key = `${r.employeeId}:${r.leaveTypeId}`;
    const cur = map.get(key) ?? { taken: 0, pending: 0 };
    cur[r.bucket] += num(r.days);
    map.set(key, cur);
  }
  return map;
}
