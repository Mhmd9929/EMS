import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./config";
import { loadMessages } from "./messages";

/** Locale comes from the `locale` cookie (set from the user's saved preference at sign-in, or the switcher). */
export default getRequestConfig(async () => {
  const requested = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  return { locale, messages: await loadMessages(locale), timeZone: "Asia/Dubai" };
});
