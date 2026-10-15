/**
 * End-of-service gratuity (pure). Defaults follow common UAE private-sector practice and are configurable
 * per company — nothing here is hard-coded labour law:
 *   - no gratuity below `minServiceYears` (1)
 *   - `daysFirstYears` (21) days' basic per year for the first `thresholdYears` (5) years
 *   - `daysAfter` (30) days' basic per year beyond that
 *   - partial years pro-rated; unpaid leave days do not count as service
 *   - total capped at `capMonths` (24) months of basic salary
 *   - daily wage = basic / 30 (DIV30) or basic × 12 / 365 (DIV365)
 */
export type GratuityConfig = {
  minServiceYears: number;
  daysFirstYears: number;
  thresholdYears: number;
  daysAfter: number;
  capMonths: number;
  dailyBasis: "DIV30" | "DIV365";
};

export const UAE_GRATUITY_DEFAULTS: GratuityConfig = { minServiceYears: 1, daysFirstYears: 21, thresholdYears: 5, daysAfter: 30, capMonths: 24, dailyBasis: "DIV30" };

export type GratuityResult = {
  serviceDays: number;
  serviceYears: number;
  eligible: boolean;
  dailyWage: number; // minor units, unrounded
  daysFirst: number;
  daysAfter: number;
  totalDays: number;
  uncapped: number;
  cap: number;
  amount: number;
  capped: boolean;
};

export function calculateGratuity(input: { basicMonthly: number; joinDate: Date; endDate: Date; unpaidLeaveDays?: number; config: GratuityConfig }): GratuityResult {
  const { config } = input;
  const serviceDays = Math.max(0, Math.round((input.endDate.getTime() - input.joinDate.getTime()) / 86_400_000) + 1 - (input.unpaidLeaveDays ?? 0));
  const serviceYears = Math.round((serviceDays / 365) * 1000) / 1000;
  const dailyWage = config.dailyBasis === "DIV365" ? (input.basicMonthly * 12) / 365 : input.basicMonthly / 30;
  const eligible = serviceYears >= config.minServiceYears;
  const firstYears = Math.min(serviceYears, config.thresholdYears);
  const laterYears = Math.max(0, serviceYears - config.thresholdYears);
  const daysFirst = Math.round(firstYears * config.daysFirstYears * 100) / 100;
  const daysAfter = Math.round(laterYears * config.daysAfter * 100) / 100;
  const totalDays = Math.round((daysFirst + daysAfter) * 100) / 100;
  const uncapped = eligible ? Math.round(dailyWage * totalDays) : 0;
  const cap = Math.round(input.basicMonthly * config.capMonths);
  const amount = Math.min(uncapped, cap);
  return { serviceDays, serviceYears, eligible, dailyWage, daysFirst, daysAfter, totalDays, uncapped, cap, amount, capped: uncapped > cap };
}
