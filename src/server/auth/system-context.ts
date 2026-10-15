import "server-only";
import { db } from "@/server/db";
import type { AuthContext } from "./permissions";

/**
 * Build the AuthContext of a given user without a session — for scripts (seed) and tests that must go
 * through the real, permission-checked services.
 */
export async function contextForUser(email: string): Promise<AuthContext> {
  const user = await db.user.findUniqueOrThrow({
    where: { email },
    include: { company: true, employee: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  const permissions = new Set<string>();
  for (const ur of user.roles) for (const rp of ur.role.permissions) permissions.add(rp.permission.key);
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    companyId: user.companyId,
    companyName: user.company.name,
    companyLogo: user.company.logoPath,
    timezone: user.company.timezone,
    currency: user.company.currency,
    workWeek: user.company.workWeek,
    employeeId: user.employee?.id ?? null,
    employeeName: user.employee ? `${user.employee.preferredName || user.employee.firstName} ${user.employee.lastName}` : user.name,
    photoPath: user.employee?.photoPath ?? null,
    roles: user.roles.map((r) => ({ id: r.role.id, key: r.role.key, name: r.role.name })),
    permissions,
    mustChangePassword: user.mustChangePassword,
  };
}
