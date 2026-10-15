/**
 * Framework-free permission helpers, so services can be used from Next, the worker and scripts alike.
 */
import { ForbiddenError } from "@/server/errors";
import type { PermissionKey } from "@/server/rbac/catalogue";

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  companyId: string;
  companyName: string;
  companyLogo: string | null;
  timezone: string;
  currency: string;
  workWeek: number[];
  employeeId: string | null;
  employeeName: string | null;
  photoPath: string | null;
  roles: { id: string; key: string; name: string }[];
  permissions: ReadonlySet<string>;
  mustChangePassword: boolean;
};

export function can(ctx: AuthContext, key: PermissionKey) {
  return ctx.permissions.has(key);
}

export function canAny(ctx: AuthContext, keys: PermissionKey[]) {
  return keys.some((k) => ctx.permissions.has(k));
}

/** Services / actions: throw a ForbiddenError (mapped to a friendly error by runAction). */
export function assertCan(ctx: AuthContext, key: PermissionKey | PermissionKey[]) {
  const keys = Array.isArray(key) ? key : [key];
  if (!keys.some((k) => ctx.permissions.has(k))) throw new ForbiddenError();
}
