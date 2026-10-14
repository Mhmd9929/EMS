import { db } from "@/server/db";
import type { AuthContext } from "@/server/auth/context";

/** Build the same AuthContext getAuthContext() would, without a session cookie. */
export async function contextFor(email: string): Promise<AuthContext> {
  const user = await db.user.findUniqueOrThrow({
    where: { email },
    include: {
      company: true,
      employee: true,
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });
  const permissions = new Set<string>();
  for (const ur of user.roles) for (const rp of ur.role.permissions) permissions.add(rp.permission.key);
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    companyId: user.companyId,
    companyName: user.company.name,
    companyLogo: null,
    timezone: user.company.timezone,
    currency: user.company.currency,
    workWeek: user.company.workWeek,
    employeeId: user.employee?.id ?? null,
    employeeName: user.name,
    photoPath: null,
    roles: user.roles.map((r) => ({ id: r.role.id, key: r.role.key, name: r.role.name })),
    permissions,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function employeeIdByEmail(email: string) {
  return (await db.employee.findFirstOrThrow({ where: { workEmail: email }, select: { id: true } })).id;
}

export const DOMAIN = "falcongulf.ae";
