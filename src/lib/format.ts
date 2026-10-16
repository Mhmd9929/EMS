/**
 * Locale-aware display formatting (isomorphic). Use `getFormat()` in server code and `useFormat()` in
 * client components; both return the same functions bound to the current locale.
 *   - calendar dates (date columns) are formatted in UTC so they never shift a day,
 *   - instants are formatted in the given (company) timezone,
 *   - Arabic uses ar-AE: Arabic month names with Western digits.
 */
import { INTL_LOCALE, type AppLocale } from "@/i18n/config";
import { decimalsOf } from "@/lib/payroll/money";

export type Format = ReturnType<typeof createFormat>;

export function createFormat(locale: AppLocale) {
  const intl = INTL_LOCALE[locale];
  const dateFmt = new Intl.DateTimeFormat(intl, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const monthFmt = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" });
  const shortMonthFmt = new Intl.DateTimeFormat(intl, { month: "short", timeZone: "UTC" });
  const weekdayFmt = new Intl.DateTimeFormat(intl, { weekday: "short", timeZone: "UTC" });
  return {
    locale,
    intl,
    /** Calendar date, e.g. "05 Oct 2026" / "05 أكتوبر 2026". */
    date: (d: Date | null | undefined) => (d ? dateFmt.format(d) : "—"),
    /** Calendar date as digits only, e.g. "05/10/2026" (bidi-safe inside Arabic text in PDFs). */
    numericDate: (d: Date | null | undefined) =>
      d ? new Intl.DateTimeFormat(intl, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC", numberingSystem: "latn" }).format(d).replace(/[\u200e\u200f\u061c]/g, "") : "—",
    /** Instant in a timezone, with time. */
    dateTime: (d: Date | null | undefined, timeZone: string) =>
      d ? new Intl.DateTimeFormat(intl, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone }).format(d) : "—",
    /** "YYYY-MM" or a Date → "October 2026". */
    month: (period: string | Date) => monthFmt.format(typeof period === "string" ? new Date(`${period}-01T00:00:00Z`) : period),
    shortMonth: (d: Date) => shortMonthFmt.format(d),
    weekday: (d: Date) => weekdayFmt.format(d),
    number: (n: number, opts: Intl.NumberFormatOptions = {}) => new Intl.NumberFormat(intl, { maximumFractionDigits: 2, ...opts }).format(n),
    /** Minor units → "AED 1,234.50" (en) / "1,234.50 د.إ.‏" (ar); `withCode: false` → number only. */
    money: (minor: number | bigint, currency: string, opts: { withCode?: boolean } = {}) => formatMoneyIn(locale, minor, currency, opts),
  };
}

export function formatMoneyIn(locale: AppLocale, minor: number | bigint, currency: string, opts: { withCode?: boolean } = {}) {
  const d = decimalsOf(currency);
  const value = Number(minor) / 10 ** d;
  const intl = INTL_LOCALE[locale];
  if (opts.withCode === false) return new Intl.NumberFormat(intl, { minimumFractionDigits: d, maximumFractionDigits: d }).format(value);
  if (locale === "en") return `${currency} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(value)}`;
  // Intl wraps Arabic currency output in bidi marks (U+200F…); the page's bidi algorithm doesn't need them and
  // the PDF renderer's font engine crashes on them, so they are removed.
  return new Intl.NumberFormat(intl, { style: "currency", currency, minimumFractionDigits: d, maximumFractionDigits: d })
    .format(value)
    .replace(/[\u200e\u200f\u061c]/g, "");
}
