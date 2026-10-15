import "server-only";
import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { auth } from "./index";
import { db } from "@/server/db";
import { env } from "@/server/env";
import type { PermissionKey } from "@/server/rbac/catalogue";
import type { AuthContext } from "./permissions";
import { isEmploymentEnded } from "./status";

export type { AuthContext } from "./permissions";
export { can, canAny, assertCan } from "./permissions";

/**
 * Resolve the current user from the session cookie and the database. Memoised per request.
 * Returns null when the session is missing, revoked (sessionVersion bump), expired (absolute
 * timeout), or the user is deactivated / past their last working day.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      company: true,
      employee: { select: { id: true, firstName: true, lastName: true, preferredName: true, photoPath: true, status: true, lastWorkingDay: true } },
      roles: { include: { role: { include: { permissions: { include: { permission: { select: { key: true } } } } } } } },
    },
  });
  if (!user || !user.isActive) return null;
  if (session.sessionVersion !== user.sessionVersion) return null;
  if (session.authTime && Date.now() / 1000 - session.authTime > env.SESSION_ABSOLUTE_HOURS * 3600) return null;
  if (isEmploymentEnded(user.employee, user.company.timezone)) return null;

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
    employeeName: user.employee ? `${user.employee.preferredName || user.employee.firstName} ${user.employee.lastName}` : null,
    photoPath: user.employee?.photoPath ?? null,
    roles: user.roles.map((r) => ({ id: r.role.id, key: r.role.key, name: r.role.name })),
    permissions,
    mustChangePassword: user.mustChangePassword,
  };
});

/** For pages and actions: redirect to login when unauthenticated, to the forced password change when required. */
export async function requireAuth(opts: { allowPendingPasswordChange?: boolean } = {}): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login?expired=1");
  if (ctx.mustChangePassword && !opts.allowPendingPasswordChange) redirect("/change-password");
  return ctx;
}




/** Pages: render the 403 page. */
export function requirePermission(ctx: AuthContext, key: PermissionKey | PermissionKey[]) {
  const keys = Array.isArray(key) ? key : [key];
  if (!keys.some((k) => ctx.permissions.has(k))) forbidden();
}
