import "server-only";
import type { z } from "zod";
import { db } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { writeAudit, diffSnapshots } from "@/server/audit";
import { NotFoundError, ValidationError } from "@/server/errors";
import { addDays, parseDateOnly, toDateInput } from "@/lib/dates";
import { num } from "@/lib/leave/numbers";
import type { holidaySchema, leavePolicySchema, leaveSettingsSchema, leaveTypeSchema } from "@/lib/validation/leave";

// ───────────────────────────── Leave types ─────────────────────────────

export async function listLeaveTypes(ctx: AuthContext, opts: { includeInactive?: boolean } = {}) {
  const types = await db.leaveType.findMany({
    where: { companyId: ctx.companyId, ...(!opts.includeInactive && { isActive: true }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { requests: true, policies: true } } },
  });
  return types.map((t) => ({ ...t, annualEntitlement: num(t.annualEntitlement), carryForwardMax: num(t.carryForwardMax) }));
}

export async function upsertLeaveType(ctx: AuthContext, input: z.infer<typeof leaveTypeSchema>) {
  assertCan(ctx, "leave.config.manage");
  if (input.accrualMethod === "NONE" && input.annualEntitlement > 0) {
    throw new ValidationError("Leave without a balance has no entitlement.", { annualEntitlement: ["Set to 0, or choose an accrual method"] });
  }
  return db.$transaction(async (tx) => {
    const dup = await tx.leaveType.findFirst({ where: { companyId: ctx.companyId, code: input.code, ...(input.id && { id: { not: input.id } }) } });
    if (dup) throw new ValidationError("Code already used.", { code: ["Another leave type uses this code"] });
    const { id, ...data } = input;
    if (id) {
      const before = await tx.leaveType.findFirst({ where: { id, companyId: ctx.companyId } });
      if (!before) throw new NotFoundError("Leave type not found.");
      const after = await tx.leaveType.update({ where: { id }, data });
      const diff = diffSnapshots(before, after);
      if (diff.keys.length) await writeAudit(ctx, { action: "leave.type.update", entityType: "LeaveType", entityId: id, summary: `Updated ${after.name}: ${diff.keys.join(", ")}`, before: diff.before, after: diff.after }, tx);
      return after;
    }
    const sortOrder = (await tx.leaveType.count({ where: { companyId: ctx.companyId } })) + 1;
    const created = await tx.leaveType.create({ data: { ...data, companyId: ctx.companyId, sortOrder } });
    await writeAudit(ctx, { action: "leave.type.create", entityType: "LeaveType", entityId: created.id, summary: `Created leave type ${created.name}`, after: created }, tx);
    return created;
  });
}

// ───────────────────────────── Policies ─────────────────────────────

export async function listLeavePolicies(ctx: AuthContext) {
  assertCan(ctx, "leave.config.manage");
  const rows = await db.leavePolicy.findMany({
    where: { companyId: ctx.companyId },
    include: {
      leaveType: { select: { name: true, color: true, annualEntitlement: true } },
      department: { select: { name: true } },
      position: { select: { title: true } },
    },
    orderBy: [{ leaveType: { sortOrder: "asc" } }, { name: "asc" }],
  });
  return rows.map((p) => ({ ...p, annualEntitlement: p.annualEntitlement === null ? null : num(p.annualEntitlement), leaveType: { ...p.leaveType, annualEntitlement: num(p.leaveType.annualEntitlement) } }));
}

export async function upsertLeavePolicy(ctx: AuthContext, input: z.infer<typeof leavePolicySchema>) {
  assertCan(ctx, "leave.config.manage");
  if (!input.departmentId && !input.positionId && !input.employmentType) {
    throw new ValidationError("A policy must target a department, position or employment type.", { departmentId: ["Choose at least one criterion"] });
  }
  return db.$transaction(async (tx) => {
    const refs = await Promise.all([
      tx.leaveType.count({ where: { id: input.leaveTypeId, companyId: ctx.companyId } }),
      input.departmentId ? tx.department.count({ where: { id: input.departmentId, companyId: ctx.companyId } }) : 1,
      input.positionId ? tx.position.count({ where: { id: input.positionId, companyId: ctx.companyId } }) : 1,
    ]);
    if (refs.some((c) => !c)) throw new ValidationError("Unknown leave type, department or position.");
    const { id, ...data } = input;
    if (id) {
      const before = await tx.leavePolicy.findFirst({ where: { id, companyId: ctx.companyId } });
      if (!before) throw new NotFoundError("Policy not found.");
      const after = await tx.leavePolicy.update({ where: { id }, data });
      const diff = diffSnapshots(before, after);
      if (diff.keys.length) await writeAudit(ctx, { action: "leave.policy.update", entityType: "LeavePolicy", entityId: id, summary: `Updated policy ${after.name}`, before: diff.before, after: diff.after }, tx);
      return after;
    }
    const created = await tx.leavePolicy.create({ data: { ...data, companyId: ctx.companyId } });
    await writeAudit(ctx, { action: "leave.policy.create", entityType: "LeavePolicy", entityId: created.id, summary: `Created policy ${created.name}`, after: created }, tx);
    return created;
  });
}

// ───────────────────────────── Public holidays ─────────────────────────────

export async function listHolidays(ctx: AuthContext, year: number) {
  return db.publicHoliday.findMany({
    where: { companyId: ctx.companyId, year },
    include: { location: { select: { name: true } } },
    orderBy: { date: "asc" },
  });
}

/** Create (optionally a multi-day range, one row per day) or update a holiday. */
export async function upsertHoliday(ctx: AuthContext, input: z.infer<typeof holidaySchema>) {
  assertCan(ctx, "leave.config.manage");
  if (input.locationId && !(await db.location.count({ where: { id: input.locationId, companyId: ctx.companyId } }))) {
    throw new ValidationError("Unknown location.", { locationId: ["Unknown location"] });
  }
  return db.$transaction(async (tx) => {
    if (input.id) {
      const before = await tx.publicHoliday.findFirst({ where: { id: input.id, companyId: ctx.companyId } });
      if (!before) throw new NotFoundError("Holiday not found.");
      const after = await tx.publicHoliday.update({
        where: { id: input.id },
        data: { name: input.name, date: input.date, year: input.date.getUTCFullYear(), locationId: input.locationId },
      });
      await writeAudit(ctx, { action: "holiday.update", entityType: "PublicHoliday", entityId: after.id, summary: `Updated ${after.name} ${toDateInput(after.date)}`, before, after }, tx);
      return 1;
    }
    const end = input.endDate ? parseDateOnly(input.endDate) : input.date;
    if (!end || end < input.date) throw new ValidationError("Invalid end date.", { endDate: ["Must be on or after the date"] });
    if ((end.getTime() - input.date.getTime()) / 86_400_000 > 14) throw new ValidationError("A holiday can span at most 15 days.", { endDate: ["Too long"] });
    const rows = [];
    for (let d = input.date; d <= end; d = addDays(d, 1)) {
      rows.push({ companyId: ctx.companyId, name: input.name, date: d, year: d.getUTCFullYear(), locationId: input.locationId });
    }
    await tx.publicHoliday.createMany({ data: rows });
    await writeAudit(ctx, { action: "holiday.create", entityType: "PublicHoliday", summary: `Added ${input.name} (${toDateInput(input.date)}${rows.length > 1 ? ` → ${toDateInput(end)}` : ""})`, after: { name: input.name, from: input.date, to: end, locationId: input.locationId } }, tx);
    return rows.length;
  });
}

export async function deleteHoliday(ctx: AuthContext, id: string) {
  assertCan(ctx, "leave.config.manage");
  await db.$transaction(async (tx) => {
    const h = await tx.publicHoliday.findFirst({ where: { id, companyId: ctx.companyId } });
    if (!h) throw new NotFoundError("Holiday not found.");
    await tx.publicHoliday.delete({ where: { id } });
    await writeAudit(ctx, { action: "holiday.delete", entityType: "PublicHoliday", entityId: id, summary: `Removed ${h.name} ${toDateInput(h.date)}`, before: h }, tx);
  });
}

/** Copy a year's holidays to the next year (same day/month) — lunar holidays then need adjusting. */
export async function copyHolidays(ctx: AuthContext, fromYear: number, toYear: number) {
  assertCan(ctx, "leave.config.manage");
  const existing = await db.publicHoliday.count({ where: { companyId: ctx.companyId, year: toYear } });
  if (existing) throw new ValidationError(`${toYear} already has holidays.`);
  const source = await db.publicHoliday.findMany({ where: { companyId: ctx.companyId, year: fromYear } });
  if (!source.length) throw new ValidationError(`${fromYear} has no holidays to copy.`);
  const rows = source
    .map((h) => {
      const date = new Date(Date.UTC(toYear, h.date.getUTCMonth(), h.date.getUTCDate()));
      return date.getUTCMonth() === h.date.getUTCMonth() ? { companyId: ctx.companyId, name: h.name, date, year: toYear, locationId: h.locationId } : null;
    })
    .filter((r): r is NonNullable<typeof r> => !!r);
  await db.$transaction(async (tx) => {
    await tx.publicHoliday.createMany({ data: rows });
    await writeAudit(ctx, { action: "holiday.copy", entityType: "PublicHoliday", summary: `Copied ${rows.length} holidays from ${fromYear} to ${toYear}` }, tx);
  });
  return rows.length;
}

// ───────────────────────────── Settings ─────────────────────────────

export async function getLeaveSettings(ctx: AuthContext) {
  const c = await db.company.findUniqueOrThrow({ where: { id: ctx.companyId }, select: { leaveEscalationDays: true, workWeek: true } });
  return c;
}

export async function updateLeaveSettings(ctx: AuthContext, input: z.infer<typeof leaveSettingsSchema>) {
  assertCan(ctx, "leave.config.manage");
  await db.$transaction(async (tx) => {
    const before = await tx.company.findUniqueOrThrow({ where: { id: ctx.companyId }, select: { leaveEscalationDays: true } });
    await tx.company.update({ where: { id: ctx.companyId }, data: input });
    await writeAudit(ctx, { action: "leave.settings.update", entityType: "Company", entityId: ctx.companyId, before, after: input }, tx);
  });
}
