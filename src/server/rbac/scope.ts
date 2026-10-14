import "server-only";
import { db } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";

/** All direct and indirect reports of a manager (recursive CTE; UNION guards against cycles). */
export async function getTeamEmployeeIds(companyId: string, managerEmployeeId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE team AS (
      SELECT id FROM "Employee" WHERE "managerId" = ${managerEmployeeId} AND "companyId" = ${companyId}
      UNION
      SELECT e.id FROM "Employee" e JOIN team t ON e."managerId" = t.id WHERE e."companyId" = ${companyId}
    )
    SELECT id FROM team`;
  return rows.map((r) => r.id);
}

export type EmployeeAccess = "all" | "team" | "self" | "none";

/** How the current user relates to a given employee record. */
export async function getEmployeeAccess(ctx: AuthContext, employeeId: string): Promise<EmployeeAccess> {
  if (ctx.permissions.has("employee.read.all")) return "all";
  if (ctx.employeeId === employeeId) return "self";
  if (ctx.permissions.has("employee.read.team") && ctx.employeeId) {
    const team = await getTeamEmployeeIds(ctx.companyId, ctx.employeeId);
    if (team.includes(employeeId)) return "team";
  }
  return "none";
}

/**
 * The set of employee ids the user may list, or "all". Used to scope list queries.
 * Returns an empty array when the user can see nobody but themselves.
 */
export async function getVisibleEmployeeScope(ctx: AuthContext): Promise<"all" | string[]> {
  if (ctx.permissions.has("employee.read.all")) return "all";
  if (ctx.permissions.has("employee.read.team") && ctx.employeeId) {
    return getTeamEmployeeIds(ctx.companyId, ctx.employeeId);
  }
  return [];
}
