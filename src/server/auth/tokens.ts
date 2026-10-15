import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { AuthTokenType } from "@prisma/client";
import type { DbClient } from "@/server/db";

export const TOKEN_TTL_MINUTES: Record<AuthTokenType, number> = {
  INVITE: 72 * 60,
  PASSWORD_RESET: 60,
};

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/** Issue a single-use token, revoking older unused tokens of the same type. Returns the raw token. */
export async function issueToken(db: DbClient, userId: string, type: AuthTokenType) {
  const raw = randomBytes(32).toString("base64url");
  await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await db.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES[type] * 60_000),
    },
  });
  return raw;
}

/** Look up a valid (unused, unexpired) token without consuming it. */
export async function findValidToken(db: DbClient, raw: string, type: AuthTokenType) {
  if (!raw || raw.length > 200) return null;
  const token = await db.authToken.findUnique({ where: { tokenHash: hashToken(raw) }, include: { user: true } });
  if (!token || token.type !== type || token.usedAt || token.expiresAt < new Date()) return null;
  return token;
}
