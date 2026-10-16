/** Locale settings shared by server and client code. */
export const LOCALES = ["en", "ar"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";
export const RTL_LOCALES: readonly string[] = ["ar"];
export const LOCALE_COOKIE = "locale";
/** Intl locale per app locale. ar-AE keeps Western (Latin) digits, the UAE business convention. */
export const INTL_LOCALE: Record<AppLocale, string> = { en: "en-GB", ar: "ar-AE" };
export const LOCALE_LABELS: Record<AppLocale, string> = { en: "English", ar: "العربية" };

export const isLocale = (v: unknown): v is AppLocale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
export const isRtl = (locale: string) => RTL_LOCALES.includes(locale);

/**
 * Message namespaces: one JSON file per namespace and locale in /messages/<locale>/<ns>.json.
 * Add a namespace here and create both files.
 */
export const NAMESPACES = [
  "app", "nav", "auth", "common", "enums", "errors", "emails",
  "dashboard", "profile", "notifications", "directory", "orgChart",
  "employees", "organization", "admin", "leave", "payroll", "payslips",
] as const;
export type Namespace = (typeof NAMESPACES)[number];
