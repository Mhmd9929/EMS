import "server-only";
import type { z } from "zod";
import { db } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { writeAudit, diffSnapshots } from "@/server/audit";
import { NotFoundError, ValidationError } from "@/server/errors";
import { FormulaError, formulaVariables, resolveFormulas } from "@/lib/payroll/formula";
import type { payComponentSchema, payrollSettingsSchema } from "@/lib/validation/payroll";
import { serverT } from "@/server/i18n";
import { loadComponents } from "./common";

export async function listPayComponents(ctx: AuthContext) {
  assertCan(ctx, ["payroll.settings.manage", "payroll.salary.read", "payroll.run.manage"]);
  return loadComponents(db, ctx.companyId);
}

/** Validate a formula against the other components (unknown names, syntax, cycles). */
async function validateFormula(code: string, formula: string, others: { code: string; calcType: string; formula: string | null }[]) {
  const t = await serverT("payroll");
  try {
    const known = new Set(others.map((o) => o.code));
    for (const v of formulaVariables(formula)) {
      if (v === code) throw new FormulaError(t("errors.selfReference"));
      if (!known.has(v)) throw new FormulaError(t("errors.unknownComponent", { code: v }));
    }
    const fixed = Object.fromEntries(others.filter((o) => o.calcType === "FIXED").map((o) => [o.code, 1000]));
    const formulas = Object.fromEntries([...others.filter((o) => o.calcType === "FORMULA" && o.formula && o.code !== code).map((o) => [o.code, o.formula!]), [code, formula]]);
    resolveFormulas(fixed, formulas);
  } catch (e) {
    throw new ValidationError(t("errors.invalidFormula"), { formula: [e instanceof Error ? e.message : t("errors.invalidFormulaField")] });
  }
}

export async function upsertPayComponent(ctx: AuthContext, input: z.infer<typeof payComponentSchema>) {
  assertCan(ctx, "payroll.settings.manage");
  const all = await loadComponents(db, ctx.companyId);
  const before = input.id ? all.find((c) => c.id === input.id) : null;
  const t = await serverT("payroll");
  if (input.id && !before) throw new NotFoundError(t("errors.componentNotFound"));
  if (before?.isSystem && (before.code !== input.code || before.kind !== input.kind || before.isRecurring !== input.isRecurring)) {
    throw new ValidationError(t("errors.systemFixed"));
  }
  if (all.some((c) => c.code === input.code && c.id !== input.id)) throw new ValidationError(t("errors.codeUsed"), { code: [t("errors.codeUsedField")] });
  if (input.calcType === "FORMULA") {
    if (!input.formula) throw new ValidationError(t("errors.enterFormula"), { formula: [t("errors.formulaRequiredField")] });
    if (!input.isRecurring) throw new ValidationError(t("errors.formulaRecurring"), { calcType: [t("errors.oneTimeAmounts")] });
    await validateFormula(input.code, input.formula, all.filter((c) => c.id !== input.id));
  }
  const { id: _id, ...rest } = input;
  void _id;
  const data = { ...rest, formula: input.calcType === "FORMULA" ? input.formula : null };
  return db.$transaction(async (tx) => {
    if (before) {
      const after = await tx.payComponent.update({ where: { id: before.id }, data });
      const diff = diffSnapshots(before, after);
      if (diff.keys.length) await writeAudit(ctx, { action: "payroll.component.update", entityType: "PayComponent", entityId: after.id, summary: `Updated ${after.name}`, before: diff.before, after: diff.after }, tx);
      return after;
    }
    const created = await tx.payComponent.create({ data: { ...data, companyId: ctx.companyId, sortOrder: (all.length + 1) * 10 } });
    await writeAudit(ctx, { action: "payroll.component.create", entityType: "PayComponent", entityId: created.id, summary: `Created ${created.name}`, after: created }, tx);
    return created;
  });
}

export async function getPayrollSettings(ctx: AuthContext) {
  assertCan(ctx, ["payroll.settings.manage", "payroll.run.manage", "payroll.settlement.manage"]);
  return db.company.findUniqueOrThrow({
    where: { id: ctx.companyId },
    select: {
      currency: true, payrollProrationBasis: true, wpsEmployerId: true, wpsEmployerBankCode: true, wpsFormat: true,
      gratuityMinServiceYears: true, gratuityDaysFirstYears: true, gratuityThresholdYears: true, gratuityDaysAfter: true,
      gratuityCapMonths: true, gratuityDailyBasis: true, leaveEncashmentBasis: true, payslipPdfPassword: true,
    },
  });
}

export async function updatePayrollSettings(ctx: AuthContext, input: z.infer<typeof payrollSettingsSchema>) {
  assertCan(ctx, "payroll.settings.manage");
  await db.$transaction(async (tx) => {
    const before = await tx.company.findUniqueOrThrow({ where: { id: ctx.companyId } });
    const after = await tx.company.update({ where: { id: ctx.companyId }, data: input });
    const diff = diffSnapshots(before, after);
    if (diff.keys.length) await writeAudit(ctx, { action: "payroll.settings.update", entityType: "Company", entityId: ctx.companyId, summary: `Updated ${diff.keys.join(", ")}`, before: diff.before, after: diff.after }, tx);
  });
}
