import "server-only";
import { db, type DbClient } from "@/server/db";
import { env } from "@/server/env";
import type { AuthContext } from "@/server/auth/permissions";
import { sendMail } from "@/server/mail";
import { notificationEmail } from "@/server/mail/templates";
import { NotFoundError } from "@/server/errors";
import { serverT, translatorFor } from "@/server/i18n";
import { DEFAULT_LOCALE, isLocale, type AppLocale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { createFormat } from "@/lib/format";

type NotificationKey = Exclude<keyof Messages["emails"]["notifications"], "commentLine" | "noteLine">;
/** A message parameter; Dates are formatted, functions are called, per recipient language. */
export type MessageParam = string | number | Date | ((locale: AppLocale) => string | Promise<string>);

/**
 * Notification text is rendered when the notification is created, in each recipient's saved language
 * (User.locale), from messages/<locale>/emails.json → notifications.<key>.{title,body}.
 */
export type NotificationMessage = { key: NotificationKey; params?: Record<string, MessageParam>; comment?: string | null; note?: string | null };

export type NotificationInput = {
  companyId: string;
  userIds: (string | null | undefined)[];
  type: string;
  message: NotificationMessage;
  link?: string;
  email?: boolean;
};

/** Approval chain ("Manager → HR") in the recipient's language. */
export function approvalChainParam(roles: string[]): MessageParam {
  return async (locale) => {
    const t = (await translatorFor(locale, "enums")) as unknown as (key: string) => string;
    return roles.map((r) => t(`approvalRole.${r}`)).join(locale === "ar" ? " ← " : " → ");
  };
}

async function renderMessage(m: NotificationMessage, locale: AppLocale) {
  const t = await translatorFor(locale, "emails");
  const f = createFormat(locale);
  const params = Object.fromEntries(
    await Promise.all(Object.entries(m.params ?? {}).map(async ([k, v]) => [k, v instanceof Date ? f.date(v) : typeof v === "function" ? await v(locale) : v])),
  ) as Record<string, string | number>;
  const tr = t as unknown as (key: string, values?: Record<string, string | number>) => string;
  let body = tr(`notifications.${m.key}.body`, params);
  if (m.note) body += tr("notifications.noteLine", { note: m.note });
  if (m.comment) body += `\n${tr("notifications.commentLine", { comment: m.comment })}`;
  return { title: tr(`notifications.${m.key}.title`, params), body };
}

const MAX_EMAIL_ATTEMPTS = 5;

/**
 * Create in-app notifications (and queue emails) inside the caller's transaction. Returns the ids so the
 * caller can try immediate delivery after commit with `deliverEmails(ids)`; anything that fails is retried by
 * the worker (outbox pattern).
 */
export async function notify(client: DbClient, n: NotificationInput): Promise<string[]> {
  const userIds = [...new Set(n.userIds.filter((u): u is string => !!u))];
  if (!userIds.length) return [];
  const users = await client.user.findMany({ where: { id: { in: userIds } }, select: { id: true, locale: true } });
  const localeOf = new Map(users.map((u) => [u.id, isLocale(u.locale) ? u.locale : DEFAULT_LOCALE]));
  const rendered = new Map<AppLocale, { title: string; body: string }>();
  for (const l of new Set(localeOf.values())) rendered.set(l, await renderMessage(n.message, l));
  if (!rendered.has(DEFAULT_LOCALE)) rendered.set(DEFAULT_LOCALE, await renderMessage(n.message, DEFAULT_LOCALE));
  const created = await Promise.all(
    userIds.map((userId) =>
      client.notification.create({
        data: {
          companyId: n.companyId,
          userId,
          type: n.type,
          ...rendered.get(localeOf.get(userId) ?? DEFAULT_LOCALE)!,
          link: n.link ?? null,
          emailStatus: n.email === false ? "NONE" : "PENDING",
        },
        select: { id: true },
      }),
    ),
  );
  return created.map((c) => c.id);
}

/** Send queued emails. With ids: just those (best effort after a request); without: the worker sweep. */
export async function deliverEmails(ids?: string[]) {
  if (ids && !ids.length) return { sent: 0, failed: 0 };
  const pending = await db.notification.findMany({
    where: { emailStatus: "PENDING", emailAttempts: { lt: MAX_EMAIL_ATTEMPTS }, ...(ids && { id: { in: ids } }) },
    include: { user: { select: { email: true, isActive: true, locale: true } }, company: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  let sent = 0;
  let failed = 0;
  for (const n of pending) {
    if (!n.user.isActive) {
      await db.notification.update({ where: { id: n.id }, data: { emailStatus: "NONE" } });
      continue;
    }
    const ok = await sendMail(
      await notificationEmail({ to: n.user.email, company: n.company.name, title: n.title, body: n.body, link: n.link ? `${env.APP_URL}${n.link}` : null, locale: isLocale(n.user.locale) ? n.user.locale : DEFAULT_LOCALE }),
    );
    const attempts = n.emailAttempts + 1;
    await db.notification.update({
      where: { id: n.id },
      data: ok
        ? { emailStatus: "SENT", emailAttempts: attempts, emailedAt: new Date() }
        : { emailAttempts: attempts, emailStatus: attempts >= MAX_EMAIL_ATTEMPTS ? "FAILED" : "PENDING" },
    });
    if (ok) sent++;
    else failed++;
  }
  return { sent, failed };
}

/** Fire-and-forget delivery that never throws into the request. */
export function deliverEmailsInBackground(ids: string[]) {
  if (!ids.length) return;
  void deliverEmails(ids).catch((e) => console.error("[notify] email delivery failed", e));
}

export async function listNotifications(ctx: AuthContext, opts: { take?: number; unreadOnly?: boolean; page?: number } = {}) {
  const take = opts.take ?? 20;
  const where = { userId: ctx.userId, ...(opts.unreadOnly && { readAt: null }) };
  const [items, total, unread] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take, skip: ((opts.page ?? 1) - 1) * take }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId: ctx.userId, readAt: null } }),
  ]);
  return { items, total, unread };
}

export async function unreadCount(ctx: AuthContext) {
  return db.notification.count({ where: { userId: ctx.userId, readAt: null } });
}

export async function markRead(ctx: AuthContext, id: string) {
  const n = await db.notification.findFirst({ where: { id, userId: ctx.userId } });
  if (!n) throw new NotFoundError((await serverT("notifications"))("errors.notFound"));
  if (!n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  return n;
}

export async function markAllRead(ctx: AuthContext) {
  await db.notification.updateMany({ where: { userId: ctx.userId, readAt: null }, data: { readAt: new Date() } });
}
