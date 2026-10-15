/**
 * Working-day calculation for leave requests.
 *
 * All dates are calendar dates at 00:00 UTC (see lib/dates). A day counts when:
 *   - it is a working day (company work week) OR the leave type counts weekends, and
 *   - it is not a public holiday OR the leave type counts holidays.
 * Half days are only allowed for single-day requests.
 */
import { addDays, isoWeekday, toDateInput } from "@/lib/dates";
import { round2 } from "./numbers";

export type HalfDay = "NONE" | "FIRST_HALF" | "SECOND_HALF";

export type DayCountInput = {
  start: Date;
  end: Date;
  halfDay?: HalfDay;
  /** ISO weekdays that are working days (1 = Mon … 7 = Sun) */
  workWeek: number[];
  /** "YYYY-MM-DD" public holidays applying to the employee */
  holidays: ReadonlySet<string>;
  countWeekends: boolean;
  countHolidays: boolean;
};

export type CountedDay = { date: Date; amount: number };

export type DayCount = {
  total: number;
  days: CountedDay[];
  /** total per leave year (calendar year) */
  byYear: Record<number, number>;
  /** dates in the range that were skipped and why */
  skipped: { date: Date; reason: "weekend" | "holiday" }[];
};

export const MAX_REQUEST_SPAN_DAYS = 366;

export function countLeaveDays(input: DayCountInput): DayCount {
  const { start, end, workWeek, holidays, countWeekends, countHolidays } = input;
  const halfDay = input.halfDay ?? "NONE";
  if (end < start) throw new RangeError("End date is before start date");
  if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_REQUEST_SPAN_DAYS) throw new RangeError("Range is too long");
  if (halfDay !== "NONE" && start.getTime() !== end.getTime()) throw new RangeError("Half days are only allowed for single-day requests");

  const workdays = new Set(workWeek);
  const days: CountedDay[] = [];
  const skipped: DayCount["skipped"] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const isWeekend = !workdays.has(isoWeekday(d));
    const isHoliday = holidays.has(toDateInput(d));
    if (isHoliday && !countHolidays) {
      skipped.push({ date: d, reason: "holiday" });
      continue;
    }
    if (isWeekend && !countWeekends) {
      skipped.push({ date: d, reason: "weekend" });
      continue;
    }
    days.push({ date: d, amount: halfDay === "NONE" ? 1 : 0.5 });
  }
  const byYear: Record<number, number> = {};
  for (const day of days) {
    const y = day.date.getUTCFullYear();
    byYear[y] = round2((byYear[y] ?? 0) + day.amount);
  }
  return { total: round2(days.reduce((a, d) => a + d.amount, 0)), days, byYear, skipped };
}

/** Do two inclusive date ranges overlap? */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Longest run of consecutive counted calendar days (for max-consecutive-days rules, weekends bridge runs). */
export function consecutiveSpanDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}
