import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { findValidToken, issueToken, TOKEN_TTL_MINUTES } from "@/server/auth/tokens";
import { writeAudit } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { serverT } from "@/server/i18n";
import { sendMail } from "@/server/mail";
import { inviteEmail, passwordChangedEmail, passwordResetEmail } from "@/server/mail/templates";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

const localeOf = (u: { locale?: string | null }) => (isLocale(u.locale) ? u.locale : DEFAULT_LOCALE);
import { SYSTEM_ROLES } from "@/server/rbac/catalogue";
import { paginated, type ListParams } from "@/lib/list-params";
import { isEmploymentEnded } from "@/server/auth/status";

// ───────────────────────────── Invites ─────────────────────────────

/**
 * (Re)send an invitation with a single-use set-password link.
 * Returns the link outside production so the demo works without an inbox.
 */
export async function sendInvite(ctx: AuthContext, userId: string): Promise<{ link: string | null }> {
  assertCan(ctx, ["user.manage", "employee.create"]);
  const t = await serverT("admin");
  const user = await db.user.findFirst({ where: { id: userId, companyId: ctx.companyId }, include: { company: true } });
  if (!user) throw new NotFoundError(t("errors.userNotFound"));
  if (!user.isActive) throw new ValidationError(t("errors.accountDeactivated"));
  if (user.passwordHash) throw new ValidationError(t("errors.alreadyActivated"));
  const raw = await issueToken(db, user.id, "INVITE");
  const link = `${env.APP_URL}/invite?token=${raw}`;
  await sendMail(await inviteEmail({ to: user.email, name: user.name, company: user.company.name, link, expiresHours: TOKEN_TTL_MINUTES.INVITE / 60, locale: localeOf(user) }));
  await writeAudit(ctx, { action: "user.invite", entityType: "User", entityId: user.id, summary: `Invitation sent to ${user.email}` });
  return { link: env.NODE_ENV === "production" ? null : link };
}

export async function getInvite(rawToken: string) {
  const token = await findValidToken(db, rawToken, "INVITE");
  if (!token) return null;
  return { email: token.user.email, name: token.user.name };
}

export async function acceptInvite(rawToken: string, password: string) {
  const t = await serverT("admin");
  return db.$transaction(async (tx) => {
    const token = await findValidToken(tx, rawToken, "INVITE");
    if (!token) throw new ValidationError(t("errors.inviteInvalid"));
    const passwordHash = await hashPassword(password);
    await tx.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    const user = await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), sessionVersion: { increment: 1 } },
    });
    await writeAudit({ companyId: user.companyId, userId: user.id }, { action: "user.invite.accept", entityType: "User", entityId: user.id, summary: "Account activated" }, tx);
    return { email: user.email };
  });
}

// ───────────────────────────── Password reset ─────────────────────────────

/** Always succeeds from the caller's point of view, so it can't be used to probe for accounts. */
export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email }, include: { company: true, employee: { select: { status: true, lastWorkingDay: true } } } });
  if (!user || !user.isActive || isEmploymentEnded(user.employee, user.company.timezone)) return;
  // Recently requested? Avoid flooding the inbox (1 per 2 minutes).
  const recent = await db.authToken.findFirst({
    where: { userId: user.id, type: "PASSWORD_RESET", createdAt: { gte: new Date(Date.now() - 120_000) } },
  });
  if (recent) return;
  const raw = await issueToken(db, user.id, "PASSWORD_RESET");
  const link = `${env.APP_URL}/reset-password?token=${raw}`;
  await sendMail(await passwordResetEmail({ to: user.email, name: user.name, company: user.company.name, link, locale: localeOf(user) }));
  await writeAudit({ companyId: user.companyId, userId: user.id }, { action: "user.password_reset.request", entityType: "User", entityId: user.id });
}

export async function isResetTokenValid(rawToken: string) {
  return !!(await findValidToken(db, rawToken, "PASSWORD_RESET"));
}

export async function resetPassword(rawToken: string, password: string) {
  const t = await serverT("admin");
  const user = await db.$transaction(async (tx) => {
    const token = await findValidToken(tx, rawToken, "PASSWORD_RESET");
    if (!token) throw new ValidationError(t("errors.resetInvalid"));
    await tx.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    const user = await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash: await hashPassword(password), mustChangePassword: false, passwordChangedAt: new Date(), sessionVersion: { increment: 1 } },
      include: { company: true },
    });
    await writeAudit({ companyId: user.companyId, userId: user.id }, { action: "user.password_reset", entityType: "User", entityId: user.id }, tx);
    return user;
  });
  await sendMail(await passwordChangedEmail({ to: user.email, name: user.name, company: user.company.name, locale: localeOf(user) }));
}

/** Change own password. Bumps sessionVersion, which signs out every other session. */
export async function changePassword(ctx: AuthContext, currentPassword: string, newPassword: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: ctx.userId }, include: { company: true } });
  if (!user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    const t = await serverT("admin");
    throw new ValidationError(t("errors.currentPasswordIncorrect"), { currentPassword: [t("errors.incorrectPassword")] });
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false, passwordChangedAt: new Date(), sessionVersion: { increment: 1 } },
    });
    await writeAudit(ctx, { action: "user.password_change", entityType: "User", entityId: user.id }, tx);
  });
  await sendMail(await passwordChangedEmail({ to: user.email, name: user.name, company: user.company.name, locale: localeOf(user) }));
  return { email: user.email };
}

// ───────────────────────────── User administration ─────────────────────────────

export const USER_SORTS = ["name", "email", "lastLogin"] as const;

export async function listUsers(ctx: AuthContext, params: ListParams<(typeof USER_SORTS)[number]>, filters: { roleId?: string; state?: "active" | "inactive" | "pending" }) {
  assertCan(ctx, "user.manage");
  const where: Prisma.UserWhereInput = {
    companyId: ctx.companyId,
    ...(filters.roleId && { roles: { some: { roleId: filters.roleId } } }),
    ...(filters.state === "active" && { isActive: true, passwordHash: { not: null } }),
    ...(filters.state === "inactive" && { isActive: false }),
    ...(filters.state === "pending" && { isActive: true, passwordHash: null }),
    ...(params.q && {
      OR: [{ name: { contains: params.q, mode: "insensitive" } }, { email: { contains: params.q, mode: "insensitive" } }],
    }),
  };
  const orderBy: Prisma.UserOrderByWithRelationInput =
    params.sort === "email" ? { email: params.dir } : params.sort === "lastLogin" ? { lastLoginAt: { sort: params.dir, nulls: "last" } } : { name: params.dir };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        passwordHash: true,
        mustChangePassword: true,
        employee: { select: { id: true, employeeNumber: true, status: true } },
        roles: { select: { role: { select: { id: true, name: true, key: true } } } },
      },
    }),
    db.user.count({ where }),
  ]);
  const items = rows.map(({ passwordHash, roles, ...u }) => ({ ...u, activated: !!passwordHash, roles: roles.map((r) => r.role) }));
  return paginated(items, total, params.page, params.pageSize);
}

async function countSuperAdmins(tx: Prisma.TransactionClient, companyId: string, excludingUserId?: string) {
  return tx.userRole.count({
    where: {
      role: { companyId, key: SYSTEM_ROLES.SUPER_ADMIN },
      user: { isActive: true, ...(excludingUserId && { id: { not: excludingUserId } }) },
    },
  });
}

/** Replace a user's roles. Only Super Admins can grant/revoke Super Admin; the last one can't be removed. */
export async function setUserRoles(ctx: AuthContext, userId: string, roleIds: string[]) {
  assertCan(ctx, "user.manage");
  const actorIsSuper = ctx.roles.some((r) => r.key === SYSTEM_ROLES.SUPER_ADMIN);
  const t = await serverT("admin");
  return db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id: userId, companyId: ctx.companyId }, include: { roles: { include: { role: true } } } });
    if (!user) throw new NotFoundError(t("errors.userNotFound"));
    const roles = await tx.role.findMany({ where: { companyId: ctx.companyId, id: { in: roleIds } } });
    if (roles.length !== new Set(roleIds).size) throw new ValidationError(t("errors.unknownRole"));

    if (!actorIsSuper) {
      // No self-service privilege changes, and no granting more than you hold yourself.
      if (userId === ctx.userId) throw new ForbiddenError(t("errors.cannotChangeOwnRoles"));
      const current = new Set(user.roles.map((r) => r.roleId));
      const added = await tx.role.findMany({
        where: { id: { in: roles.filter((r) => !current.has(r.id)).map((r) => r.id) } },
        include: { permissions: { include: { permission: { select: { key: true } } } } },
      });
      const exceeding = added.filter((r) => r.permissions.some((p) => !ctx.permissions.has(p.permission.key)));
      if (exceeding.length) {
        throw new ForbiddenError(t("errors.grantExceeds", { roles: exceeding.map((r) => r.name).join(", ") }));
      }
    }

    const hadSuper = user.roles.some((r) => r.role.key === SYSTEM_ROLES.SUPER_ADMIN);
    const willHaveSuper = roles.some((r) => r.key === SYSTEM_ROLES.SUPER_ADMIN);
    if (hadSuper !== willHaveSuper && !actorIsSuper) throw new ForbiddenError(t("errors.superAdminOnlyGrant"));
    if (hadSuper && !willHaveSuper && (await countSuperAdmins(tx, ctx.companyId, userId)) === 0) {
      throw new ValidationError(t("errors.superAdminRequired"));
    }

    const before = user.roles.map((r) => r.role.key).sort();
    await tx.userRole.deleteMany({ where: { userId } });
    if (roles.length) await tx.userRole.createMany({ data: roles.map((r) => ({ userId, roleId: r.id })) });
    const after = roles.map((r) => r.key).sort();
    await writeAudit(ctx, { action: "user.roles", entityType: "User", entityId: userId, summary: `Roles for ${user.email}: ${after.join(", ") || "none"}`, before: { roles: before }, after: { roles: after } }, tx);
  });
}

export async function setUserActive(ctx: AuthContext, userId: string, isActive: boolean) {
  assertCan(ctx, "user.manage");
  const t = await serverT("admin");
  if (userId === ctx.userId) throw new ValidationError(t("errors.cannotDeactivateSelf"));
  return db.$transaction(async (tx) => {
    const user = await tx.user.findFirst({ where: { id: userId, companyId: ctx.companyId }, include: { roles: { include: { role: true } } } });
    if (!user) throw new NotFoundError(t("errors.userNotFound"));
    const targetIsSuper = user.roles.some((r) => r.role.key === SYSTEM_ROLES.SUPER_ADMIN);
    if (targetIsSuper && !ctx.roles.some((r) => r.key === SYSTEM_ROLES.SUPER_ADMIN)) {
      throw new ForbiddenError(t("errors.superAdminOnlyToggle"));
    }
    if (!isActive && targetIsSuper && (await countSuperAdmins(tx, ctx.companyId, userId)) === 0) {
      throw new ValidationError(t("errors.superAdminRequired"));
    }
    await tx.user.update({ where: { id: userId }, data: { isActive, sessionVersion: { increment: 1 } } });
    await writeAudit(ctx, { action: isActive ? "user.activate" : "user.deactivate", entityType: "User", entityId: userId, before: { isActive: user.isActive }, after: { isActive } }, tx);
  });
}

/** Force sign-out everywhere (e.g. lost device). */
export async function revokeSessions(ctx: AuthContext, userId: string) {
  assertCan(ctx, "user.manage");
  const user = await db.user.findFirst({ where: { id: userId, companyId: ctx.companyId } });
  if (!user) throw new NotFoundError((await serverT("admin"))("errors.userNotFound"));
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
  await writeAudit(ctx, { action: "user.sessions.revoke", entityType: "User", entityId: userId });
}

/** Admin-triggered reset: sends the reset email (or an invite if never activated). */
export async function adminSendPasswordReset(ctx: AuthContext, userId: string) {
  assertCan(ctx, "user.manage");
  const user = await db.user.findFirst({ where: { id: userId, companyId: ctx.companyId }, include: { company: true } });
  if (!user) throw new NotFoundError((await serverT("admin"))("errors.userNotFound"));
  if (!user.passwordHash) return sendInvite(ctx, userId);
  const raw = await issueToken(db, user.id, "PASSWORD_RESET");
  const link = `${env.APP_URL}/reset-password?token=${raw}`;
  await sendMail(await passwordResetEmail({ to: user.email, name: user.name, company: user.company.name, link, locale: localeOf(user) }));
  await writeAudit(ctx, { action: "user.password_reset.admin", entityType: "User", entityId: userId });
  return { link: env.NODE_ENV === "production" ? null : link };
}
