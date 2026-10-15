import "server-only";
import type { PayComponent, Prisma } from "@prisma/client";
import type { DbClient } from "@/server/db";
import type { ComponentDef, StructureInput } from "@/lib/payroll/calc";
import type { GratuityConfig } from "@/lib/payroll/gratuity";
import { num } from "@/lib/leave/numbers";

export const n = (v: bigint | number | null | undefined) => (v === null || v === undefined ? 0 : Number(v));

export function toComponentDef(c: PayComponent): ComponentDef {
  return { code: c.code, name: c.name, kind: c.kind, calcType: c.calcType, formula: c.formula, isRecurring: c.isRecurring, isFixedPay: c.isFixedPay, sortOrder: c.sortOrder };
}

export async function loadComponents(client: DbClient, companyId: string) {
  return client.payComponent.findMany({ where: { companyId }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
}

export const structureInclude = { lines: { include: { component: { select: { code: true } } } } } satisfies Prisma.SalaryStructureInclude;
export type StructureWithLines = Prisma.SalaryStructureGetPayload<{ include: typeof structureInclude }>;

export function toStructureInput(s: StructureWithLines): StructureInput {
  return { effectiveFrom: s.effectiveFrom, lines: s.lines.map((l) => ({ code: l.component.code, amount: l.amount === null ? null : Number(l.amount) })) };
}

export function gratuityConfig(c: {
  gratuityMinServiceYears: unknown; gratuityDaysFirstYears: unknown; gratuityThresholdYears: unknown; gratuityDaysAfter: unknown; gratuityCapMonths: unknown; gratuityDailyBasis: string;
}): GratuityConfig {
  return {
    minServiceYears: num(c.gratuityMinServiceYears),
    daysFirstYears: num(c.gratuityDaysFirstYears),
    thresholdYears: num(c.gratuityThresholdYears),
    daysAfter: num(c.gratuityDaysAfter),
    capMonths: num(c.gratuityCapMonths),
    dailyBasis: c.gratuityDailyBasis === "DIV365" ? "DIV365" : "DIV30",
  };
}

export const periodKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
