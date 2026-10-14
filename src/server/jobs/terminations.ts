import "server-only";
import { db } from "@/server/db";
import { writeAudit } from "@/server/audit";
import { todayInTimeZone } from "@/lib/dates";

/**
 * Flip employees whose last working day has passed to TERMINATED and disable their login.
 * Runs daily in the worker; idempotent. (Login is already refused after the last working day —
 * this job makes the status visible in lists and reports.)
 */
export async function applyDueTerminations(now: Date = new Date()) {
  const companies = await db.company.findMany({ select: { id: true, timezone: true } });
  let count = 0;
  for (const company of companies) {
    const today = todayInTimeZone(company.timezone, now);
    const due = await db.employee.findMany({
      where: { companyId: company.id, status: { not: "TERMINATED" }, lastWorkingDay: { lt: today } },
    });
    for (const e of due) {
      await db.$transaction(async (tx) => {
        await tx.employee.update({ where: { id: e.id }, data: { status: "TERMINATED" } });
        if (e.userId) await tx.user.update({ where: { id: e.userId }, data: { isActive: false, sessionVersion: { increment: 1 } } });
        await writeAudit(
          { companyId: company.id, userId: null },
          { action: "employee.terminate.apply", entityType: "Employee", entityId: e.id, summary: "Termination took effect (system job)", before: { status: e.status }, after: { status: "TERMINATED" } },
          tx,
        );
      });
      count++;
    }
  }
  return count;
}
