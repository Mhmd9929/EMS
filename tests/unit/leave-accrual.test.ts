import { describe, expect, it } from "vitest";
import { addMonthsClamped, completedMonths, eligibilityDate, expectedCredits, monthlyAccrual, upfrontEntitlement, type AccrualRule } from "@/lib/leave/accrual";
import { carryForwardExpiry, computeBalance, yearEndCarry } from "@/lib/leave/balance";
import { effectiveRules, matchPolicy, type PolicyLike } from "@/lib/leave/policy";
import { parseDateOnly as d, toDateInput } from "@/lib/dates";
import { sum } from "@/lib/leave/numbers";

const annual: AccrualRule = { accrualMethod: "MONTHLY", annualEntitlement: 30, accrualStartAfterMonths: 6, prorateUpfront: false };
const sick: AccrualRule = { accrualMethod: "UPFRONT", annualEntitlement: 15, accrualStartAfterMonths: 0, prorateUpfront: false };

describe("eligibility", () => {
  it("adds months, clamping to month end", () => {
    expect(toDateInput(addMonthsClamped(d("2026-08-31")!, 6))).toBe("2027-02-28");
    expect(toDateInput(addMonthsClamped(d("2027-08-31")!, 6))).toBe("2028-02-29");
    expect(toDateInput(eligibilityDate(annual, d("2026-01-15")!))).toBe("2026-07-15");
  });
});

describe("monthly accrual (Annual: 30/yr, 2.5/month after 6 months)", () => {
  const longServing = { joinDate: d("2020-03-01")!, lastWorkingDay: null };

  it("credits 2.5 days for every full month", () => {
    expect(monthlyAccrual(annual, longServing, 2026, 0)).toBe(2.5);
    const year = sum(Array.from({ length: 12 }, (_, m) => monthlyAccrual(annual, longServing, 2026, m)));
    expect(year).toBe(30);
  });

  it("does not accrue during the first 6 months and pro-rates the month eligibility starts", () => {
    const joiner = { joinDate: d("2026-01-15")!, lastWorkingDay: null }; // eligible 15 Jul
    expect(monthlyAccrual(annual, joiner, 2026, 5)).toBe(0); // June
    expect(monthlyAccrual(annual, joiner, 2026, 6)).toBe(1.37); // 17/31 of 2.5
    expect(monthlyAccrual(annual, joiner, 2026, 7)).toBe(2.5); // August
  });

  it("stops at the last working day (pro-rated)", () => {
    const leaver = { joinDate: d("2020-03-01")!, lastWorkingDay: d("2026-04-15")! };
    expect(monthlyAccrual(annual, leaver, 2026, 3)).toBe(1.25); // 15/30 of 2.5
    expect(monthlyAccrual(annual, leaver, 2026, 4)).toBe(0);
  });

  it("only credits months that have ended", () => {
    expect(completedMonths(2026, d("2026-10-14")!)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(completedMonths(2026, d("2027-01-01")!)).toHaveLength(12);
    const credits = expectedCredits(annual, longServing, 2026, d("2026-03-01")!);
    expect(credits.map((c) => c.periodKey)).toEqual(["acc-2026-01", "acc-2026-02"]);
    expect(toDateInput(credits[1].effectiveDate)).toBe("2026-02-28");
  });
});

describe("upfront entitlement", () => {
  it("credits the full amount on 1 January", () => {
    const e = upfrontEntitlement(sick, { joinDate: d("2020-01-01")!, lastWorkingDay: null }, 2026);
    expect(e?.amount).toBe(15);
    expect(toDateInput(e!.effectiveDate)).toBe("2026-01-01");
  });

  it("credits joiners on their eligibility date, pro-rated only when configured", () => {
    const joiner = { joinDate: d("2026-07-02")!, lastWorkingDay: null };
    expect(upfrontEntitlement(sick, joiner, 2026)?.amount).toBe(15);
    expect(upfrontEntitlement({ ...sick, prorateUpfront: true }, joiner, 2026)?.amount).toBe(7.52); // 15 × 183/365
  });

  it("gives nothing before eligibility or after leaving", () => {
    expect(upfrontEntitlement({ ...sick, accrualStartAfterMonths: 12 }, { joinDate: d("2026-03-01")!, lastWorkingDay: null }, 2026)).toBeNull();
    expect(upfrontEntitlement(sick, { joinDate: d("2020-03-01")!, lastWorkingDay: d("2025-06-30")! }, 2026)).toBeNull();
  });

  it("is not credited before its effective date", () => {
    expect(expectedCredits(sick, { joinDate: d("2026-11-01")!, lastWorkingDay: null }, 2026, d("2026-10-14")!)).toEqual([]);
  });
});

describe("balances and year end", () => {
  it("computes available from ledger, taken and pending", () => {
    const b = computeBalance({
      entitled: 30,
      ledger: [
        { kind: "ACCRUAL", days: 2.5 },
        { kind: "ACCRUAL", days: 2.5 },
        { kind: "CARRY_FORWARD", days: 5 },
        { kind: "ADJUSTMENT", days: -1 },
        { kind: "CARRY_FORWARD_EXPIRY", days: -2 },
      ],
      takenDays: 3,
      pendingDays: 0.5,
    });
    expect(b).toMatchObject({ accrued: 5, carriedForward: 5, adjustments: -1, expired: 2, taken: 3, pending: 0.5, available: 3.5 });
  });

  it("caps carry-forward and lapses the rest; carries debts in full", () => {
    expect(yearEndCarry(12.5, 5)).toEqual({ carry: 5, lapse: 7.5 });
    expect(yearEndCarry(3, 5)).toEqual({ carry: 3, lapse: 0 });
    expect(yearEndCarry(4, 0)).toEqual({ carry: 0, lapse: 4 });
    expect(yearEndCarry(-2, 5)).toEqual({ carry: -2, lapse: 0 });
  });

  it("expires unused carried-forward days, consuming them first", () => {
    expect(carryForwardExpiry(5, 2)).toBe(3);
    expect(carryForwardExpiry(5, 8)).toBe(0);
  });
});

describe("leave policies", () => {
  const base: PolicyLike = { id: "", leaveTypeId: "annual", departmentId: null, positionId: null, employmentType: null, isEligible: true, annualEntitlement: null, isActive: true };
  const policies: PolicyLike[] = [
    { ...base, id: "contract", employmentType: "CONTRACT", annualEntitlement: 22 },
    { ...base, id: "eng", departmentId: "eng", annualEntitlement: 25 },
    { ...base, id: "eng-contract", departmentId: "eng", employmentType: "CONTRACT", annualEntitlement: 20 },
    { ...base, id: "inactive", departmentId: "eng", positionId: "lead", annualEntitlement: 99, isActive: false },
  ];
  const facts = { departmentId: "eng", positionId: "lead", employmentType: "CONTRACT", gender: "FEMALE", joinDate: d("2024-01-01")! };

  it("picks the most specific active policy", () => {
    expect(matchPolicy(policies, "annual", facts)?.id).toBe("eng-contract");
    expect(matchPolicy(policies, "annual", { ...facts, employmentType: "FULL_TIME" })?.id).toBe("eng");
    expect(matchPolicy(policies, "annual", { ...facts, departmentId: "fin" })?.id).toBe("contract");
    expect(matchPolicy(policies, "sick", facts)).toBeNull();
  });

  it("applies gender eligibility and policy exclusions", () => {
    const paternity = { id: "pat", annualEntitlement: 5, genderEligibility: "MALE", accrualStartAfterMonths: 0, accrualMethod: "UPFRONT" as const };
    expect(effectiveRules(paternity, [], facts).eligible).toBe(false);
    const annualType = { id: "annual", annualEntitlement: 30, genderEligibility: null, accrualStartAfterMonths: 6, accrualMethod: "MONTHLY" as const };
    expect(effectiveRules(annualType, policies, facts)).toMatchObject({ eligible: true, entitlement: 20 });
    const excluded = [{ ...base, id: "x", employmentType: "CONTRACT", isEligible: false }];
    expect(effectiveRules(annualType, excluded, facts).eligible).toBe(false);
  });
});
