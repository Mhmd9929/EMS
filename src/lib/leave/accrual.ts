/**
 * Entitlement and accrual rules (pure). The worker turns these into idempotent ledger entries.
 *
 * - UPFRONT: the year's entitlement is credited once, on Jan 1 or the date the employee becomes eligible
 *   (join date + accrualStartAfterMonths). Optionally pro-rated by the remaining days of the year.
 * - MONTHLY: entitlement / 12 is credited for each calendar month of eligible service, pro-rated by days
 *   for the month eligibility starts or employment ends. Months before eligibility do not accrue.
 * - NONE: no balance (unpaid leave etc.).
 */
import { round2 } from "./numbers";

export type AccrualRule = {
  accrualMethod: "UPFRONT" | "MONTHLY" | "NONE";
  annualEntitlement: number;
  accrualStartAfterMonths: number;
  prorateUpfront: boolean;
};

export type EmploymentSpan = { joinDate: Date; lastWorkingDay: Date | null };

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

/** joinDate + N calendar months (clamped to month end, e.g. 31 Aug + 6 = 28/29 Feb). */
export function addMonthsClamped(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const target = utc(y, m, 1);
  const lastDay = utc(target.getUTCFullYear(), target.getUTCMonth() + 1, 0).getUTCDate();
  return utc(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), lastDay));
}

export function eligibilityDate(rule: Pick<AccrualRule, "accrualStartAfterMonths">, joinDate: Date) {
  return rule.accrualStartAfterMonths > 0 ? addMonthsClamped(joinDate, rule.accrualStartAfterMonths) : joinDate;
}

const daysInclusive = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;

/** Days of overlap between [a1,a2] and [b1,b2] inclusive (0 if none). */
function overlapDays(a1: Date, a2: Date, b1: Date, b2: Date) {
  const s = a1 > b1 ? a1 : b1;
  const e = a2 < b2 ? a2 : b2;
  return e < s ? 0 : daysInclusive(s, e);
}

/** Credit for one calendar month (MONTHLY), or 0. `month` is 0-based. */
export function monthlyAccrual(rule: AccrualRule, span: EmploymentSpan, year: number, month: number): number {
  if (rule.accrualMethod !== "MONTHLY" || rule.annualEntitlement <= 0) return 0;
  const monthStart = utc(year, month, 1);
  const monthEnd = utc(year, month + 1, 0);
  const from = eligibilityDate(rule, span.joinDate);
  const to = span.lastWorkingDay ?? monthEnd;
  const covered = overlapDays(monthStart, monthEnd, from, to);
  if (!covered) return 0;
  const perMonth = rule.annualEntitlement / 12;
  return round2((perMonth * covered) / daysInclusive(monthStart, monthEnd));
}

/** UPFRONT credit for a year: { amount, effectiveDate } or null when not eligible that year. */
export function upfrontEntitlement(rule: AccrualRule, span: EmploymentSpan, year: number): { amount: number; effectiveDate: Date } | null {
  if (rule.accrualMethod !== "UPFRONT" || rule.annualEntitlement <= 0) return null;
  const yearStart = utc(year, 0, 1);
  const yearEnd = utc(year, 11, 31);
  const eligible = eligibilityDate(rule, span.joinDate);
  if (eligible > yearEnd) return null;
  if (span.lastWorkingDay && span.lastWorkingDay < yearStart) return null;
  const effectiveDate = eligible > yearStart ? eligible : yearStart;
  if (!rule.prorateUpfront || effectiveDate.getTime() === yearStart.getTime()) {
    return { amount: round2(rule.annualEntitlement), effectiveDate };
  }
  const fraction = daysInclusive(effectiveDate, yearEnd) / daysInclusive(yearStart, yearEnd);
  return { amount: round2(rule.annualEntitlement * fraction), effectiveDate };
}

/** Months (0-based) of `year` that are complete as of `asOf` — accrual is credited after a month ends. */
export function completedMonths(year: number, asOf: Date): number[] {
  const out: number[] = [];
  for (let m = 0; m < 12; m++) {
    if (utc(year, m + 1, 1) <= asOf) out.push(m);
  }
  return out;
}

/** Expected accrual entries for `year` up to `asOf`, keyed by idempotency period key. */
export function expectedCredits(rule: AccrualRule, span: EmploymentSpan, year: number, asOf: Date) {
  const credits: { periodKey: string; kind: "ENTITLEMENT" | "ACCRUAL"; amount: number; effectiveDate: Date }[] = [];
  if (rule.accrualMethod === "UPFRONT") {
    const ent = upfrontEntitlement(rule, span, year);
    if (ent && ent.effectiveDate <= asOf) credits.push({ periodKey: `ent-${year}`, kind: "ENTITLEMENT", amount: ent.amount, effectiveDate: ent.effectiveDate });
  } else if (rule.accrualMethod === "MONTHLY") {
    for (const m of completedMonths(year, asOf)) {
      const amount = monthlyAccrual(rule, span, year, m);
      if (amount > 0) {
        credits.push({ periodKey: `acc-${year}-${String(m + 1).padStart(2, "0")}`, kind: "ACCRUAL", amount, effectiveDate: utc(year, m + 1, 0) });
      }
    }
  }
  return credits;
}
