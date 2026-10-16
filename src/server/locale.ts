import "server-only";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { isLocale, LOCALE_COOKIE, type AppLocale } from "@/i18n/config";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocaleCookie(locale: AppLocale) {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
}

/**
 * At sign-in: a saved preference wins and becomes the cookie; otherwise the language picked on the
 * login page is saved as the user's preference.
 */
export async function syncLocaleAtSignIn(user: { id: string; locale: string | null }) {
  try {
    if (isLocale(user.locale)) return await setLocaleCookie(user.locale);
    const current = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(current)) await db.user.update({ where: { id: user.id }, data: { locale: current } });
  } catch {
    // Not in a request that can set cookies (should not happen at sign-in); language falls back to the cookie/default.
  }
}
