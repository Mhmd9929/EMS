import { db } from "@/server/db";
import { contextForUser } from "@/server/auth/system-context";

export const contextFor = contextForUser;

export async function employeeIdByEmail(email: string) {
  return (await db.employee.findFirstOrThrow({ where: { workEmail: email }, select: { id: true } })).id;
}

export const DOMAIN = "falcongulf.ae";
