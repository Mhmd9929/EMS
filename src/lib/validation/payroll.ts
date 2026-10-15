import { z } from "zod";
import { checkbox, nullableString, requiredDate, requiredString } from "./common";

const toArray = (v: unknown) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]);
/** Money as entered (major units, e.g. "12,500.50") → kept as a string; converted with the company currency. */
const moneyString = z
  .string({ error: "Required" })
  .trim()
  .transform((v) => v.replace(/,/g, ""))
  .refine((v) => /^\d+(\.\d{1,3})?$/.test(v), "Enter an amount, e.g. 1500 or 1500.50");

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const periodSchema = z.string().regex(PERIOD_RE, "Pick a month");

export const payComponentSchema = z.object({
  id: z.preprocess((v) => (v === "" ? null : v), z.string().nullable()),
  code: z.string().trim().toUpperCase().min(2, "Required").max(30).regex(/^[A-Z][A-Z0-9_]*$/, "Letters, numbers and _; start with a letter"),
  name: requiredString(80),
  kind: z.enum(["EARNING", "DEDUCTION"]),
  calcType: z.enum(["FIXED", "FORMULA"]),
  formula: nullableString(500),
  isRecurring: checkbox,
  isTaxable: checkbox,
  isFixedPay: checkbox,
  isActive: checkbox,
});

export const payrollSettingsSchema = z.object({
  payrollProrationBasis: z.enum(["CALENDAR_DAYS", "THIRTY_DAYS"]),
  wpsEmployerId: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{13}$/, "13 digits").nullable()),
  wpsEmployerBankCode: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{9}$/, "9 digits").nullable()),
  wpsFormat: z.enum(["UAE_SIF_V1"]),
  gratuityMinServiceYears: z.coerce.number().min(0).max(10),
  gratuityDaysFirstYears: z.coerce.number().min(0).max(60),
  gratuityThresholdYears: z.coerce.number().min(0).max(40),
  gratuityDaysAfter: z.coerce.number().min(0).max(60),
  gratuityCapMonths: z.coerce.number().min(0).max(120),
  gratuityDailyBasis: z.enum(["DIV30", "DIV365"]),
  leaveEncashmentBasis: z.enum(["BASIC", "GROSS"]),
  payslipPdfPassword: checkbox,
});

export const salaryStructureSchema = z.object({
  employeeId: z.string().min(1),
  effectiveFrom: requiredDate,
  reason: requiredString(300),
  componentIds: z.preprocess(toArray, z.array(z.string().min(1)).min(1, "Add at least one component")),
  amounts: z.preprocess(toArray, z.array(z.string())),
});

export const adjustmentSchema = z.object({
  employeeId: z.string().min(1, "Choose an employee"),
  period: periodSchema,
  componentId: z.string().min(1, "Choose a component"),
  amount: moneyString,
  description: requiredString(200),
});

export const createRunSchema = z.object({
  period: periodSchema,
  scope: z.enum(["ALL", "DEPARTMENT", "LOCATION"]),
  scopeId: z.preprocess((v) => (v === "" ? null : v), z.string().nullable()),
  notes: nullableString(500),
});

export const runReasonSchema = z.object({ runId: z.string().min(1), reason: requiredString(500) });
export const runCommentSchema = z.object({ runId: z.string().min(1), comment: nullableString(500) });

export const entryStatusSchema = z.object({
  entryId: z.string().min(1),
  status: z.enum(["INCLUDED", "HELD", "EXCLUDED"]),
  reason: nullableString(300),
});

export const settlementSchema = z.object({
  employeeId: z.string().min(1),
  otherEarnings: z.preprocess((v) => (v === "" || v === undefined ? "0" : v), moneyString),
  deductions: z.preprocess((v) => (v === "" || v === undefined ? "0" : v), moneyString),
  notes: nullableString(1000),
});
