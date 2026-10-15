/**
 * Upsert the permission catalogue into the DB. Safe to run on every deploy (`npm run db:sync-permissions`).
 *
 * - SUPER_ADMIN roles always hold every permission.
 * - A permission that is new to the database is also granted to the system roles whose defaults include
 *   it, so upgrades (e.g. Phase 2 leave permissions) work on existing data without overriding later edits.
 * - Company bootstrap data that later phases need (e.g. default leave types) is created if missing.
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLES, PERMISSIONS, type SystemRoleKey } from "../src/server/rbac/catalogue";
import { ensureDefaultLeaveTypes } from "./leave-defaults";
import { ensureDefaultPayComponents } from "./payroll-defaults";
import { syncAccruals } from "../src/server/services/leave/balance.service";

export async function syncPermissions(db: PrismaClient) {
  const existing = new Set((await db.permission.findMany({ select: { key: true } })).map((p) => p.key));
  const added: string[] = [];
  for (const p of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, module: p.module, description: p.description },
      update: { module: p.module, description: p.description },
    });
    if (!existing.has(p.key)) added.push(p.key);
  }
  const all = await db.permission.findMany({ select: { id: true, key: true } });
  const idOf = new Map(all.map((p) => [p.key, p.id]));

  const systemRoles = await db.role.findMany({ where: { isSystem: true }, select: { id: true, key: true } });
  for (const role of systemRoles) {
    const keys =
      role.key === "SUPER_ADMIN"
        ? all.map((p) => p.key)
        : existing.size === 0
          ? []
          : added.filter((k) => (DEFAULT_ROLES[role.key as SystemRoleKey]?.permissions as string[] | undefined)?.includes(k));
    if (keys.length) {
      await db.rolePermission.createMany({ data: keys.map((k) => ({ roleId: role.id, permissionId: idOf.get(k)! })), skipDuplicates: true });
    }
  }
  return added;
}

/** Idempotent per-company bootstrap for upgrades: default leave types, pay components and this year's accruals. */
export async function bootstrapCompanies(db: PrismaClient) {
  const companies = await db.company.findMany({ select: { id: true, timezone: true } });
  for (const c of companies) {
    await ensureDefaultLeaveTypes(db, c.id);
    await ensureDefaultPayComponents(db, c.id);
    const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: c.timezone }).format(new Date()) + "T00:00:00Z");
    await syncAccruals(c.id, today.getUTCFullYear(), today);
  }
}

if (process.argv[1]?.endsWith("sync-permissions.ts")) {
  const db = new PrismaClient();
  syncPermissions(db)
    .then(async (added) => {
      await bootstrapCompanies(db);
      console.log(`Synced ${PERMISSIONS.length} permissions${added.length ? ` (new: ${added.join(", ")})` : ""}.`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
