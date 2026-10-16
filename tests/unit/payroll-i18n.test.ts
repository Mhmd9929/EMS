import { describe, expect, it } from "vitest";
import { issueText, parseLineNote, type PayrollTranslator } from "@/lib/payroll/issues";

const fake = (known: Record<string, string>) =>
  Object.assign((key: string, values?: Record<string, unknown>) => `${known[key]}|${JSON.stringify(values ?? {})}`, { has: (key: string) => key in known }) as unknown as PayrollTranslator;

describe("payroll display-time translation", () => {
  it("recognises the calculation engine's line notes", () => {
    expect(parseLineNote("Pro-rated 17/31 days")).toEqual({ key: "prorated", params: { paid: 17, basis: 31 } });
    expect(parseLineNote("Salary change on 2026-10-16; 30/30 days")).toEqual({ key: "salaryChange", params: { date: "2026-10-16", paid: 30, basis: 30 } });
    expect(parseLineNote("1 day × daily rate (30-day basis)")).toEqual({ key: "unpaidLeave", params: { days: 1, basis: 30 } });
    expect(parseLineNote("2.5 days × daily rate (31-day basis)")).toEqual({ key: "unpaidLeave", params: { days: 2.5, basis: 31 } });
    expect(parseLineNote("Q3 bonus")).toBeNull();
  });

  it("translates coded issues and falls back to the stored message", () => {
    const t = fake({ "issues.noIban": "X" });
    expect(issueText({ level: "error", code: "noIban", message: "No IBAN" }, t)).toBe("X|{}");
    expect(issueText({ level: "error", message: "Legacy text" }, t)).toBe("Legacy text");
    expect(issueText({ level: "error", code: "unknownCode", message: "Fallback" }, t)).toBe("Fallback");
  });
});
