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
import { serverT, translatorFor } from "@/server/i18n";
import { n } from "./common";

const EXPORT_STATUSES = {
  approved: ["APPROVED", "RELEASED"],
  calculated: ["CALCULATED", "UNDER_REVIEW", "APPROVED", "RELEASED"],
} as const;

async function loadExportRun(ctx: AuthContext, runId: string, when: keyof typeof EXPORT_STATUSES) {
  assertCan(ctx, "payroll.export");
  const t = await serverT("payroll");
  const run = await db.payrollRun.findFirst({ where: { id: runId, companyId: ctx.companyId }, include: { employees: { include: { lines: { orderBy: { sortOrder: "asc" } } }, orderBy: { employeeNumber: "asc" } } } });
  if (!run) throw new NotFoundError(t("errors.runNotFound"));
  if (!(EXPORT_STATUSES[when] as readonly string[]).includes(run.status)) throw new ValidationError(t(when === "approved" ? "errors.exportApproved" : "errors.exportCalculated"));
  return run;
}

/** WPS SIF for included employees (held/excluded are not paid). Errors are returned, not thrown, so HR can see them all. */
export async function exportSif(ctx: AuthContext, runId: string) {
  const run = await loadExportRun(ctx, runId, "approved");
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
  const run = await loadExportRun(ctx, runId, "approved");
  // Bank files are imported by the bank's systems: headers stay in English whatever the user's language.
  const t = await translatorFor("en", "payroll");
  await writeAudit(ctx, { action: "payroll.export.bank", entityType: "PayrollRun", entityId: run.id, summary: `Bank transfer file for ${periodLabel(run.period)}` });
  return {
    period: run.period,
    name: t("export.sheetBank"),
    columns: [
      { header: t("export.employeeNo"), key: "number" },
      { header: t("export.beneficiary"), key: "name", width: 28 },
      { header: t("export.bank"), key: "bank", width: 24 },
      { header: t("export.iban"), key: "iban", width: 32 },
      { header: t("export.amount"), key: "amount" },
      { header: t("export.currency"), key: "currency" },
      { header: t("export.reference"), key: "reference", width: 22 },
    ],
    rows: run.employees
      .filter((e) => e.status === "INCLUDED" && n(e.net) > 0)
      .map((e) => ({ number: e.employeeNumber, name: e.name, bank: e.bankName ?? "", iban: e.iban ? formatIban(e.iban).replace(/ /g, "") : "", amount: minorToDecimalString(n(e.net), run.currency), currency: run.currency, reference: `SALARY ${run.period}` })),
  };
}

/** Payroll register: one row per employee, one column per component, plus a department summary. */
export async function exportRegister(ctx: AuthContext, runId: string): Promise<{ period: string; sheets: Sheet[] }> {
  const run = await loadExportRun(ctx, runId, "calculated");
  const t = await serverT("payroll");
  const codes = new Map<string, { name: string; kind: string }>();
  for (const e of run.employees) for (const l of e.lines) if (!codes.has(l.code)) codes.set(l.code, { name: l.name, kind: l.kind });
  const earningCodes = [...codes].filter(([, v]) => v.kind === "EARNING").map(([k]) => k);
  const deductionCodes = [...codes].filter(([, v]) => v.kind === "DEDUCTION").map(([k]) => k);
  const money = (v: number) => toMajor(v, run.currency);
  const detail: Sheet = {
    name: t("export.sheetRegister"),
    columns: [
      { header: t("export.employeeNo"), key: "number" },
      { header: t("export.name"), key: "name", width: 26 },
      { header: t("export.department"), key: "department", width: 18 },
      { header: t("export.position"), key: "position", width: 22 },
      { header: t("export.status"), key: "status" },
      { header: t("export.paidDays"), key: "paidDays", numFmt: "0.00" },
      { header: t("export.unpaidLeaveDays"), key: "unpaid", numFmt: "0.00" },
      ...earningCodes.map((c) => ({ header: codes.get(c)!.name, key: `e_${c}`, numFmt: "#,##0.00" })),
      { header: t("export.gross"), key: "gross", numFmt: "#,##0.00" },
      ...deductionCodes.map((c) => ({ header: codes.get(c)!.name, key: `d_${c}`, numFmt: "#,##0.00" })),
      { header: t("export.totalDeductions"), key: "deductions", numFmt: "#,##0.00" },
      { header: t("export.netPay"), key: "net", numFmt: "#,##0.00" },
      { header: t("export.previousNet"), key: "prev", numFmt: "#,##0.00" },
      { header: t("export.bank"), key: "bank", width: 20 },
      { header: t("export.iban"), key: "iban", width: 30 },
    ],
    rows: run.employees.map((e) => {
      const row: Record<string, unknown> = {
        number: e.employeeNumber, name: e.name, department: e.department ?? "", position: e.position ?? "",
        status: e.status === "INCLUDED" ? t("export.included") : t(e.status === "HELD" ? "export.held" : "export.excluded", { reason: e.statusReason ?? "" }),
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
    const k = e.department ?? t("export.unassigned");
    const d = depts.get(k) ?? { people: 0, gross: 0, deductions: 0, net: 0 };
    d.people++;
    d.gross += n(e.gross);
    d.deductions += n(e.deductions);
    d.net += n(e.net);
    depts.set(k, d);
  }
  const summary: Sheet = {
    name: t("export.sheetByDepartment"),
    columns: [
      { header: t("export.department"), key: "department", width: 24 },
      { header: t("export.employees"), key: "people" },
      { header: t("export.gross"), key: "gross", numFmt: "#,##0.00" },
      { header: t("export.deductions"), key: "deductions", numFmt: "#,##0.00" },
      { header: t("export.net"), key: "net", numFmt: "#,##0.00" },
    ],
    rows: [
      ...[...depts].map(([department, d]) => ({ department, people: d.people, gross: money(d.gross), deductions: money(d.deductions), net: money(d.net) })),
      { department: t("export.total"), people: run.employeeCount, gross: money(n(run.totalGross)), deductions: money(n(run.totalDeductions)), net: money(n(run.totalNet)) },
    ],
  };
  await writeAudit(ctx, { action: "payroll.export.register", entityType: "PayrollRun", entityId: run.id, summary: `Payroll register for ${periodLabel(run.period)}` });
  return { period: run.period, sheets: [detail, summary] };
}
