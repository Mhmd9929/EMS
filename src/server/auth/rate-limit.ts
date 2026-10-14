import "server-only";
import { db } from "@/server/db";
import { env } from "@/server/env";

/**
 * DB-backed login throttling: counts failures in a sliding window per email and per IP.
 * A successful login for an email resets that email's counter.
 */
export async function isLoginThrottled(email: string, ip: string | null): Promise<boolean> {
  const windowStart = new Date(Date.now() - env.LOGIN_WINDOW_MINUTES * 60_000);
  const lastSuccess = await db.loginAttempt.findFirst({
    where: { email, success: true, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const emailSince = lastSuccess && lastSuccess.createdAt > windowStart ? lastSuccess.createdAt : windowStart;
  const [emailFailures, ipFailures] = await Promise.all([
    db.loginAttempt.count({ where: { email, success: false, createdAt: { gt: emailSince } } }),
    ip ? db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: windowStart } } }) : 0,
  ]);
  return emailFailures >= env.LOGIN_MAX_FAILURES_PER_EMAIL || ipFailures >= env.LOGIN_MAX_FAILURES_PER_IP;
}

export async function recordLoginAttempt(email: string, ip: string | null, success: boolean, reason?: string) {
  await db.loginAttempt.create({ data: { email, ip, success, reason } });
}
