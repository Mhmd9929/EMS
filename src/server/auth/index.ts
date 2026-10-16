import "server-only";
import { syncLocaleAtSignIn } from "@/server/locale";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { Provider } from "next-auth/providers";
import { authConfig } from "./auth.config";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { burnPasswordCheck, verifyPassword } from "./password";
import { isLoginThrottled, recordLoginAttempt } from "./rate-limit";
import { getRequestMeta } from "@/server/request";
import { loginSchema } from "@/lib/validation/auth";
import { isEmploymentEnded } from "./status";

class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}
class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}
class AccountDisabled extends CredentialsSignin {
  code = "account_disabled";
}

async function loadLoginUser(where: { id: string } | { email: string }) {
  return db.user.findUnique({
    where,
    include: { company: { select: { timezone: true } }, employee: { select: { status: true, lastWorkingDay: true } } },
  });
}

type LoginUser = NonNullable<Awaited<ReturnType<typeof loadLoginUser>>>;

function canSignIn(user: LoginUser) {
  return user.isActive && !isEmploymentEnded(user.employee, user.company.timezone);
}

const providers: Provider[] = [
  Credentials({
    credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
    async authorize(raw) {
      const parsed = loginSchema.safeParse(raw);
      if (!parsed.success) throw new InvalidCredentials();
      const { email, password } = parsed.data;
      const { ip } = await getRequestMeta();

      if (await isLoginThrottled(email, ip)) {
        await recordLoginAttempt(email, ip, false, "rate_limited");
        throw new RateLimited();
      }

      const user = await loadLoginUser({ email });
      if (!user?.passwordHash) {
        await burnPasswordCheck(password);
        await recordLoginAttempt(email, ip, false, "invalid_credentials");
        throw new InvalidCredentials();
      }
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        await recordLoginAttempt(email, ip, false, "invalid_credentials");
        throw new InvalidCredentials();
      }
      if (!canSignIn(user)) {
        await recordLoginAttempt(email, ip, false, "account_disabled");
        throw new AccountDisabled();
      }
      await recordLoginAttempt(email, ip, true);
      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return { id: user.id, email: user.email, name: user.name };
    },
  }),
];

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }));
}
if (env.AUTH_MICROSOFT_ENTRA_ID_ID && env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
  providers.push(
    MicrosoftEntraID({
      clientId: env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  );
}

export const enabledSsoProviders = providers
  .map((p) => (typeof p === "function" ? p() : p))
  .filter((p) => p.id !== "credentials")
  .map((p) => ({ id: p.id, name: p.name }));

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") return true;
      // SSO: only existing, active users matched by email may sign in (no self-provisioning).
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const dbUser = await loadLoginUser({ email });
      const { ip } = await getRequestMeta();
      if (!dbUser || !canSignIn(dbUser)) {
        await recordLoginAttempt(email, ip, false, `sso_${account.provider}_denied`);
        return "/login?error=sso_denied";
      }
      await recordLoginAttempt(email, ip, true, `sso_${account.provider}`);
      await db.user.update({ where: { id: dbUser.id }, data: { lastLoginAt: new Date() } });
      return true;
    },
    async jwt({ token, user, account }) {
      if (user && account) {
        const dbUser =
          account.provider === "credentials"
            ? await db.user.findUnique({ where: { id: user.id! } })
            : await db.user.findUnique({ where: { email: user.email!.toLowerCase() } });
        if (!dbUser) return null;
        await syncLocaleAtSignIn(dbUser);
        token.uid = dbUser.id;
        token.sv = dbUser.sessionVersion;
        token.authTime = Math.floor(Date.now() / 1000);
        token.name = dbUser.name;
        token.email = dbUser.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        session.user.id = token.uid as string;
        session.sessionVersion = token.sv as number;
        session.authTime = token.authTime as number;
      }
      return session;
    },
  },
});
