import "server-only";
import { brand } from "@/theme/brand";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { getTeamEmployeeIds } from "@/server/rbac/scope";
import { ForbiddenError } from "@/server/errors";
import { toDateInput } from "@/lib/dates";
import { num, round2 } from "@/lib/leave/numbers";
import { displayName } from "./common";

export type CalendarScope = "mine" | "team" | "company";

export type CalendarCell = { requestId: string | null; label: string; color: string; status: "APPROVED" | "PENDING"; amount: number };

/**
 * Month grid data: one row per employee, cells keyed by "YYYY-MM-DD".
 * - mine: the user and their peers (same manager) — leave type hidden for others ("On leave")
 * - team: the manager's direct and indirect reports
 * - company: everyone (HR), optionally one department
 */
export async function leaveCalendar(ctx: AuthContext, input: { year: number; month: number; scope: CalendarScope; departmentId?: string }) {
  const from = new Date(Date.UTC(input.year, input.month, 1));
  const to = new Date(Date.UTC(input.year, input.month + 1, 0));
  let employeeWhere: Prisma.EmployeeWhereInput;
  let showTypes: (employeeId: string) => boolean = () => true;

  if (input.scope === "company") {
    assertCan(ctx, "leave.request.read.all");
    employeeWhere = { ...(input.departmentId && { departmentId: input.departmentId }) };
  } else if (input.scope === "team") {
    if (!ctx.employeeId || (!ctx.permissions.has("leave.approve.team") && !ctx.permissions.has("leave.request.read.all"))) throw new ForbiddenError();
    employeeWhere = { id: { in: await getTeamEmployeeIds(ctx.companyId, ctx.employeeId) } };
  } else {
    if (!ctx.employeeId) throw new ForbiddenError();
    const me = await db.employee.findUniqueOrThrow({ where: { id: ctx.employeeId }, select: { managerId: true } });
    employeeWhere = me.managerId ? { OR: [{ managerId: me.managerId }, { id: ctx.employeeId }] } : { id: ctx.employeeId };
    showTypes = (id) => id === ctx.employeeId;
  }

  const [employees, days, holidays] = await Promise.all([
    db.employee.findMany({
      where: { companyId: ctx.companyId, ...employeeWhere, joinDate: { lte: to }, OR: [{ status: { not: "TERMINATED" } }, { lastWorkingDay: { gte: from } }] },
      select: { id: true, firstName: true, lastName: true, preferredName: true, photoPath: true, department: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.leaveRequestDay.findMany({
      where: {
        date: { gte: from, lte: to },
        request: { companyId: ctx.companyId, status: { in: ["APPROVED", "PENDING", "CANCELLATION_REQUESTED"] }, employee: employeeWhere },
      },
      select: { date: true, amount: true, request: { select: { id: true, employeeId: true, status: true, leaveType: { select: { name: true, color: true } } } } },
    }),
    db.publicHoliday.findMany({ where: { companyId: ctx.companyId, date: { gte: from, lte: to } }, select: { date: true, name: true, locationId: true } }),
  ]);

  const cells = new Map<string, Record<string, CalendarCell>>();
  for (const d of days) {
    const own = showTypes(d.request.employeeId);
    const row = cells.get(d.request.employeeId) ?? {};
    row[toDateInput(d.date)] = {
      requestId: own || input.scope !== "mine" ? d.request.id : null,
      label: own ? d.request.leaveType.name : "On leave",
      color: own ? d.request.leaveType.color : brand.neutralLeaveColor,
      status: d.request.status === "PENDING" ? "PENDING" : "APPROVED",
      amount: num(d.amount),
    };
    cells.set(d.request.employeeId, row);
  }
  const rows = employees.map((e) => {
    const c = cells.get(e.id) ?? {};
    return {
      id: e.id,
      name: displayName(e),
      department: e.department?.name ?? null,
      hasPhoto: !!e.photoPath,
      cells: c,
      total: round2(Object.values(c).reduce((a, x) => a + (x.status === "APPROVED" ? x.amount : 0), 0)),
    };
  });
  return {
    from,
    to,
    workWeek: ctx.workWeek,
    holidays: holidays.filter((h) => !h.locationId).map((h) => ({ date: toDateInput(h.date), name: h.name })),
    rows,
  };
}
