import "server-only";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { writeAudit, diffSnapshots } from "@/server/audit";
import { NotFoundError, ValidationError } from "@/server/errors";
import { serverT } from "@/server/i18n";
import { ALL_PERMISSION_KEYS, PERMISSIONS, SYSTEM_ROLES } from "@/server/rbac/catalogue";
import { paginated, type ListParams } from "@/lib/list-params";
import { parseDateOnly, addDays } from "@/lib/dates";
import { toKey } from "@/lib/utils";
import type { companySettingsSchema, roleSchema } from "@/lib/validation/admin";

// ───────────────────────────── Roles ─────────────────────────────

export async function listRoles(ctx: AuthContext) {
  assertCan(ctx, ["role.manage", "user.manage"]);
  const roles = await db.role.findMany({
    where: { companyId: ctx.companyId },
    include: { permissions: { include: { permission: { select: { key: true } } } }, _count: { select: { users: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    locked: r.key === SYSTEM_ROLES.SUPER_ADMIN,
    userCount: r._count.users,
    permissions: r.permissions.map((p) => p.permission.key),
  }));
}

export function permissionCatalogue() {
  return PERMISSIONS;
}

export async function upsertRole(ctx: AuthContext, input: z.infer<typeof roleSchema>) {
  assertCan(ctx, "role.manage");
  const t = await serverT("admin");
  const unknown = input.permissions.filter((p) => !(ALL_PERMISSION_KEYS as string[]).includes(p));
  if (unknown.length) throw new ValidationError(t("errors.unknownPermissions", { list: unknown.join(", ") }));
  return db.$transaction(async (tx) => {
    const nameTaken = await tx.role.findFirst({ where: { companyId: ctx.companyId, name: { equals: input.name, mode: "insensitive" }, ...(input.id && { id: { not: input.id } }) } });
    if (nameTaken) throw new ValidationError(t("errors.roleNameUsed"), { name: [t("errors.roleNameTaken")] });
    const perms = await tx.permission.findMany({ where: { key: { in: input.permissions } } });

    if (input.id) {
      const before = await tx.role.findFirst({ where: { id: input.id, companyId: ctx.companyId }, include: { permissions: { include: { permission: true } } } });
      if (!before) throw new NotFoundError(t("errors.roleNotFound"));
      if (before.key === SYSTEM_ROLES.SUPER_ADMIN) throw new ValidationError(t("errors.superAdminLocked"));
      await tx.role.update({ where: { id: before.id }, data: { name: input.name, description: input.description } });
      await tx.rolePermission.deleteMany({ where: { roleId: before.id } });
      if (perms.length) await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId: before.id, permissionId: p.id })) });
      const beforeSnap = { name: before.name, description: before.description, permissions: before.permissions.map((p) => p.permission.key).sort() };
      const afterSnap = { name: input.name, description: input.description, permissions: [...input.permissions].sort() };
      const diff = diffSnapshots(beforeSnap, afterSnap);
      if (diff.keys.length) await writeAudit(ctx, { action: "role.update", entityType: "Role", entityId: before.id, summary: `Updated role ${input.name}`, before: diff.before, after: diff.after }, tx);
      return before.id;
    }

    let key = `CUSTOM_${toKey(input.name)}`.slice(0, 50);
    if (await tx.role.findUnique({ where: { companyId_key: { companyId: ctx.companyId, key } } })) key = `${key}_${Date.now().toString(36)}`;
    const role = await tx.role.create({
      data: {
        companyId: ctx.companyId,
        key,
        name: input.name,
        description: input.description,
        permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
      },
    });
    await writeAudit(ctx, { action: "role.create", entityType: "Role", entityId: role.id, summary: `Created role ${role.name}`, after: { name: role.name, permissions: input.permissions } }, tx);
    return role.id;
  });
}

export async function deleteRole(ctx: AuthContext, roleId: string) {
  assertCan(ctx, "role.manage");
  const t = await serverT("admin");
  return db.$transaction(async (tx) => {
    const role = await tx.role.findFirst({ where: { id: roleId, companyId: ctx.companyId }, include: { _count: { select: { users: true } } } });
    if (!role) throw new NotFoundError(t("errors.roleNotFound"));
    if (role.isSystem) throw new ValidationError(t("errors.systemRoleDelete"));
    if (role._count.users) throw new ValidationError(t("errors.roleInUse"));
    await tx.role.delete({ where: { id: roleId } });
    await writeAudit(ctx, { action: "role.delete", entityType: "Role", entityId: roleId, summary: `Deleted role ${role.name}`, before: { name: role.name } }, tx);
  });
}

// ───────────────────────────── Company settings ─────────────────────────────

export async function getCompany(ctx: AuthContext) {
  const company = await db.company.findUnique({ where: { id: ctx.companyId } });
  if (!company) throw new NotFoundError((await serverT("admin"))("errors.companyNotFound"));
  return company;
}

export async function updateCompanySettings(ctx: AuthContext, input: z.infer<typeof companySettingsSchema>) {
  assertCan(ctx, "company.settings.manage");
  return db.$transaction(async (tx) => {
    const before = await tx.company.findUniqueOrThrow({ where: { id: ctx.companyId } });
    const after = await tx.company.update({ where: { id: ctx.companyId }, data: { ...input, workWeek: [...new Set(input.workWeek)].sort() } });
    const diff = diffSnapshots(before, after);
    if (diff.keys.length) await writeAudit(ctx, { action: "company.update", entityType: "Company", entityId: ctx.companyId, summary: `Updated ${diff.keys.join(", ")}`, before: diff.before, after: diff.after }, tx);
    return after;
  });
}

export async function setCompanyLogo(ctx: AuthContext, logoPath: string | null) {
  assertCan(ctx, "company.settings.manage");
  return db.$transaction(async (tx) => {
    const before = await tx.company.findUniqueOrThrow({ where: { id: ctx.companyId }, select: { logoPath: true } });
    await tx.company.update({ where: { id: ctx.companyId }, data: { logoPath } });
    await writeAudit(ctx, { action: "company.logo", entityType: "Company", entityId: ctx.companyId, before, after: { logoPath } }, tx);
    return before.logoPath;
  });
}

// ───────────────────────────── Audit log ─────────────────────────────

export type AuditFilters = { actorUserId?: string; entityType?: string; action?: string; entityId?: string; from?: string; to?: string };

export async function listAuditLogs(ctx: AuthContext, params: ListParams<"createdAt">, filters: AuditFilters) {
  assertCan(ctx, "audit.read");
  const from = parseDateOnly(filters.from);
  const to = parseDateOnly(filters.to);
  const where: Prisma.AuditLogWhereInput = {
    companyId: ctx.companyId,
    ...(filters.actorUserId && { actorUserId: filters.actorUserId }),
    ...(filters.entityType && { entityType: filters.entityType }),
    ...(filters.entityId && { entityId: filters.entityId }),
    ...(filters.action && { action: { startsWith: filters.action } }),
    ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lt: addDays(to, 1) }) } }),
    ...(params.q && { OR: [{ summary: { contains: params.q, mode: "insensitive" } }, { action: { contains: params.q, mode: "insensitive" } }, { entityId: params.q }] }),
  };
  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: params.dir },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return paginated(items, total, params.page, params.pageSize);
}

export async function auditFilterOptions(ctx: AuthContext) {
  assertCan(ctx, "audit.read");
  const [entityTypes, actors] = await Promise.all([
    db.auditLog.findMany({ where: { companyId: ctx.companyId }, distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    db.user.findMany({ where: { companyId: ctx.companyId, auditLogs: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { entityTypes: entityTypes.map((e) => e.entityType), actors: actors.map((a) => ({ value: a.id, label: a.name })) };
}
