import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/context";
import { writeAudit, diffSnapshots } from "@/server/audit";
import { NotFoundError, ValidationError } from "@/server/errors";
import { createsDepartmentCycle } from "@/server/hierarchy";
import { buildTree } from "@/lib/tree";
import { paginated, type ListParams } from "@/lib/list-params";
import type { z } from "zod";
import type { departmentSchema, locationSchema, positionSchema } from "@/lib/validation/org";

// ───────────────────────────── Departments ─────────────────────────────

export const DEPARTMENT_SORTS = ["name", "code", "headcount"] as const;

export async function listDepartmentsTree(ctx: AuthContext) {
  assertCan(ctx, "org.manage");
  const rows = await db.department.findMany({
    where: { companyId: ctx.companyId },
    include: {
      head: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
      _count: { select: { employees: { where: { status: { not: "TERMINATED" } } } } },
    },
    orderBy: { name: "asc" },
  });
  return buildTree(rows, (d) => d.parentId);
}

export async function listDepartments(ctx: AuthContext, params: ListParams<(typeof DEPARTMENT_SORTS)[number]>, filters: { active?: boolean }) {
  assertCan(ctx, "org.manage");
  const where: Prisma.DepartmentWhereInput = {
    companyId: ctx.companyId,
    ...(filters.active !== undefined && { isActive: filters.active }),
    ...(params.q && {
      OR: [
        { name: { contains: params.q, mode: "insensitive" } },
        { code: { contains: params.q, mode: "insensitive" } },
        { costCenterCode: { contains: params.q, mode: "insensitive" } },
      ],
    }),
  };
  const orderBy: Prisma.DepartmentOrderByWithRelationInput =
    params.sort === "code" ? { code: params.dir } : params.sort === "headcount" ? { employees: { _count: params.dir } } : { name: params.dir };
  const [items, total] = await Promise.all([
    db.department.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        parent: { select: { id: true, name: true } },
        head: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        _count: { select: { employees: { where: { status: { not: "TERMINATED" } } }, children: true } },
      },
    }),
    db.department.count({ where }),
  ]);
  return paginated(items, total, params.page, params.pageSize);
}

export async function listDepartmentOptions(ctx: AuthContext) {
  const rows = await db.department.findMany({
    where: { companyId: ctx.companyId },
    select: { id: true, name: true, parentId: true, isActive: true },
    orderBy: { name: "asc" },
  });
  // Indent by depth so the hierarchy is visible in a flat <select>.
  const tree = buildTree(rows, (r) => r.parentId);
  const out: { value: string; label: string; isActive: boolean }[] = [];
  const walk = (nodes: typeof tree, depth: number) => {
    for (const n of nodes) {
      out.push({ value: n.id, label: `${"  ".repeat(depth)}${depth ? "└ " : ""}${n.name}`, isActive: n.isActive });
      walk(n.children, depth + 1);
    }
  };
  walk(tree, 0);
  return out;
}

export async function upsertDepartment(ctx: AuthContext, input: z.infer<typeof departmentSchema>) {
  assertCan(ctx, "org.manage");
  return db.$transaction(async (tx) => {
    const dup = await tx.department.findFirst({ where: { companyId: ctx.companyId, code: input.code, ...(input.id && { id: { not: input.id } }) } });
    if (dup) throw new ValidationError("Code already used.", { code: ["Another department uses this code"] });
    if (input.parentId && !(await tx.department.count({ where: { id: input.parentId, companyId: ctx.companyId } }))) {
      throw new ValidationError("Unknown parent.", { parentId: ["Unknown department"] });
    }
    if (input.headId && !(await tx.employee.count({ where: { id: input.headId, companyId: ctx.companyId, status: { not: "TERMINATED" } } }))) {
      throw new ValidationError("Unknown head.", { headId: ["Head must be an active employee"] });
    }
    const data = {
      name: input.name,
      code: input.code,
      costCenterCode: input.costCenterCode,
      description: input.description,
      parentId: input.parentId,
      headId: input.headId,
      isActive: input.isActive,
    };
    if (input.id) {
      const before = await tx.department.findFirst({ where: { id: input.id, companyId: ctx.companyId } });
      if (!before) throw new NotFoundError("Department not found.");
      if (await createsDepartmentCycle(tx, ctx.companyId, input.id, input.parentId)) {
        throw new ValidationError("Invalid parent.", { parentId: ["A department cannot sit under itself or one of its sub-departments"] });
      }
      if (!input.isActive && before.isActive) {
        const activeChildren = await tx.department.count({ where: { parentId: input.id, isActive: true } });
        if (activeChildren) throw new ValidationError("Deactivate its sub-departments first.", { isActive: ["Has active sub-departments"] });
      }
      const after = await tx.department.update({ where: { id: input.id }, data });
      const diff = diffSnapshots(before, after);
      if (diff.keys.length) await writeAudit(ctx, { action: "department.update", entityType: "Department", entityId: after.id, summary: `Updated ${after.name}: ${diff.keys.join(", ")}`, before: diff.before, after: diff.after }, tx);
      return after;
    }
    const created = await tx.department.create({ data: { ...data, companyId: ctx.companyId } });
    await writeAudit(ctx, { action: "department.create", entityType: "Department", entityId: created.id, summary: `Created ${created.name}`, after: created }, tx);
    return created;
  });
}

// ───────────────────────────── Positions ─────────────────────────────

export const POSITION_SORTS = ["title", "code", "grade", "level"] as const;

export async function listPositions(ctx: AuthContext, params: ListParams<(typeof POSITION_SORTS)[number]>, filters: { active?: boolean }) {
  assertCan(ctx, "org.manage");
  const where: Prisma.PositionWhereInput = {
    companyId: ctx.companyId,
    ...(filters.active !== undefined && { isActive: filters.active }),
    ...(params.q && { OR: [{ title: { contains: params.q, mode: "insensitive" } }, { code: { contains: params.q, mode: "insensitive" } }, { grade: { contains: params.q, mode: "insensitive" } }] }),
  };
  const [items, total] = await Promise.all([
    db.position.findMany({
      where,
      orderBy: { [params.sort]: params.dir },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { _count: { select: { employees: { where: { status: { not: "TERMINATED" } } } } } },
    }),
    db.position.count({ where }),
  ]);
  return paginated(items, total, params.page, params.pageSize);
}

export async function listPositionOptions(ctx: AuthContext) {
  const rows = await db.position.findMany({ where: { companyId: ctx.companyId }, orderBy: { title: "asc" }, select: { id: true, title: true, grade: true, isActive: true } });
  return rows.map((r) => ({ value: r.id, label: r.grade ? `${r.title} (${r.grade})` : r.title, isActive: r.isActive }));
}

export async function upsertPosition(ctx: AuthContext, input: z.infer<typeof positionSchema>) {
  assertCan(ctx, "org.manage");
  return db.$transaction(async (tx) => {
    const dup = await tx.position.findFirst({ where: { companyId: ctx.companyId, code: input.code, ...(input.id && { id: { not: input.id } }) } });
    if (dup) throw new ValidationError("Code already used.", { code: ["Another position uses this code"] });
    const data = { title: input.title, code: input.code, grade: input.grade, level: input.level, description: input.description, isActive: input.isActive };
    if (input.id) {
      const before = await tx.position.findFirst({ where: { id: input.id, companyId: ctx.companyId } });
      if (!before) throw new NotFoundError("Position not found.");
      const after = await tx.position.update({ where: { id: input.id }, data });
      const diff = diffSnapshots(before, after);
      if (diff.keys.length) await writeAudit(ctx, { action: "position.update", entityType: "Position", entityId: after.id, summary: `Updated ${after.title}`, before: diff.before, after: diff.after }, tx);
      return after;
    }
    const created = await tx.position.create({ data: { ...data, companyId: ctx.companyId } });
    await writeAudit(ctx, { action: "position.create", entityType: "Position", entityId: created.id, summary: `Created ${created.title}`, after: created }, tx);
    return created;
  });
}

// ───────────────────────────── Locations ─────────────────────────────

export const LOCATION_SORTS = ["name", "code", "city"] as const;

export async function listLocations(ctx: AuthContext, params: ListParams<(typeof LOCATION_SORTS)[number]>, filters: { active?: boolean }) {
  assertCan(ctx, "org.manage");
  const where: Prisma.LocationWhereInput = {
    companyId: ctx.companyId,
    ...(filters.active !== undefined && { isActive: filters.active }),
    ...(params.q && { OR: [{ name: { contains: params.q, mode: "insensitive" } }, { code: { contains: params.q, mode: "insensitive" } }, { city: { contains: params.q, mode: "insensitive" } }] }),
  };
  const [items, total] = await Promise.all([
    db.location.findMany({
      where,
      orderBy: { [params.sort]: params.dir },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { _count: { select: { employees: { where: { status: { not: "TERMINATED" } } } } } },
    }),
    db.location.count({ where }),
  ]);
  return paginated(items, total, params.page, params.pageSize);
}

export async function listLocationOptions(ctx: AuthContext) {
  const rows = await db.location.findMany({ where: { companyId: ctx.companyId }, orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } });
  return rows.map((r) => ({ value: r.id, label: r.name, isActive: r.isActive }));
}

export async function upsertLocation(ctx: AuthContext, input: z.infer<typeof locationSchema>) {
  assertCan(ctx, "org.manage");
  return db.$transaction(async (tx) => {
    const dup = await tx.location.findFirst({ where: { companyId: ctx.companyId, code: input.code, ...(input.id && { id: { not: input.id } }) } });
    if (dup) throw new ValidationError("Code already used.", { code: ["Another location uses this code"] });
    const data = { name: input.name, code: input.code, address: input.address, city: input.city, emirate: input.emirate, country: input.country, isActive: input.isActive };
    if (input.id) {
      const before = await tx.location.findFirst({ where: { id: input.id, companyId: ctx.companyId } });
      if (!before) throw new NotFoundError("Location not found.");
      const after = await tx.location.update({ where: { id: input.id }, data });
      const diff = diffSnapshots(before, after);
      if (diff.keys.length) await writeAudit(ctx, { action: "location.update", entityType: "Location", entityId: after.id, summary: `Updated ${after.name}`, before: diff.before, after: diff.after }, tx);
      return after;
    }
    const created = await tx.location.create({ data: { ...data, companyId: ctx.companyId } });
    await writeAudit(ctx, { action: "location.create", entityType: "Location", entityId: created.id, summary: `Created ${created.name}`, after: created }, tx);
    return created;
  });
}
