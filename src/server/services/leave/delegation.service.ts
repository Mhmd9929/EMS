import "server-only";
import { db } from "@/server/db";
import type { AuthContext } from "@/server/auth/permissions";
import { writeAudit } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { formatDate, todayInTimeZone, toDateInput } from "@/lib/dates";
import { deliverEmailsInBackground, notify } from "../notification.service";

/** Anyone who approves leave (has reports, or the approval permission) can delegate while away. */
async function assertCanDelegate(ctx: AuthContext) {
  if (ctx.permissions.has("leave.approve.team") || ctx.permissions.has("leave.approve.all")) return;
  if (ctx.employeeId && (await db.employee.count({ where: { managerId: ctx.employeeId, status: { not: "TERMINATED" } } }))) return;
  throw new ForbiddenError("Only approvers can delegate approvals.");
}

export async function listMyDelegations(ctx: AuthContext) {
  const [given, received] = await Promise.all([
    db.approvalDelegation.findMany({ where: { delegatorId: ctx.userId }, include: { delegate: { select: { name: true, email: true } } }, orderBy: { startDate: "desc" }, take: 50 }),
    db.approvalDelegation.findMany({ where: { delegateId: ctx.userId, isActive: true, endDate: { gte: todayInTimeZone(ctx.timezone) } }, include: { delegator: { select: { name: true } } }, orderBy: { startDate: "asc" } }),
  ]);
  return { given, received };
}

export async function delegateOptions(ctx: AuthContext) {
  const users = await db.user.findMany({
    where: { companyId: ctx.companyId, isActive: true, id: { not: ctx.userId }, passwordHash: { not: null }, employee: { status: { not: "TERMINATED" } } },
    select: { id: true, name: true, employee: { select: { position: { select: { title: true } } } } },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ value: u.id, label: u.employee?.position ? `${u.name} — ${u.employee.position.title}` : u.name }));
}

export async function createDelegation(ctx: AuthContext, input: { delegateId: string; startDate: Date; endDate: Date; reason: string | null }) {
  await assertCanDelegate(ctx);
  if (input.delegateId === ctx.userId) throw new ValidationError("You cannot delegate to yourself.", { delegateId: ["Choose someone else"] });
  if (input.endDate < todayInTimeZone(ctx.timezone)) throw new ValidationError("The delegation would already be over.", { endDate: ["Must be today or later"] });
  const delegate = await db.user.findFirst({ where: { id: input.delegateId, companyId: ctx.companyId, isActive: true } });
  if (!delegate) throw new ValidationError("Choose an active colleague.", { delegateId: ["Unknown user"] });
  const overlap = await db.approvalDelegation.findFirst({
    where: { delegatorId: ctx.userId, isActive: true, startDate: { lte: input.endDate }, endDate: { gte: input.startDate } },
  });
  if (overlap) throw new ValidationError("You already have a delegation in that period.", { startDate: ["Overlaps an existing delegation"] });
  const ids: string[] = [];
  const created = await db.$transaction(async (tx) => {
    const d = await tx.approvalDelegation.create({ data: { companyId: ctx.companyId, delegatorId: ctx.userId, ...input } });
    await writeAudit(ctx, { action: "leave.delegation.create", entityType: "ApprovalDelegation", entityId: d.id, summary: `Delegated leave approvals to ${delegate.name} ${toDateInput(input.startDate)} → ${toDateInput(input.endDate)}`, after: d }, tx);
    ids.push(
      ...(await notify(tx, {
        companyId: ctx.companyId,
        userIds: [delegate.id],
        type: "leave.delegation",
        title: `${ctx.employeeName ?? ctx.name} delegated leave approvals to you`,
        body: `From ${formatDate(input.startDate)} to ${formatDate(input.endDate)} you can approve leave for ${ctx.employeeName ?? ctx.name}'s team.${input.reason ? ` Note: ${input.reason}` : ""}`,
        link: "/leave/approvals",
      })),
    );
    return d;
  });
  deliverEmailsInBackground(ids);
  return created;
}

export async function revokeDelegation(ctx: AuthContext, id: string) {
  const d = await db.approvalDelegation.findFirst({ where: { id, delegatorId: ctx.userId } });
  if (!d) throw new NotFoundError("Delegation not found.");
  await db.$transaction(async (tx) => {
    await tx.approvalDelegation.update({ where: { id }, data: { isActive: false } });
    await writeAudit(ctx, { action: "leave.delegation.revoke", entityType: "ApprovalDelegation", entityId: id, before: { isActive: true }, after: { isActive: false } }, tx);
  });
}
