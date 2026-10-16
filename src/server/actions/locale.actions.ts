"use server";
import { revalidatePath } from "next/cache";
import { isLocale } from "@/i18n/config";
import { getAuthContext } from "@/server/auth/context";
import { db } from "@/server/db";
import { setLocaleCookie } from "@/server/locale";

/** Switch the interface language (cookie for this browser, saved on the user when signed in). */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  await setLocaleCookie(locale);
  const ctx = await getAuthContext();
  if (ctx) await db.user.update({ where: { id: ctx.userId }, data: { locale } });
  revalidatePath("/", "layout");
}
