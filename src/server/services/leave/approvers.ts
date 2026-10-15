import "server-only";
import type { DbClient } from "@/server/db";

/** Active users in the company holding a permission (via any role). */
export async function usersWithPermission(client: DbClient, companyId: string, key: string) {
  const users = await client.user.findMany({
    where: { companyId, isActive: true, roles: { some: { role: { permissions: { some: { permission: { key } } } } } } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Users who delegated their approvals to `delegateId` for a date. */
export async function delegatorsFor(client: DbClient, delegateId: string, on: Date) {
  const rows = await client.approvalDelegation.findMany({
    where: { delegateId, isActive: true, startDate: { lte: on }, endDate: { gte: on } },
    select: { delegatorId: true },
  });
  return rows.map((r) => r.delegatorId);
}

/** Active delegates of a user for a date. */
export async function delegatesOf(client: DbClient, delegatorId: string, on: Date) {
  const rows = await client.approvalDelegation.findMany({
    where: { delegatorId, isActive: true, startDate: { lte: on }, endDate: { gte: on }, delegate: { isActive: true } },
    select: { delegateId: true },
  });
  return rows.map((r) => r.delegateId);
}

/** Who should be told an approval step is waiting. */
export async function stepRecipients(
  client: DbClient,
  companyId: string,
  approval: { approverRole: string; approverUserId: string | null },
  requesterUserId: string | null,
  on: Date,
) {
  const ids =
    approval.approverRole === "MANAGER" && approval.approverUserId
      ? [approval.approverUserId, ...(await delegatesOf(client, approval.approverUserId, on))]
      : await usersWithPermission(client, companyId, "leave.approve.all");
  return ids.filter((id) => id !== requesterUserId);
}
