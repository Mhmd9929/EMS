import "server-only";
import { db } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { writeAudit } from "@/server/audit";
import { NotFoundError, ValidationError } from "@/server/errors";
import { buildSif } from "@/lib/payroll/sif";
import { periodLabel } from "@/lib/payroll/calc";
import { formatIban } from "@/lib/iban";
import { minorToDecimalString, toMajor } from "@/lib/payroll/money";
import type { Sheet } from "@/server/export";
import { n } from "./common";

async function loadExportRun(ctx: AuthContext, runId: string, statuses: string[]) {
  assertCan(ctx, "payroll.export");
  const run = await db.payrollRun.findFirst({ where: { id: runId, companyId: ctx.companyId }, include: { employees: { include: { lines: { orderBy: { sortOrder: "asc" } } }, orderBy: { employeeNumber: "asc" } } } });
  if (!run) throw new NotFoundError("Payroll run not found.");
  if (!statuses.includes(run.status)) throw new ValidationError(`This export is available once the run is ${statuses.map((s) => s.toLowerCase()).join(" or ")}.`);
  return run;
}

/** WPS SIF for included employees (held/excluded are not paid). Errors are returned, not thrown, so HR can see them all. */
export async function exportSif(ctx: AuthContext, runId: string) {
  const run = await loadExportRun(ctx, runId, ["APPROVED", "RELEASED"]);
  const company = await db.company.findUniqueOrThrow({ where: { id: ctx.companyId }, select: { wpsEmployerId: true, wpsEmployerBankCode: true, wpsFormat: true } });
  const rows = run.employees
    .filter((e) => e.status === "INCLUDED" && n(e.net) > 0)
    .map((e) => ({
      employeeNumber: e.employeeNumber,
      name: e.name,
      personId: e.labourCardNumber,
      routingCode: e.bankRoutingCode,
      iban: e.iban,
      payStart: e.joinDate > run.periodStart ? e.joinDate : run.periodStart,
      payEnd: e.lastWorkingDay && e.lastWorkingDay < run.periodEnd ? e.lastWorkingDay : run.periodEnd,
      days: e.calendarDays,
      fixed: n(e.fixedPay),
      variable: n(e.variablePay),
      leaveDays: Math.ceil(Number(e.unpaidLeaveDays)),
    }));
  const result = buildSif(company.wpsFormat, { employerId: company.wpsEmployerId, employerBankCode: company.wpsEmployerBankCode, period: run.period, currency: run.currency, createdAt: new Date(), reference: `PAYROLL-${run.period}` }, rows);
  await writeAudit(ctx, { action: "payroll.export.sif", entityType: "PayrollRun", entityId: run.id, summary: `WPS SIF for ${periodLabel(run.period)} (${result.count} employees${result.errors.length ? `, ${result.errors.length} problems` : ""})` });
  return result;
}

export async function exportBankCsv(ctx: AuthContext, runId: string): Promise<Sheet & { period: string }> {
  const run = await loadExportRun(ctx, runId, ["APPROVED", "RELEASED"]);
  await writeAudit(ctx, { action: "payroll.export.bank", entityType: "PayrollRun", entityId: run.id, summary: `Bank transfer file for ${periodLabel(run.period)}` });
  return {
    period: run.period,
    name: "Bank transfer",
    columns: [
      { header: "Employee no.", key: "number" },
      { header: "Beneficiary name", key: "name", width: 28 },
      { header: "Bank", key: "bank", width: 24 },
      { header: "IBAN", key: "iban", width: 32 },
      { header: "Amount", key: "amount" },
      { header: "Currency", key: "currency" },
      { header: "Reference", key: "reference", width: 22 },
    ],
    rows: run.employees
      .filter((e) => e.status === "INCLUDED" && n(e.net) > 0)
      .map((e) => ({ number: e.employeeNumber, name: e.name, bank: e.bankName ?? "", iban: e.iban ? formatIban(e.iban).replace(/ /g, "") : "", amount: minorToDecimalString(n(e.net), run.currency), currency: run.currency, reference: `SALARY ${run.period}` })),
  };
}

/** Payroll register: one row per employee, one column per component, plus a department summary. */
export async function exportRegister(ctx: AuthContext, runId: string): Promise<{ period: string; sheets: Sheet[] }> {
  const run = await loadExportRun(ctx, runId, ["CALCULATED", "UNDER_REVIEW", "APPROVED", "RELEASED"]);
  const codes = new Map<string, { name: string; kind: string }>();
  for (const e of run.employees) for (const l of e.lines) if (!codes.has(l.code)) codes.set(l.code, { name: l.name, kind: l.kind });
  const earningCodes = [...codes].filter(([, v]) => v.kind === "EARNING").map(([k]) => k);
  const deductionCodes = [...codes].filter(([, v]) => v.kind === "DEDUCTION").map(([k]) => k);
  const money = (v: number) => toMajor(v, run.currency);
  const detail: Sheet = {
    name: "Register",
    columns: [
      { header: "Employee no.", key: "number" },
      { header: "Name", key: "name", width: 26 },
      { header: "Department", key: "department", width: 18 },
      { header: "Position", key: "position", width: 22 },
      { header: "Status", key: "status" },
      { header: "Paid days", key: "paidDays", numFmt: "0.00" },
      { header: "Unpaid leave days", key: "unpaid", numFmt: "0.00" },
      ...earningCodes.map((c) => ({ header: codes.get(c)!.name, key: `e_${c}`, numFmt: "#,##0.00" })),
      { header: "Gross", key: "gross", numFmt: "#,##0.00" },
      ...deductionCodes.map((c) => ({ header: codes.get(c)!.name, key: `d_${c}`, numFmt: "#,##0.00" })),
      { header: "Total deductions", key: "deductions", numFmt: "#,##0.00" },
      { header: "Net pay", key: "net", numFmt: "#,##0.00" },
      { header: "Previous net", key: "prev", numFmt: "#,##0.00" },
      { header: "Bank", key: "bank", width: 20 },
      { header: "IBAN", key: "iban", width: 30 },
    ],
    rows: run.employees.map((e) => {
      const row: Record<string, unknown> = {
        number: e.employeeNumber, name: e.name, department: e.department ?? "", position: e.position ?? "",
        status: e.status === "INCLUDED" ? "Included" : `${e.status === "HELD" ? "Held" : "Excluded"}: ${e.statusReason ?? ""}`,
        paidDays: Number(e.paidDays), unpaid: Number(e.unpaidLeaveDays),
        gross: money(n(e.gross)), deductions: money(n(e.deductions)), net: money(n(e.net)), prev: e.previousNet === null ? "" : money(n(e.previousNet)),
        bank: e.bankName ?? "", iban: e.iban ?? "",
      };
      for (const l of e.lines) row[`${l.kind === "EARNING" ? "e" : "d"}_${l.code}`] = money(n(l.amount));
      return row;
    }),
  };
  const depts = new Map<string, { people: number; gross: number; deductions: number; net: number }>();
  for (const e of run.employees.filter((x) => x.status === "INCLUDED")) {
    const k = e.department ?? "Unassigned";
    const d = depts.get(k) ?? { people: 0, gross: 0, deductions: 0, net: 0 };
    d.people++;
    d.gross += n(e.gross);
    d.deductions += n(e.deductions);
    d.net += n(e.net);
    depts.set(k, d);
  }
  const summary: Sheet = {
    name: "By department",
    columns: [
      { header: "Department", key: "department", width: 24 },
      { header: "Employees", key: "people" },
      { header: "Gross", key: "gross", numFmt: "#,##0.00" },
      { header: "Deductions", key: "deductions", numFmt: "#,##0.00" },
      { header: "Net", key: "net", numFmt: "#,##0.00" },
    ],
    rows: [
      ...[...depts].map(([department, d]) => ({ department, people: d.people, gross: money(d.gross), deductions: money(d.deductions), net: money(d.net) })),
      { department: "TOTAL", people: run.employeeCount, gross: money(n(run.totalGross)), deductions: money(n(run.totalDeductions)), net: money(n(run.totalNet)) },
    ],
  };
  await writeAudit(ctx, { action: "payroll.export.register", entityType: "PayrollRun", entityId: run.id, summary: `Payroll register for ${periodLabel(run.period)}` });
  return { period: run.period, sheets: [detail, summary] };
}
