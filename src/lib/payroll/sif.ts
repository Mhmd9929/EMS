/**
 * WPS Salary Information File (SIF) generation. Formats are data-driven so another layout (or a bank's
 * variant) can be added without touching callers.
 *
 * UAE_SIF_V1 (MOHRE WPS):
 *   EDR,<14-digit person ID>,<9-digit agent routing code>,<IBAN>,<pay start YYYY-MM-DD>,<pay end>,<days>,<fixed>,<variable>,<leave days>
 *   SCR,<13-digit employer ID>,<employer bank routing code>,<file date YYYY-MM-DD>,<file time HHMM>,<salary month MMYYYY>,<EDR count>,<total>,<currency>,<employer reference>
 *   File name: <employer ID><YYMMDDHHMMSS>.SIF
 */
import { minorToDecimalString } from "./money";

export type SifEmployee = {
  employeeNumber: string;
  name: string;
  personId: string | null;
  routingCode: string | null;
  iban: string | null;
  payStart: Date;
  payEnd: Date;
  days: number;
  fixed: number;
  variable: number;
  leaveDays: number;
};

export type SifHeader = { employerId: string | null; employerBankCode: string | null; period: string; currency: string; createdAt: Date; reference: string };

/** A problem in the file. `message` is English (also in `errors`); the UI translates `code` (payroll.sif.<code>). */
export type SifProblem = { code: "employerId" | "employerBankCode" | "personId" | "routingCode" | "iban"; employee?: string; message: string };

export type SifResult = { fileName: string; content: string; errors: string[]; problems: SifProblem[]; total: number; count: number };

type Format = { label: string; build: (h: SifHeader, rows: SifEmployee[]) => SifResult };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export const SIF_FORMATS: Record<string, Format> = {
  UAE_SIF_V1: {
    label: "UAE WPS SIF (MOHRE)",
    build(h, rows) {
      const problems: SifProblem[] = [];
      if (!h.employerId || !/^\d{13}$/.test(h.employerId)) problems.push({ code: "employerId", message: "Company WPS employer ID must be 13 digits (Payroll → Settings)." });
      if (!h.employerBankCode || !/^\d{9}$/.test(h.employerBankCode)) problems.push({ code: "employerBankCode", message: "Employer bank routing code must be 9 digits (Payroll → Settings)." });
      const lines: string[] = [];
      for (const r of rows) {
        const who = `${r.employeeNumber} ${r.name}`;
        if (!r.personId) problems.push({ code: "personId", employee: who, message: `${who}: missing labour card / person ID` });
        if (!r.routingCode || !/^\d{9}$/.test(r.routingCode)) problems.push({ code: "routingCode", employee: who, message: `${who}: bank routing code must be 9 digits` });
        if (!r.iban) problems.push({ code: "iban", employee: who, message: `${who}: missing IBAN` });
        lines.push(
          ["EDR", (r.personId ?? "").padStart(14, "0"), r.routingCode ?? "", r.iban ?? "", iso(r.payStart), iso(r.payEnd), r.days, minorToDecimalString(r.fixed, h.currency), minorToDecimalString(r.variable, h.currency), r.leaveDays].join(","),
        );
      }
      const total = rows.reduce((a, r) => a + r.fixed + r.variable, 0);
      const c = h.createdAt;
      const [y, m] = h.period.split("-");
      lines.push(
        ["SCR", h.employerId ?? "", h.employerBankCode ?? "", iso(c), `${pad(c.getUTCHours())}${pad(c.getUTCMinutes())}`, `${m}${y}`, rows.length, minorToDecimalString(total, h.currency), h.currency, h.reference].join(","),
      );
      const stamp = `${String(c.getUTCFullYear()).slice(2)}${pad(c.getUTCMonth() + 1)}${pad(c.getUTCDate())}${pad(c.getUTCHours())}${pad(c.getUTCMinutes())}${pad(c.getUTCSeconds())}`;
      return { fileName: `${h.employerId ?? "EMPLOYER"}${stamp}.SIF`, content: lines.join("\r\n") + "\r\n", errors: problems.map((p) => p.message), problems, total, count: rows.length };
    },
  },
};

export function buildSif(format: string, header: SifHeader, rows: SifEmployee[]): SifResult {
  const f = SIF_FORMATS[format];
  if (!f) throw new RangeError(`Unknown WPS format ${format}`);
  return f.build(header, rows);
}
