import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

/** Locales with a messages file. Arabic (RTL) arrives in Phase 4. */
export const SUPPORTED_LOCALES = ["en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const RTL_LOCALES: string[] = ["ar"];

export default getRequestConfig(async () => {
  const store = await cookies();
  const requested = store.get("locale")?.value;
  const locale: Locale = (SUPPORTED_LOCALES as readonly string[]).includes(requested ?? "") ? (requested as Locale) : "en";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Asia/Dubai",
  };
});
