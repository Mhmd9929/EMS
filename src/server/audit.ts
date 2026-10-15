import "server-only";
import type { DbClient } from "@/server/db";
import { db as defaultDb } from "@/server/db";
import { getRequestMeta } from "@/server/request";
import { toAuditJson } from "@/lib/audit-diff";

export { changedKeys, diffSnapshots, toAuditJson } from "@/lib/audit-diff";

export type AuditEntry = {
  action: string; // e.g. employee.update
  entityType: string; // e.g. Employee
  entityId?: string | null;
  summary?: string;
  before?: unknown;
  after?: unknown;
};

export async function writeAudit(
  actor: { companyId: string; userId: string | null },
  entry: AuditEntry,
  client: DbClient = defaultDb,
) {
  const { ip, userAgent } = await getRequestMeta();
  await client.auditLog.create({
    data: {
      companyId: actor.companyId,
      actorUserId: actor.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      before: toAuditJson(entry.before),
      after: toAuditJson(entry.after),
      ip,
      userAgent,
    },
  });
}
