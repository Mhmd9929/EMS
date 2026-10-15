import { describe, expect, it } from "vitest";
import { calculatePay, periodBounds, previousPeriod, variancePct, type CalcInput, type ComponentDef } from "@/lib/payroll/calc";
import { evaluateFormula, FormulaError, formulaVariables, resolveFormulas } from "@/lib/payroll/formula";
import { formatMoney, minorToDecimalString, toMinor } from "@/lib/payroll/money";
import { calculateGratuity, UAE_GRATUITY_DEFAULTS } from "@/lib/payroll/gratuity";
import { amountInWords, integerInWords } from "@/lib/payroll/words";
import { buildSif } from "@/lib/payroll/sif";
import { parseDateOnly as d } from "@/lib/dates";

const C = (code: string, kind: "EARNING" | "DEDUCTION", extra: Partial<ComponentDef> = {}): ComponentDef => ({
  code, name: code, kind, calcType: "FIXED", formula: null, isRecurring: true, isFixedPay: true, sortOrder: 0, ...extra,
});
const components: ComponentDef[] = [
  C("BASIC", "EARNING", { sortOrder: 1 }),
  C("HOUSING", "EARNING", { calcType: "FORMULA", formula: "BASIC * 0.25", sortOrder: 2 }),
  C("TRANSPORT", "EARNING", { sortOrder: 3 }),
  C("BONUS", "EARNING", { isRecurring: false, isFixedPay: false, sortOrder: 10 }),
  C("LOAN", "DEDUCTION", { isRecurring: false, sortOrder: 20 }),
  C("UNPAID_LEAVE", "DEDUCTION", { name: "Unpaid leave", sortOrder: 30 }),
];
const AED = (n: number) => n * 100;
const structure = (from: string, basic: number, transport = 1000) => ({
  effectiveFrom: d(from)!,
  lines: [
    { code: "BASIC", amount: AED(basic) },
    { code: "HOUSING", amount: null },
    { code: "TRANSPORT", amount: AED(transport) },
  ],
});
const base = (overrides: Partial<CalcInput> = {}): CalcInput => ({
  periodStart: d("2026-10-01")!,
  periodEnd: d("2026-10-31")!,
  basis: "CALENDAR_DAYS",
  currency: "AED",
  joinDate: d("2020-01-01")!,
  lastWorkingDay: null,
  components,
  structures: [structure("2020-01-01", 10000)],
  unpaidLeaveDays: 0,
  adjustments: [],
  ...overrides,
});
const line = (r: ReturnType<typeof calculatePay>, code: string) => r.lines.find((l) => l.code === code)?.amount;

describe("money", () => {
  it("converts decimal strings exactly", () => {
    expect(toMinor("1,234.5", "AED")).toBe(123450);
    expect(toMinor("0.1", "AED") + toMinor("0.2", "AED")).toBe(30);
    expect(toMinor("1.234", "KWD")).toBe(1234);
    expect(() => toMinor("1.234", "AED")).toThrow();
    expect(() => toMinor("abc", "AED")).toThrow();
    expect(minorToDecimalString(123405, "AED")).toBe("1234.05");
    expect(formatMoney(123450, "AED")).toBe("AED 1,234.50");
  });
});

describe("formula", () => {
  it("evaluates arithmetic with variables and functions", () => {
    expect(evaluateFormula("BASIC * 0.25", { BASIC: 10000 })).toBe(2500);
    expect(evaluateFormula("min(BASIC * 0.1, 500) + round(2.345, 2)", { BASIC: 10000 })).toBe(502.35);
    expect(evaluateFormula("-(1 + 2) * 3", {})).toBe(-9);
    expect(formulaVariables("BASIC + housing * 2")).toEqual(["BASIC", "HOUSING"]);
  });

  it("rejects unsafe or invalid input", () => {
    for (const bad of ["process.exit()", "BASIC; 1", "1 +", "foo(1)", "BASIC ** 2", "`1`"]) {
      expect(() => evaluateFormula(bad, { BASIC: 1 })).toThrow(FormulaError);
    }
    expect(() => evaluateFormula("UNKNOWN * 2", {})).toThrow(/Unknown component/);
    expect(() => evaluateFormula("1 / 0", {})).toThrow(/Division by zero/);
  });

  it("resolves dependent formulas and detects cycles", () => {
    expect(resolveFormulas({ BASIC: 1000 }, { A: "B + 1", B: "BASIC * 2" })).toMatchObject({ A: 2001, B: 2000 });
    expect(() => resolveFormulas({}, { A: "B", B: "A" })).toThrow(/Circular/);
  });
});

describe("payroll calculation", () => {
  it("pays the full month with formula components", () => {
    const r = calculatePay(base());
    expect(line(r, "BASIC")).toBe(AED(10000));
    expect(line(r, "HOUSING")).toBe(AED(2500));
    expect(r.gross).toBe(AED(13500));
    expect(r.net).toBe(AED(13500));
    expect(r.paidDays).toBe(31);
    expect(r.issues).toEqual([]);
  });

  it("pro-rates a mid-month joiner (calendar days)", () => {
    const r = calculatePay(base({ joinDate: d("2026-10-15")! }));
    expect(r.paidDays).toBe(17);
    expect(line(r, "BASIC")).toBe(Math.round((AED(10000) * 17) / 31));
    expect(r.lines[0].note).toMatch(/Pro-rated 17\/31/);
  });

  it("pro-rates on a 30-day basis: full month = 30, partial = days worked", () => {
    expect(calculatePay(base({ basis: "THIRTY_DAYS" })).gross).toBe(AED(13500));
    const feb = calculatePay(base({ basis: "THIRTY_DAYS", periodStart: d("2026-02-01")!, periodEnd: d("2026-02-28")! }));
    expect(feb.gross).toBe(AED(13500));
    expect(feb.paidDays).toBe(30);
    const leaver = calculatePay(base({ basis: "THIRTY_DAYS", lastWorkingDay: d("2026-10-10")! }));
    expect(leaver.paidDays).toBe(10);
    expect(line(leaver, "BASIC")).toBe(Math.round((AED(10000) * 10) / 30));
  });

  it("is not payable outside the employment window", () => {
    expect(calculatePay(base({ joinDate: d("2026-11-01")! })).payable).toBe(false);
    expect(calculatePay(base({ lastWorkingDay: d("2026-09-30")! })).payable).toBe(false);
  });

  it("splits a mid-month salary change into segments", () => {
    const r = calculatePay(base({ structures: [structure("2020-01-01", 10000), structure("2026-10-16", 12000)] }));
    const expected = Math.round((AED(10000) * 15) / 31) + Math.round((AED(12000) * 16) / 31);
    expect(line(r, "BASIC")).toBe(expected);
    expect(r.lines[0].note).toMatch(/Salary change on 2026-10-16/);
    expect(r.monthlyRecurring).toBe(AED(16000)); // latest structure: 12000 + 3000 + 1000
  });

  it("ignores future structures and flags a missing structure", () => {
    expect(calculatePay(base({ structures: [structure("2020-01-01", 10000), structure("2026-11-01", 20000)] })).gross).toBe(AED(13500));
    const none = calculatePay(base({ structures: [] }));
    expect(none.issues[0]).toMatchObject({ level: "error" });
    expect(none.net).toBe(0);
  });

  it("deducts unpaid leave at the daily rate of recurring earnings", () => {
    const r = calculatePay(base({ unpaidLeaveDays: 2.5 }));
    expect(line(r, "UNPAID_LEAVE")).toBe(Math.round((AED(13500) / 31) * 2.5));
    expect(r.net).toBe(r.gross - line(r, "UNPAID_LEAVE")!);
    const thirty = calculatePay(base({ basis: "THIRTY_DAYS", unpaidLeaveDays: 3 }));
    expect(line(thirty, "UNPAID_LEAVE")).toBe(AED(1350));
  });

  it("caps the unpaid deduction at the earnings paid", () => {
    const r = calculatePay(base({ joinDate: d("2026-10-30")!, unpaidLeaveDays: 10 }));
    expect(r.net).toBe(0);
  });

  it("applies one-time adjustments as variable pay and flags negative net", () => {
    const r = calculatePay(base({ adjustments: [{ code: "BONUS", amount: AED(2000), description: "Q3 bonus" }, { code: "LOAN", amount: AED(500), description: "Instalment 2/10" }] }));
    expect(r.gross).toBe(AED(15500));
    expect(r.deductions).toBe(AED(500));
    expect(r.net).toBe(AED(15000));
    expect(r.fixedPay).toBe(AED(13500));
    expect(r.variablePay).toBe(AED(1500));
    const negative = calculatePay(base({ adjustments: [{ code: "LOAN", amount: AED(20000), description: "x" }] }));
    expect(negative.issues.some((i) => i.message.includes("negative"))).toBe(true);
  });
});

describe("periods", () => {
  it("handles month bounds and variance", () => {
    expect(periodBounds("2028-02").end.toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(previousPeriod("2026-01")).toBe("2025-12");
    expect(() => periodBounds("2026-13")).toThrow();
    expect(variancePct(11000, 10000)).toBe(10);
    expect(variancePct(100, null)).toBeNull();
  });
});

describe("gratuity", () => {
  const g = (join: string, end: string, extra = {}) => calculateGratuity({ basicMonthly: AED(10000), joinDate: d(join)!, endDate: d(end)!, config: UAE_GRATUITY_DEFAULTS, ...extra });

  it("is zero below one year of service", () => {
    expect(g("2026-01-01", "2026-10-31").amount).toBe(0);
  });

  it("pays 21 days per year for the first 5 years", () => {
    const r = g("2023-01-01", "2025-12-31"); // 3 years (1096 days incl. leap day)
    expect(r.serviceYears).toBeCloseTo(3.003, 3);
    expect(r.totalDays).toBeCloseTo(63.06, 2);
    expect(r.amount).toBe(Math.round((AED(10000) / 30) * r.totalDays));
  });

  it("pays 30 days per year after 5 years and caps at 24 months' basic", () => {
    const r = g("2016-01-01", "2025-12-31"); // ~10 years
    expect(r.daysFirst).toBeCloseTo(105, 0);
    expect(r.daysAfter).toBeGreaterThan(149);
    const capped = g("1990-01-01", "2025-12-31");
    expect(capped.capped).toBe(true);
    expect(capped.amount).toBe(AED(240000));
  });

  it("excludes unpaid leave from service and supports the 365-day basis", () => {
    expect(g("2024-01-01", "2025-01-10", { unpaidLeaveDays: 20 }).eligible).toBe(false);
    const r = calculateGratuity({ basicMonthly: AED(10000), joinDate: d("2020-01-01")!, endDate: d("2024-12-31")!, config: { ...UAE_GRATUITY_DEFAULTS, dailyBasis: "DIV365" } });
    expect(r.dailyWage).toBeCloseTo((AED(10000) * 12) / 365, 6);
  });
});

describe("amount in words", () => {
  it("spells out amounts with currency units", () => {
    expect(integerInWords(0)).toBe("Zero");
    expect(integerInWords(1_234_567)).toBe("One Million Two Hundred Thirty-Four Thousand Five Hundred Sixty-Seven");
    expect(amountInWords(1234550, "AED")).toBe("Twelve Thousand Three Hundred Forty-Five UAE Dirhams and Fifty Fils Only");
    expect(amountInWords(100, "AED")).toBe("One UAE Dirham Only");
  });
});

describe("WPS SIF", () => {
  const row = { employeeNumber: "E1", name: "A", personId: "12345678", routingCode: "302620122", iban: "AE070331234567890123456", payStart: d("2026-10-01")!, payEnd: d("2026-10-31")!, days: 31, fixed: 1350000, variable: 50000, leaveDays: 0 };
  const header = { employerId: "1234567890123", employerBankCode: "302620122", period: "2026-10", currency: "AED", createdAt: new Date("2026-10-28T09:05:07Z"), reference: "OCT-2026" };

  it("builds EDR and SCR records with totals", () => {
    const r = buildSif("UAE_SIF_V1", header, [row]);
    const [edr, scr] = r.content.trim().split("\r\n");
    expect(edr).toBe("EDR,00000012345678,302620122,AE070331234567890123456,2026-10-01,2026-10-31,31,13500.00,500.00,0");
    expect(scr).toBe("SCR,1234567890123,302620122,2026-10-28,0905,102026,1,14000.00,AED,OCT-2026");
    expect(r.fileName).toBe("1234567890123261028090507.SIF");
    expect(r.errors).toEqual([]);
  });

  it("reports missing employer and employee data", () => {
    const r = buildSif("UAE_SIF_V1", { ...header, employerId: null }, [{ ...row, routingCode: null, iban: null }]);
    expect(r.errors).toHaveLength(3);
  });
});
