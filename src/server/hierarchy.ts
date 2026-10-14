import "server-only";
import type { DbClient } from "@/server/db";

/**
 * Ancestor chains via recursive CTEs, used to prevent cycles before writing a new parent/manager.
 * UNION (not UNION ALL) stops traversal if a cycle already exists in the data.
 */
export async function managerChain(db: DbClient, companyId: string, startEmployeeId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE chain AS (
      SELECT id, "managerId" FROM "Employee" WHERE id = ${startEmployeeId} AND "companyId" = ${companyId}
      UNION
      SELECT e.id, e."managerId" FROM "Employee" e JOIN chain c ON e.id = c."managerId" WHERE e."companyId" = ${companyId}
    )
    SELECT id FROM chain`;
  return rows.map((r) => r.id);
}

export async function departmentChain(db: DbClient, companyId: string, startDepartmentId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE chain AS (
      SELECT id, "parentId" FROM "Department" WHERE id = ${startDepartmentId} AND "companyId" = ${companyId}
      UNION
      SELECT d.id, d."parentId" FROM "Department" d JOIN chain c ON d.id = c."parentId" WHERE d."companyId" = ${companyId}
    )
    SELECT id FROM chain`;
  return rows.map((r) => r.id);
}

/** True when making `newParentId` the parent of `nodeId` would close a loop. */
export async function createsManagerCycle(db: DbClient, companyId: string, employeeId: string, newManagerId: string | null) {
  if (!newManagerId) return false;
  if (newManagerId === employeeId) return true;
  return (await managerChain(db, companyId, newManagerId)).includes(employeeId);
}

export async function createsDepartmentCycle(db: DbClient, companyId: string, departmentId: string, newParentId: string | null) {
  if (!newParentId) return false;
  if (newParentId === departmentId) return true;
  return (await departmentChain(db, companyId, newParentId)).includes(departmentId);
}
