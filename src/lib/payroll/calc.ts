/**
 * Payroll calculation engine (pure). All amounts are integers in minor units (fils).
 *
 * 1. Employment window in the period = [max(periodStart, joinDate), min(periodEnd, lastWorkingDay)].
 * 2. The window is split into segments by salary-structure effective dates (salary history).
 * 3. Each recurring component's monthly amount (fixed, or formula over other components) is pro-rated:
 *      CALENDAR_DAYS: monthly × segment days / days in month
 *      THIRTY_DAYS:   monthly / 30 × paid days, where a full month = 30 paid days and a partial month
 *                     pays the calendar days worked (max 30)
 * 4. Unpaid leave: (monthly recurring earnings / days basis) × unpaid days, capped at the earnings paid.
 * 5. One-time adjustments (bonus, overtime, deductions …) are added as-is.
 */
import { resolveFormulas, FormulaError } from "./formula";
import { decimalsOf } from "./money";

export type ProrationBasis = "CALENDAR_DAYS" | "THIRTY_DAYS";

export type ComponentDef = {
  code: string;
  name: string;
  kind: "EARNING" | "DEDUCTION";
  calcType: "FIXED" | "FORMULA";
  formula: string | null;
  isRecurring: boolean;
  isFixedPay: boolean;
  sortOrder: number;
};

export type StructureInput = { effectiveFrom: Date; lines: { code: string; amount: number | null }[] };

export type CalcInput = {
  periodStart: Date;
  periodEnd: Date;
  basis: ProrationBasis;
  currency: string;
  joinDate: Date;
  lastWorkingDay: Date | null;
  components: ComponentDef[];
  /** all of the employee's structures (any order) */
  structures: StructureInput[];
  unpaidLeaveDays: number;
  adjustments: { code: string; amount: number; description: string }[];
};

export type CalcLine = {
  code: string;
  name: string;
  kind: "EARNING" | "DEDUCTION";
  amount: number;
  note: string | null;
  isRecurring: boolean;
  isFixedPay: boolean;
  sortOrder: number;
};

export type CalcIssue = { level: "error" | "warning"; message: string };

export type CalcResult = {
  payable: boolean;
  calendarDays: number;
  paidDays: number;
  unpaidLeaveDays: number;
  lines: CalcLine[];
  gross: number;
  deductions: number;
  net: number;
  fixedPay: number;
  variablePay: number;
  /** full-month recurring earnings of the latest structure (used for variance and settlements) */
  monthlyRecurring: number;
  issues: CalcIssue[];
};

export const UNPAID_LEAVE_CODE = "UNPAID_LEAVE";
const DAY = 86_400_000;
const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY) + 1;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monthly amounts (minor units) of every component in a structure, formulas resolved. */
export function structureMonthlyAmounts(structure: StructureInput, components: ComponentDef[], currency: string): Record<string, number> {
  const byCode = new Map(components.map((c) => [c.code, c]));
  const scale = 10 ** decimalsOf(currency);
  const fixed: Record<string, number> = {};
  const formulas: Record<string, string> = {};
  for (const line of structure.lines) {
    const c = byCode.get(line.code);
    if (!c) throw new FormulaError(`Unknown pay component ${line.code}`);
    if (c.calcType === "FORMULA") {
      if (!c.formula) throw new FormulaError(`${c.name} has no formula`);
      formulas[c.code] = c.formula;
    } else {
      fixed[c.code] = (line.amount ?? 0) / scale;
    }
  }
  const major = resolveFormulas(fixed, formulas);
  return Object.fromEntries(Object.entries(major).map(([code, v]) => [code, Math.round(v * scale)]));
}

export function calculatePay(input: CalcInput): CalcResult {
  const issues: CalcIssue[] = [];
  const daysInMonth = days(input.periodStart, input.periodEnd);
  const from = input.joinDate > input.periodStart ? input.joinDate : input.periodStart;
  const to = input.lastWorkingDay && input.lastWorkingDay < input.periodEnd ? input.lastWorkingDay : input.periodEnd;
  const empty = (payable: boolean): CalcResult => ({
    payable, calendarDays: 0, paidDays: 0, unpaidLeaveDays: 0, lines: [], gross: 0, deductions: 0, net: 0, fixedPay: 0, variablePay: 0, monthlyRecurring: 0, issues,
  });
  if (to < from) return empty(false);

  const fullMonth = from.getTime() === input.periodStart.getTime() && to.getTime() === input.periodEnd.getTime();
  const windowDays = days(from, to);
  const byCode = new Map(input.components.map((c) => [c.code, c]));

  // ── Segments by salary structure ──
  const sorted = [...input.structures].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
  const active = sorted.filter((s) => s.effectiveFrom <= to);
  const segments: { start: Date; end: Date; structure: StructureInput }[] = [];
  for (let i = 0; i < active.length; i++) {
    const s = active[i];
    const nextStart = active[i + 1]?.effectiveFrom;
    const segStart = s.effectiveFrom > from ? s.effectiveFrom : from;
    const segEnd = nextStart ? new Date(Math.min(to.getTime(), nextStart.getTime() - DAY)) : to;
    if (segEnd >= segStart) segments.push({ start: segStart, end: segEnd, structure: s });
  }
  if (!segments.length) {
    issues.push({ level: "error", message: "No salary structure in effect for this period" });
    return { ...empty(true), calendarDays: windowDays };
  }
  if (segments[0].start > from) {
    issues.push({ level: "warning", message: `No salary structure before ${segments[0].start.toISOString().slice(0, 10)} — those days are unpaid` });
  }

  // ── Paid days per segment ──
  const segDays = segments.map((s) => days(s.start, s.end));
  let paidPerSegment: number[];
  if (input.basis === "CALENDAR_DAYS") {
    paidPerSegment = segDays;
  } else if (fullMonth) {
    paidPerSegment = segDays.map((d) => round2((d * 30) / daysInMonth));
    paidPerSegment[paidPerSegment.length - 1] = round2(30 - paidPerSegment.slice(0, -1).reduce((a, b) => a + b, 0));
  } else {
    let remaining = 30;
    paidPerSegment = segDays.map((d) => {
      const p = Math.min(d, remaining);
      remaining -= p;
      return p;
    });
  }
  const divisor = input.basis === "CALENDAR_DAYS" ? daysInMonth : 30;
  const paidDays = round2(paidPerSegment.reduce((a, b) => a + b, 0));

  // ── Recurring components ──
  const lines = new Map<string, CalcLine>();
  let lastMonthly: Record<string, number> = {};
  segments.forEach((seg, i) => {
    let monthly: Record<string, number>;
    try {
      monthly = structureMonthlyAmounts(seg.structure, input.components, input.currency);
    } catch (e) {
      issues.push({ level: "error", message: e instanceof Error ? e.message : "Formula error" });
      monthly = {};
    }
    lastMonthly = monthly;
    for (const [code, amount] of Object.entries(monthly)) {
      const c = byCode.get(code)!;
      const prorated = Math.round((amount * paidPerSegment[i]) / divisor);
      const existing = lines.get(code);
      if (existing) existing.amount += prorated;
      else lines.set(code, { code, name: c.name, kind: c.kind, amount: prorated, note: null, isRecurring: true, isFixedPay: c.isFixedPay, sortOrder: c.sortOrder });
    }
  });
  const partial = paidDays < divisor || segments.length > 1;
  if (partial) {
    const note = segments.length > 1 ? `Salary change on ${segments[1].start.toISOString().slice(0, 10)}; ${paidDays}/${divisor} days` : `Pro-rated ${paidDays}/${divisor} days`;
    for (const l of lines.values()) l.note = note;
  }

  // ── Unpaid leave ──
  const unpaidLeaveDays = round2(Math.max(0, Math.min(input.unpaidLeaveDays, paidDays)));
  const monthlyRecurring = Object.entries(lastMonthly).reduce((a, [code, v]) => a + (byCode.get(code)?.kind === "EARNING" ? v : 0), 0);
  if (unpaidLeaveDays > 0) {
    const recurringPaid = [...lines.values()].filter((l) => l.kind === "EARNING").reduce((a, l) => a + l.amount, 0);
    const amount = Math.min(recurringPaid, Math.round((monthlyRecurring / divisor) * unpaidLeaveDays));
    const c = byCode.get(UNPAID_LEAVE_CODE);
    lines.set(UNPAID_LEAVE_CODE, {
      code: UNPAID_LEAVE_CODE,
      name: c?.name ?? "Unpaid leave",
      kind: "DEDUCTION",
      amount,
      note: `${unpaidLeaveDays} day${unpaidLeaveDays === 1 ? "" : "s"} × daily rate (${divisor}-day basis)`,
      isRecurring: true,
      isFixedPay: true,
      sortOrder: c?.sortOrder ?? 900,
    });
  }

  // ── One-time adjustments ──
  const oneTime: CalcLine[] = [];
  for (const a of input.adjustments) {
    const c = byCode.get(a.code);
    if (!c) {
      issues.push({ level: "error", message: `Unknown component ${a.code} on an adjustment` });
      continue;
    }
    oneTime.push({ code: c.code, name: c.name, kind: c.kind, amount: a.amount, note: a.description, isRecurring: false, isFixedPay: false, sortOrder: c.sortOrder });
  }

  const all = [...lines.values(), ...oneTime].filter((l) => l.amount !== 0).sort((a, b) => (a.kind === b.kind ? a.sortOrder - b.sortOrder : a.kind === "EARNING" ? -1 : 1));
  const gross = all.filter((l) => l.kind === "EARNING").reduce((a, l) => a + l.amount, 0);
  const deductions = all.filter((l) => l.kind === "DEDUCTION").reduce((a, l) => a + l.amount, 0);
  const net = gross - deductions;
  const fixedPay = all.filter((l) => l.isFixedPay).reduce((a, l) => a + (l.kind === "EARNING" ? l.amount : -l.amount), 0);
  if (net < 0) issues.push({ level: "error", message: "Net pay is negative" });
  if (gross === 0 && !issues.some((i) => i.level === "error")) issues.push({ level: "warning", message: "Gross pay is zero" });

  return {
    payable: true,
    calendarDays: windowDays,
    paidDays,
    unpaidLeaveDays,
    lines: all,
    gross,
    deductions,
    net,
    fixedPay: Math.max(0, Math.min(fixedPay, net)),
    variablePay: net - Math.max(0, Math.min(fixedPay, net)),
    monthlyRecurring,
    issues,
  };
}

/** Period helpers: "2026-10" → first/last day (UTC dates). */
export function periodBounds(period: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) throw new RangeError(`Invalid period ${period}`);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) throw new RangeError(`Invalid period ${period}`);
  return { start: new Date(Date.UTC(y, mo, 1)), end: new Date(Date.UTC(y, mo + 1, 0)) };
}

export function previousPeriod(period: string) {
  const { start } = periodBounds(period);
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodLabel(period: string) {
  const { start } = periodBounds(period);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(start);
}

/** Percentage change, null when there is no previous amount. */
export function variancePct(net: number, previous: number | null) {
  if (previous === null || previous === 0) return null;
  return Math.round(((net - previous) / Math.abs(previous)) * 1000) / 10;
}
