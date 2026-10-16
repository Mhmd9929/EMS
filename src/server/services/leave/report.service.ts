import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { num, round2 } from "@/lib/leave/numbers";
import { serverT } from "@/server/i18n";

export type LeaveReportRow = { department: string; leaveType: string; color: string; isPaid: boolean; days: number; people: number; requests: number };

/** Approved leave days taken in [from, to] grouped by department and type (days split exactly at the range edges). */
export async function leaveTakenReport(ctx: AuthContext, input: { from: Date; to: Date; departmentId?: string; leaveTypeId?: string }) {
  assertCan(ctx, "leave.report.read");
  const rows = await db.$queryRaw<{ department: string | null; leaveType: string; color: string; isPaid: boolean; days: Prisma.Decimal; people: bigint; requests: bigint }[]>`
    SELECT dep.name AS department, lt.name AS "leaveType", lt.color, lt."isPaid",
           SUM(d.amount) AS days, COUNT(DISTINCT r."employeeId") AS people, COUNT(DISTINCT r.id) AS requests
    FROM "LeaveRequestDay" d
    JOIN "LeaveRequest" r ON r.id = d."requestId"
    JOIN "LeaveType" lt ON lt.id = r."leaveTypeId"
    JOIN "Employee" e ON e.id = r."employeeId"
    LEFT JOIN "Department" dep ON dep.id = e."departmentId"
    WHERE r."companyId" = ${ctx.companyId}
      AND r.status IN ('APPROVED', 'CANCELLATION_REQUESTED')
      AND d.date >= ${input.from} AND d.date <= ${input.to}
      ${input.departmentId ? Prisma.sql`AND e."departmentId" = ${input.departmentId}` : Prisma.empty}
      ${input.leaveTypeId ? Prisma.sql`AND r."leaveTypeId" = ${input.leaveTypeId}` : Prisma.empty}
    GROUP BY dep.name, lt.name, lt.color, lt."isPaid", lt."sortOrder"
    ORDER BY dep.name NULLS LAST, lt."sortOrder"`;
  const unassigned = (await serverT("leave"))("reports.unassigned");
  const data: LeaveReportRow[] = rows.map((r) => ({
    department: r.department ?? unassigned,
    leaveType: r.leaveType,
    color: r.color,
    isPaid: r.isPaid,
    days: round2(num(r.days)),
    people: Number(r.people),
    requests: Number(r.requests),
  }));
  const types = [...new Map(data.map((r) => [r.leaveType, { name: r.leaveType, color: r.color }])).values()];
  const departments = [...new Set(data.map((r) => r.department))];
  const totalsByType = Object.fromEntries(types.map((t) => [t.name, round2(data.filter((r) => r.leaveType === t.name).reduce((a, r) => a + r.days, 0))]));
  const totalsByDept = Object.fromEntries(departments.map((d) => [d, round2(data.filter((r) => r.department === d).reduce((a, r) => a + r.days, 0))]));
  return { rows: data, types, departments, totalsByType, totalsByDept, grandTotal: round2(data.reduce((a, r) => a + r.days, 0)) };
}

/** One row per request (clipped to the range) for detailed exports. */
export async function leaveTakenDetail(ctx: AuthContext, input: { from: Date; to: Date; departmentId?: string; leaveTypeId?: string }) {
  assertCan(ctx, "leave.report.read");
  const rows = await db.$queryRaw<{ employeeNumber: string; name: string; department: string | null; leaveType: string; isPaid: boolean; startDate: Date; endDate: Date; days: Prisma.Decimal; status: string }[]>`
    SELECT e."employeeNumber", e."firstName" || ' ' || e."lastName" AS name, dep.name AS department, lt.name AS "leaveType", lt."isPaid",
           MIN(d.date) AS "startDate", MAX(d.date) AS "endDate", SUM(d.amount) AS days, r.status::text AS status
    FROM "LeaveRequestDay" d
    JOIN "LeaveRequest" r ON r.id = d."requestId"
    JOIN "LeaveType" lt ON lt.id = r."leaveTypeId"
    JOIN "Employee" e ON e.id = r."employeeId"
    LEFT JOIN "Department" dep ON dep.id = e."departmentId"
    WHERE r."companyId" = ${ctx.companyId}
      AND r.status IN ('APPROVED', 'CANCELLATION_REQUESTED')
      AND d.date >= ${input.from} AND d.date <= ${input.to}
      ${input.departmentId ? Prisma.sql`AND e."departmentId" = ${input.departmentId}` : Prisma.empty}
      ${input.leaveTypeId ? Prisma.sql`AND r."leaveTypeId" = ${input.leaveTypeId}` : Prisma.empty}
    GROUP BY r.id, e."employeeNumber", e."firstName", e."lastName", dep.name, lt.name, lt."isPaid", r.status
    ORDER BY MIN(d.date), e."employeeNumber"`;
  return rows.map((r) => ({ ...r, days: round2(num(r.days)) }));
}

/**
 * Approved unpaid leave days per employee in a pay period — consumed by payroll (Phase 3).
 */
export async function unpaidLeaveDays(companyId: string, from: Date, to: Date, employeeIds?: string[]) {
  const rows = await db.$queryRaw<{ employeeId: string; days: Prisma.Decimal }[]>`
    SELECT r."employeeId", SUM(d.amount) AS days
    FROM "LeaveRequestDay" d
    JOIN "LeaveRequest" r ON r.id = d."requestId"
    JOIN "LeaveType" lt ON lt.id = r."leaveTypeId"
    WHERE r."companyId" = ${companyId} AND lt."isPaid" = false
      AND r.status IN ('APPROVED', 'CANCELLATION_REQUESTED')
      AND d.date >= ${from} AND d.date <= ${to}
      ${employeeIds ? Prisma.sql`AND r."employeeId" IN (${Prisma.join(employeeIds.length ? employeeIds : ["-"])})` : Prisma.empty}
    GROUP BY r."employeeId"`;
  return new Map(rows.map((r) => [r.employeeId, round2(num(r.days))]));
}
