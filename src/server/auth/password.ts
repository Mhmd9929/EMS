import "server-only";
import bcrypt from "bcryptjs";
import { env } from "@/server/env";

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, env.BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// Used to keep response time constant when the user does not exist.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5c1n8B8yYpQq0lRjE1t6m6p8wW3o5xK";
export async function burnPasswordCheck(plain: string) {
  await bcrypt.compare(plain, DUMMY_HASH).catch(() => false);
}
