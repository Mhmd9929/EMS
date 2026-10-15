import "server-only";
import { db } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";
import { addDays, todayInTimeZone } from "@/lib/dates";
import { getTeamEmployeeIds } from "@/server/rbac/scope";

export type ExpiringDocument = {
  employeeId: string;
  name: string;
  document: "Emirates ID" | "Passport" | "Visa" | "Labour card";
  expiry: Date;
};

export async function getHrDashboard(ctx: AuthContext) {
  const today = todayInTimeZone(ctx.timezone);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const in30 = addDays(today, 30);
  const in60 = addDays(today, 60);
  const companyId = ctx.companyId;
  const notTerminated = { status: { not: "TERMINATED" as const } };

  const [headcount, onLeave, joiners, leavers, pendingInvites, probationEnding, scheduledTerminations, byDepartment, byType, expiringRaw] = await Promise.all([
    db.employee.count({ where: { companyId, ...notTerminated } }),
    db.employee.count({ where: { companyId, status: "ON_LEAVE" } }),
    db.employee.findMany({
      where: { companyId, joinDate: { gte: monthStart, lt: nextMonthStart } },
      select: { id: true, firstName: true, lastName: true, preferredName: true, joinDate: true, position: { select: { title: true } } },
      orderBy: { joinDate: "asc" },
    }),
    db.employee.findMany({
      where: { companyId, lastWorkingDay: { gte: monthStart, lt: nextMonthStart } },
      select: { id: true, firstName: true, lastName: true, preferredName: true, lastWorkingDay: true, terminationReason: true },
      orderBy: { lastWorkingDay: "asc" },
    }),
    db.user.count({ where: { companyId, isActive: true, passwordHash: null } }),
    db.employee.findMany({
      where: { companyId, ...notTerminated, probationEndDate: { gte: today, lte: in30 } },
      select: { id: true, firstName: true, lastName: true, preferredName: true, probationEndDate: true },
      orderBy: { probationEndDate: "asc" },
      take: 10,
    }),
    db.employee.count({ where: { companyId, ...notTerminated, lastWorkingDay: { gte: today } } }),
    db.employee.groupBy({ by: ["departmentId"], where: { companyId, ...notTerminated }, _count: true }),
    db.employee.groupBy({ by: ["employmentType"], where: { companyId, ...notTerminated }, _count: true }),
    db.employee.findMany({
      where: {
        companyId,
        ...notTerminated,
        OR: [
          { emiratesIdExpiry: { lte: in60 } },
          { passportExpiry: { lte: in60 } },
          { visaExpiry: { lte: in60 } },
          { labourCardExpiry: { lte: in60 } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, preferredName: true, emiratesIdExpiry: true, passportExpiry: true, visaExpiry: true, labourCardExpiry: true },
    }),
  ]);

  const departments = await db.department.findMany({ where: { companyId }, select: { id: true, name: true } });
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const headcountByDepartment = byDepartment
    .map((g) => ({ name: g.departmentId ? (deptName.get(g.departmentId) ?? "Unknown") : "Unassigned", count: g._count }))
    .sort((a, b) => b.count - a.count);

  const expiring: ExpiringDocument[] = [];
  for (const e of expiringRaw) {
    const name = `${e.preferredName || e.firstName} ${e.lastName}`;
    const docs: [ExpiringDocument["document"], Date | null][] = [
      ["Emirates ID", e.emiratesIdExpiry],
      ["Passport", e.passportExpiry],
      ["Visa", e.visaExpiry],
      ["Labour card", e.labourCardExpiry],
    ];
    for (const [document, expiry] of docs) if (expiry && expiry <= in60) expiring.push({ employeeId: e.id, name, document, expiry });
  }
  expiring.sort((a, b) => a.expiry.getTime() - b.expiry.getTime());

  return {
    headcount,
    onLeave,
    joiners,
    leavers,
    pendingInvites,
    probationEnding,
    scheduledTerminations,
    headcountByDepartment,
    headcountByType: byType.map((g) => ({ type: g.employmentType, count: g._count })),
    expiring: expiring.slice(0, 15),
    expiringTotal: expiring.length,
    today,
  };
}

export async function getManagerDashboard(ctx: AuthContext) {
  if (!ctx.employeeId) return null;
  const [direct, allIds] = await Promise.all([
    db.employee.findMany({
      where: { companyId: ctx.companyId, managerId: ctx.employeeId, status: { not: "TERMINATED" } },
      select: { id: true, firstName: true, lastName: true, preferredName: true, status: true, photoPath: true, position: { select: { title: true } } },
      orderBy: { firstName: "asc" },
    }),
    getTeamEmployeeIds(ctx.companyId, ctx.employeeId),
  ]);
  const today = todayInTimeZone(ctx.timezone);
  const probation = await db.employee.findMany({
    where: { id: { in: allIds }, status: { not: "TERMINATED" }, probationEndDate: { gte: today, lte: addDays(today, 30) } },
    select: { id: true, firstName: true, lastName: true, preferredName: true, probationEndDate: true },
  });
  const totalTeam = await db.employee.count({ where: { id: { in: allIds }, status: { not: "TERMINATED" } } });
  return { direct, totalTeam, onLeave: direct.filter((d) => d.status === "ON_LEAVE").length, probation };
}

export async function getEmployeeDashboard(ctx: AuthContext) {
  const today = todayInTimeZone(ctx.timezone);
  const employee = ctx.employeeId
    ? await db.employee.findUnique({
        where: { id: ctx.employeeId },
        select: {
          id: true,
          joinDate: true,
          probationEndDate: true,
          locationId: true,
          position: { select: { title: true } },
          department: { select: { name: true } },
          manager: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
          emiratesIdExpiry: true,
          passportExpiry: true,
          visaExpiry: true,
        },
      })
    : null;
  const holidays = await db.publicHoliday.findMany({
    where: {
      companyId: ctx.companyId,
      date: { gte: today },
      OR: [{ locationId: null }, ...(employee?.locationId ? [{ locationId: employee.locationId }] : [])],
    },
    orderBy: { date: "asc" },
    take: 5,
  });
  return { employee, holidays, today };
}

export async function getRecentActivity(ctx: AuthContext, take = 8) {
  return db.auditLog.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { name: true } } },
  });
}
