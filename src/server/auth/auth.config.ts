import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config shared by middleware and the full server config.
 * Must not import Prisma or other Node-only modules.
 */
const idleMinutes = Number(process.env.SESSION_IDLE_MINUTES ?? 60);

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  // Rolling JWE cookie: every authenticated request extends it, so maxAge acts as the idle timeout.
  session: { strategy: "jwt", maxAge: idleMinutes * 60 },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;
