/**
 * Upsert the permission catalogue into the DB and make sure every SUPER_ADMIN role holds every
 * permission. Safe to run on every deploy (`npm run db:sync-permissions`).
 */
import { PrismaClient } from "@prisma/client";
import { PERMISSIONS } from "../src/server/rbac/catalogue";

export async function syncPermissions(db: PrismaClient) {
  for (const p of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, module: p.module, description: p.description },
      update: { module: p.module, description: p.description },
    });
  }
  const all = await db.permission.findMany({ select: { id: true } });
  const superRoles = await db.role.findMany({ where: { key: "SUPER_ADMIN" }, select: { id: true } });
  for (const role of superRoles) {
    await db.rolePermission.createMany({ data: all.map((p) => ({ roleId: role.id, permissionId: p.id })), skipDuplicates: true });
  }
}

if (process.argv[1]?.endsWith("sync-permissions.ts")) {
  const db = new PrismaClient();
  syncPermissions(db)
    .then(() => console.log(`Synced ${PERMISSIONS.length} permissions.`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
