/**
 * Date helpers.
 *
 * - Instants (createdAt, lastLoginAt …) are stored in UTC and displayed in the company timezone.
 * - Calendar dates (DOB, join date, expiries …) are stored as `date` columns, which Prisma returns
 *   as a JS Date at 00:00 UTC. They must always be formatted in UTC so they never shift by a day.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse "YYYY-MM-DD" into a Date at 00:00 UTC. Returns null for empty / invalid input. */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Date-only value -> "YYYY-MM-DD" (for <input type="date">). */
export function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

/** Format a calendar date (date column). */
export function formatDate(date: Date | null | undefined, locale = "en-GB"): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

/** Format an instant in the company's timezone. */
export function formatDateTime(date: Date | null | undefined, timeZone: string, locale = "en-GB"): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

/** Today's calendar date in the given timezone, as a Date at 00:00 UTC. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parseDateOnly(parts)!;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Whole days from a to b (both date-only). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a date-only value. */
export function isoWeekday(date: Date): number {
  const d = date.getUTCDay();
  return d === 0 ? 7 : d;
}

/** Completed years between two calendar dates (e.g. age, years of service). */
export function yearsBetween(from: Date, to: Date): number {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const beforeAnniversary =
    to.getUTCMonth() < from.getUTCMonth() ||
    (to.getUTCMonth() === from.getUTCMonth() && to.getUTCDate() < from.getUTCDate());
  if (beforeAnniversary) years--;
  return years;
}

export const WEEKDAYS = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
  { value: 7, short: "Sun", long: "Sunday" },
] as const;
