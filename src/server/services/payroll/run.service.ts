import "server-only";
import { createFormat } from "@/lib/format";
import type { PayrollEntryStatus, PayrollRunStatus, Prisma } from "@prisma/client";
import { db, type DbClient } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { writeAudit } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { calculatePay, periodBounds, periodLabel, previousPeriod, variancePct, type CalcIssue } from "@/lib/payroll/calc";
import { formatMoney } from "@/lib/payroll/money";
import { issueText } from "@/lib/payroll/issues";
import { serverT } from "@/server/i18n";
import { unpaidLeaveDays } from "@/server/services/leave/report.service";
import { deliverEmailsInBackground, notify } from "@/server/services/notification.service";
import { loadComponents, n, structureInclude, toComponentDef, toStructureInput } from "./common";

/** Statuses in which an employee counts as "in" a run (for double-payment protection). */
const LIVE: PayrollRunStatus[] = ["DRAFT", "CALCULATED", "UNDER_REVIEW", "APPROVED", "RELEASED"];
const VARIANCE_WARNING_PCT = 20;

async function loadRun(client: DbClient, ctx: AuthContext, runId: string) {
  const run = await client.payrollRun.findFirst({ where: { id: runId, companyId: ctx.companyId } });
  if (!run) throw new NotFoundError((await serverT("payroll"))("errors.runNotFound"));
  return run;
}

type StatusAction = "calculate" | "submit" | "approve" | "sendBack" | "release" | "cancel" | "reopen" | "changeEmployees";

async function assertStatus(status: PayrollRunStatus, allowed: PayrollRunStatus[], action: StatusAction) {
  if (allowed.includes(status)) return;
  const [t, te] = await Promise.all([serverT("payroll"), serverT("enums")]);
  throw new ValidationError(t("errors.cannotInStatus", { action: t(`errors.statusAction.${action}`), status: te(`runStatus.${status}`).toLowerCase() }));
}

// ───────────────────────────── Create / list ─────────────────────────────

export async function createRun(ctx: AuthContext, input: { period: string; scope: "ALL" | "DEPARTMENT" | "LOCATION"; scopeId: string | null; notes: string | null }) {
  assertCan(ctx, "payroll.run.manage");
  const { start, end } = periodBounds(input.period);
  let scopeLabel = "All employees";
  if (input.scope !== "ALL") {
    const t = await serverT("payroll");
    if (!input.scopeId) throw new ValidationError(t("errors.chooseScope"), { scopeId: [t("errors.required")] });
    const target =
      input.scope === "DEPARTMENT"
        ? await db.department.findFirst({ where: { id: input.scopeId, companyId: ctx.companyId }, select: { name: true } })
        : await db.location.findFirst({ where: { id: input.scopeId, companyId: ctx.companyId }, select: { name: true } });
    if (!target) throw new ValidationError(t("errors.unknownScope"), { scopeId: [t("errors.unknown")] });
    scopeLabel = `${input.scope === "DEPARTMENT" ? "Department" : "Location"}: ${target.name}`;
  }
  const company = await db.company.findUniqueOrThrow({ where: { id: ctx.companyId }, select: { payrollProrationBasis: true, currency: true } });
  return db.$transaction(async (tx) => {
    const run = await tx.payrollRun.create({
      data: {
        companyId: ctx.companyId, period: input.period, periodStart: start, periodEnd: end, scope: input.scope, scopeId: input.scope === "ALL" ? null : input.scopeId,
        scopeLabel, prorationBasis: company.payrollProrationBasis, currency: company.currency, notes: input.notes, createdById: ctx.userId,
      },
    });
    await writeAudit(ctx, { action: "payroll.run.create", entityType: "PayrollRun", entityId: run.id, summary: `Created ${periodLabel(input.period)} payroll (${scopeLabel})`, after: run }, tx);
    return run;
  });
}

export async function listRuns(ctx: AuthContext, filters: { year?: number; status?: PayrollRunStatus }) {
  assertCan(ctx, ["payroll.run.manage", "payroll.run.approve", "payroll.export"]);
  return db.payrollRun.findMany({
    where: { companyId: ctx.companyId, ...(filters.year && { period: { startsWith: String(filters.year) } }), ...(filters.status && { status: filters.status }) },
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
  });
}

// ───────────────────────────── Calculate ─────────────────────────────

/**
 * (Re)calculate every employee in scope. Keeps hold/exclude decisions from the previous calculation.
 * Employees already in another live run for the same period are skipped (no double payment).
 */
export async function calculateRun(ctx: AuthContext, runId: string) {
  assertCan(ctx, "payroll.run.manage");
  const run = await loadRun(db, ctx, runId);
  await assertStatus(run.status, ["DRAFT", "CALCULATED"], "calculate");

  const scopeWhere: Prisma.EmployeeWhereInput =
    run.scope === "DEPARTMENT" ? { departmentId: run.scopeId } : run.scope === "LOCATION" ? { locationId: run.scopeId } : {};
  const employees = await db.employee.findMany({
    where: {
      companyId: ctx.companyId,
      ...scopeWhere,
      joinDate: { lte: run.periodEnd },
      OR: [{ lastWorkingDay: null }, { lastWorkingDay: { gte: run.periodStart } }],
      NOT: { status: "TERMINATED", lastWorkingDay: null },
    },
    select: {
      id: true, employeeNumber: true, firstName: true, lastName: true, preferredName: true, joinDate: true, lastWorkingDay: true,
      bankName: true, iban: true, bankRoutingCode: true, labourCardNumber: true,
      department: { select: { name: true } }, position: { select: { title: true } }, location: { select: { name: true } },
      salaryStructures: { include: structureInclude },
    },
    orderBy: { employeeNumber: "asc" },
  });
  const inOtherRuns = await db.payrollRunEmployee.findMany({
    where: { run: { companyId: ctx.companyId, period: run.period, status: { in: LIVE }, id: { not: run.id } }, status: { not: "EXCLUDED" } },
    select: { employeeId: true },
  });
  const skip = new Set(inOtherRuns.map((r) => r.employeeId));
  const eligible = employees.filter((e) => !skip.has(e.id));
  const ids = eligible.map((e) => e.id);

  const [components, adjustments, unpaid, previous, existing] = await Promise.all([
    loadComponents(db, ctx.companyId),
    db.payrollAdjustment.findMany({ where: { companyId: ctx.companyId, period: run.period, employeeId: { in: ids }, OR: [{ runId: null }, { runId: run.id }] }, include: { component: { select: { code: true } } } }),
    unpaidLeaveDays(ctx.companyId, run.periodStart, run.periodEnd, ids),
    db.payslip.findMany({ where: { employeeId: { in: ids }, period: previousPeriod(run.period), voidedAt: null }, select: { employeeId: true, net: true } }),
    db.payrollRunEmployee.findMany({ where: { runId: run.id }, select: { employeeId: true, status: true, statusReason: true } }),
  ]);
  const defs = components.filter((c) => c.isActive || c.isSystem).map(toComponentDef);
  const prevNet = new Map(previous.map((p) => [p.employeeId, n(p.net)]));
  const keep = new Map(existing.map((e) => [e.employeeId, e]));

  const entries = eligible
    .map((e) => {
      const result = calculatePay({
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        basis: run.prorationBasis,
        currency: run.currency,
        joinDate: e.joinDate,
        lastWorkingDay: e.lastWorkingDay,
        components: defs,
        structures: e.salaryStructures.map(toStructureInput),
        unpaidLeaveDays: unpaid.get(e.id) ?? 0,
        adjustments: adjustments.filter((a) => a.employeeId === e.id).map((a) => ({ code: a.component.code, amount: n(a.amount), description: a.description })),
      });
      if (!result.payable) return null;
      const issues: CalcIssue[] = [...result.issues];
      // Issues are stored: English `message` plus a `code` the UI translates (payroll.issues.<code>).
      if (!e.iban) issues.push({ level: "error", code: "noIban", message: "No IBAN — cannot be paid by bank transfer / WPS" });
      if (!e.bankRoutingCode) issues.push({ level: "warning", code: "noRoutingCode", message: "No bank routing code (needed for the WPS file)" });
      if (!e.labourCardNumber) issues.push({ level: "warning", code: "noLabourCard", message: "No labour card number (needed for the WPS file)" });
      const previousNet = prevNet.get(e.id) ?? null;
      const variance = variancePct(result.net, previousNet);
      if (variance !== null && Math.abs(variance) >= VARIANCE_WARNING_PCT) {
        const change = `${variance > 0 ? "+" : ""}${variance}`;
        issues.push({ level: "warning", code: "variance", params: { change }, message: `Net pay changed ${change}% vs last month` });
      }
      if (e.joinDate >= run.periodStart) issues.push({ level: "warning", code: "newJoiner", message: "New joiner this month" });
      if (e.lastWorkingDay && e.lastWorkingDay <= run.periodEnd) issues.push({ level: "warning", code: "leaver", message: "Leaver — final month (prepare the final settlement separately)" });
      const kept = keep.get(e.id);
      return { e, result, issues, previousNet, status: (kept?.status ?? "INCLUDED") as PayrollEntryStatus, statusReason: kept?.statusReason ?? null };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  await db.$transaction(
    async (tx) => {
      await tx.payrollRunEmployee.deleteMany({ where: { runId: run.id } });
      for (const x of entries) {
        await tx.payrollRunEmployee.create({
          data: {
            runId: run.id, employeeId: x.e.id, status: x.status, statusReason: x.statusReason,
            employeeNumber: x.e.employeeNumber, name: `${x.e.firstName} ${x.e.lastName}`, department: x.e.department?.name ?? null, position: x.e.position?.title ?? null,
            location: x.e.location?.name ?? null, joinDate: x.e.joinDate, lastWorkingDay: x.e.lastWorkingDay, bankName: x.e.bankName, iban: x.e.iban,
            bankRoutingCode: x.e.bankRoutingCode, labourCardNumber: x.e.labourCardNumber,
            calendarDays: x.result.calendarDays, paidDays: x.result.paidDays, unpaidLeaveDays: x.result.unpaidLeaveDays,
            gross: BigInt(x.result.gross), deductions: BigInt(x.result.deductions), net: BigInt(x.result.net),
            fixedPay: BigInt(x.result.fixedPay), variablePay: BigInt(x.result.variablePay),
            previousNet: x.previousNet === null ? null : BigInt(x.previousNet),
            issues: x.issues as unknown as Prisma.InputJsonValue,
            lines: {
              create: x.result.lines.map((l, i) => ({ code: l.code, name: l.name, kind: l.kind, amount: BigInt(l.amount), note: l.note, isRecurring: l.isRecurring, isFixedPay: l.isFixedPay, sortOrder: i })),
            },
          },
        });
      }
      await refreshTotals(tx, run.id);
      await tx.payrollRun.update({
        where: { id: run.id },
        data: { status: "CALCULATED", calculatedById: ctx.userId, calculatedAt: new Date(), submittedById: null, submittedAt: null, approvedById: null, approvedAt: null },
      });
      await writeAudit(ctx, {
        action: "payroll.run.calculate",
        entityType: "PayrollRun",
        entityId: run.id,
        summary: `Calculated ${periodLabel(run.period)}: ${entries.length} employees${skip.size ? `, ${skip.size} skipped (in another run)` : ""}`,
      }, tx);
    },
    { timeout: 120_000 },
  );
  return { calculated: entries.length, skipped: employees.filter((e) => skip.has(e.id)).map((e) => `${e.firstName} ${e.lastName}`) };
}

async function refreshTotals(tx: DbClient, runId: string) {
  const agg = await tx.payrollRunEmployee.aggregate({ where: { runId, status: "INCLUDED" }, _sum: { gross: true, deductions: true, net: true }, _count: true });
  await tx.payrollRun.update({
    where: { id: runId },
    data: { totalGross: agg._sum.gross ?? 0n, totalDeductions: agg._sum.deductions ?? 0n, totalNet: agg._sum.net ?? 0n, employeeCount: agg._count },
  });
}

// ───────────────────────────── Review ─────────────────────────────

export async function setEntryStatus(ctx: AuthContext, input: { entryId: string; status: PayrollEntryStatus; reason: string | null }) {
  assertCan(ctx, ["payroll.run.manage", "payroll.run.approve"]);
  const t = await serverT("payroll");
  if (input.status !== "INCLUDED" && !input.reason) throw new ValidationError(t("errors.giveReason"), { reason: [t("errors.reasonRequired")] });
  const entry = await db.payrollRunEmployee.findFirst({ where: { id: input.entryId, run: { companyId: ctx.companyId } }, include: { run: true } });
  if (!entry) throw new NotFoundError(t("errors.entryNotFound"));
  await assertStatus(entry.run.status, ["CALCULATED", "UNDER_REVIEW"], "changeEmployees");
  await db.$transaction(async (tx) => {
    await tx.payrollRunEmployee.update({ where: { id: entry.id }, data: { status: input.status, statusReason: input.status === "INCLUDED" ? null : input.reason } });
    await refreshTotals(tx, entry.runId);
    await writeAudit(ctx, {
      action: `payroll.entry.${input.status.toLowerCase()}`,
      entityType: "PayrollRun",
      entityId: entry.runId,
      summary: `${input.status === "INCLUDED" ? "Included" : input.status === "HELD" ? "Held" : "Excluded"} ${entry.name}${input.reason ? `: ${input.reason}` : ""}`,
      before: { status: entry.status, reason: entry.statusReason },
      after: { status: input.status, reason: input.reason },
    }, tx);
  });
}

function blockingIssues(entries: { name: string; status: PayrollEntryStatus; issues: unknown }[]) {
  return entries
    .filter((e) => e.status === "INCLUDED")
    .flatMap((e) => ((e.issues as CalcIssue[]) ?? []).filter((i) => i.level === "error").map((issue) => ({ name: e.name, issue })));
}

export async function submitRun(ctx: AuthContext, runId: string) {
  assertCan(ctx, "payroll.run.manage");
  const run = await loadRun(db, ctx, runId);
  await assertStatus(run.status, ["CALCULATED"], "submit");
  const t = await serverT("payroll");
  const entries = await db.payrollRunEmployee.findMany({ where: { runId }, select: { name: true, status: true, issues: true } });
  if (!entries.some((e) => e.status === "INCLUDED")) throw new ValidationError(t("errors.noneIncluded"));
  const blocking = blockingIssues(entries);
  if (blocking.length) {
    const list = blocking.slice(0, 3).map((b) => `${b.name}: ${issueText(b.issue, t)}`).join("; ");
    throw new ValidationError(blocking.length > 3 ? t("errors.fixFirstMore", { list, count: blocking.length - 3 }) : t("errors.fixFirst", { list }));
  }
  await db.$transaction(async (tx) => {
    await tx.payrollRun.update({ where: { id: runId }, data: { status: "UNDER_REVIEW", submittedById: ctx.userId, submittedAt: new Date(), reviewComment: null } });
    await writeAudit(ctx, { action: "payroll.run.submit", entityType: "PayrollRun", entityId: runId, summary: `Submitted ${periodLabel(run.period)} for approval` }, tx);
  });
}

/** Maker-checker: the approver must not be the person who calculated (or submitted) the run. */
export async function approveRun(ctx: AuthContext, runId: string, comment: string | null) {
  assertCan(ctx, "payroll.run.approve");
  const run = await loadRun(db, ctx, runId);
  await assertStatus(run.status, ["UNDER_REVIEW"], "approve");
  if (run.calculatedById === ctx.userId || run.submittedById === ctx.userId) {
    throw new ForbiddenError((await serverT("payroll"))("errors.makerChecker"));
  }
  await db.$transaction(async (tx) => {
    await tx.payrollRun.update({ where: { id: runId }, data: { status: "APPROVED", approvedById: ctx.userId, approvedAt: new Date(), reviewComment: comment } });
    await writeAudit(ctx, { action: "payroll.run.approve", entityType: "PayrollRun", entityId: runId, summary: `Approved ${periodLabel(run.period)} (${formatMoney(n(run.totalNet), run.currency)} net)${comment ? `: ${comment}` : ""}` }, tx);
  });
}

export async function returnRun(ctx: AuthContext, runId: string, comment: string | null) {
  assertCan(ctx, ["payroll.run.approve", "payroll.run.manage"]);
  if (!comment) {
    const t = await serverT("payroll");
    throw new ValidationError(t("errors.explainChange"), { comment: [t("errors.required")] });
  }
  const run = await loadRun(db, ctx, runId);
  await assertStatus(run.status, ["UNDER_REVIEW", "APPROVED"], "sendBack");
  await db.$transaction(async (tx) => {
    await tx.payrollRun.update({ where: { id: runId }, data: { status: "CALCULATED", reviewComment: comment, approvedById: null, approvedAt: null, submittedById: null, submittedAt: null } });
    await writeAudit(ctx, { action: "payroll.run.return", entityType: "PayrollRun", entityId: runId, summary: `Sent ${periodLabel(run.period)} back for changes: ${comment}` }, tx);
  });
}

/** Lock the run, issue payslips, consume adjustments and notify employees. */
export async function releaseRun(ctx: AuthContext, runId: string, opts: { notify?: boolean } = {}) {
  assertCan(ctx, "payroll.run.manage");
  const ids: string[] = [];
  const t = await serverT("payroll");
  const run = await db.$transaction(
    async (tx) => {
      const run = await loadRun(tx, ctx, runId);
      await assertStatus(run.status, ["APPROVED"], "release");
      const locked = await tx.payrollRun.updateMany({ where: { id: runId, status: "APPROVED" }, data: { status: "RELEASED", releasedById: ctx.userId, releasedAt: new Date() } });
      if (locked.count !== 1) throw new ValidationError(t("errors.runChanged"));
      const entries = await tx.payrollRunEmployee.findMany({ where: { runId, status: "INCLUDED" }, include: { employee: { select: { userId: true } } } });
      const now = new Date();
      for (const e of entries) {
        // A reopened run released again without recalculating reuses (un-voids) its payslips.
        await tx.payslip.upsert({
          where: { runEmployeeId: e.id },
          create: { companyId: ctx.companyId, employeeId: e.employeeId, runEmployeeId: e.id, period: run.period, number: `PS-${run.period.replace("-", "")}-${e.employeeNumber}`, net: e.net, releasedAt: now },
          update: { net: e.net, releasedAt: now, voidedAt: null },
        });
      }
      await tx.payrollAdjustment.updateMany({ where: { companyId: ctx.companyId, period: run.period, runId: null, employeeId: { in: entries.map((e) => e.employeeId) } }, data: { runId } });
      if (opts.notify !== false) {
        ids.push(
          ...(await notify(tx, {
            companyId: ctx.companyId,
            userIds: entries.map((e) => e.employee.userId),
            type: "payroll.payslip",
            message: { key: "payslipReady", params: { month: (locale) => createFormat(locale).month(run.period) } },
            link: "/payslips",
          })),
        );
      }
      await writeAudit(ctx, { action: "payroll.run.release", entityType: "PayrollRun", entityId: runId, summary: `Released ${periodLabel(run.period)}: ${entries.length} payslips, ${formatMoney(n(run.totalNet), run.currency)} net` }, tx);
      return run;
    },
    { timeout: 60_000 },
  );
  deliverEmailsInBackground(ids);
  return run;
}

export async function cancelRun(ctx: AuthContext, runId: string, reason: string) {
  assertCan(ctx, "payroll.run.manage");
  const run = await loadRun(db, ctx, runId);
  await assertStatus(run.status, ["DRAFT", "CALCULATED", "UNDER_REVIEW", "APPROVED"], "cancel");
  await db.$transaction(async (tx) => {
    await tx.payrollRun.update({ where: { id: runId }, data: { status: "CANCELLED", cancelledById: ctx.userId, cancelledAt: new Date(), cancelReason: reason } });
    await writeAudit(ctx, { action: "payroll.run.cancel", entityType: "PayrollRun", entityId: runId, summary: `Cancelled ${periodLabel(run.period)}: ${reason}`, before: { status: run.status }, after: { status: "CANCELLED" } }, tx);
  });
}

/** Super Admin only: unlock a released run. Payslips are voided (hidden from employees) until re-released. */
export async function reopenRun(ctx: AuthContext, runId: string, reason: string) {
  assertCan(ctx, "payroll.run.reopen");
  const run = await loadRun(db, ctx, runId);
  await assertStatus(run.status, ["RELEASED"], "reopen");
  await db.$transaction(async (tx) => {
    const voided = await tx.payslip.updateMany({ where: { runEmployee: { runId }, voidedAt: null }, data: { voidedAt: new Date() } });
    await tx.payrollAdjustment.updateMany({ where: { runId }, data: { runId: null } });
    await tx.payrollRun.update({
      where: { id: runId },
      data: { status: "CALCULATED", reopenCount: { increment: 1 }, releasedById: null, releasedAt: null, approvedById: null, approvedAt: null, submittedById: null, submittedAt: null, reviewComment: `Reopened: ${reason}` },
    });
    await writeAudit(ctx, {
      action: "payroll.run.reopen",
      entityType: "PayrollRun",
      entityId: runId,
      summary: `Reopened released ${periodLabel(run.period)} (${voided.count} payslips voided): ${reason}`,
      before: { status: "RELEASED", releasedAt: run.releasedAt, releasedById: run.releasedById },
      after: { status: "CALCULATED", reason },
    }, tx);
  });
}

// ───────────────────────────── Read ─────────────────────────────

export async function getRun(ctx: AuthContext, runId: string, filters: { q?: string; view?: "all" | "issues" | "held" | "variance" } = {}) {
  assertCan(ctx, ["payroll.run.manage", "payroll.run.approve", "payroll.export"]);
  const run = await loadRun(db, ctx, runId);
  const users = await db.user.findMany({
    where: { id: { in: [run.createdById, run.calculatedById, run.submittedById, run.approvedById, run.releasedById, run.cancelledById].filter((x): x is string => !!x) } },
    select: { id: true, name: true },
  });
  const who = (id: string | null) => users.find((u) => u.id === id)?.name ?? null;
  const entries = await db.payrollRunEmployee.findMany({ where: { runId }, orderBy: { employeeNumber: "asc" } });
  const q = filters.q?.toLowerCase().trim();
  const rows = entries
    .map((e) => ({ ...e, issues: (e.issues as CalcIssue[]) ?? [], variance: variancePct(n(e.net), e.previousNet === null ? null : n(e.previousNet)) }))
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.employeeNumber.toLowerCase().includes(q) || (e.department ?? "").toLowerCase().includes(q))
    .filter((e) =>
      filters.view === "issues" ? e.issues.length > 0 : filters.view === "held" ? e.status !== "INCLUDED" : filters.view === "variance" ? e.variance !== null && Math.abs(e.variance) >= VARIANCE_WARNING_PCT : true,
    );
  return {
    run,
    people: { createdBy: who(run.createdById), calculatedBy: who(run.calculatedById), submittedBy: who(run.submittedById), approvedBy: who(run.approvedById), releasedBy: who(run.releasedById), cancelledBy: who(run.cancelledById) },
    rows,
    counts: {
      total: entries.length,
      included: entries.filter((e) => e.status === "INCLUDED").length,
      held: entries.filter((e) => e.status !== "INCLUDED").length,
      errors: blockingIssues(entries).length,
    },
    canApprove: ctx.permissions.has("payroll.run.approve") && run.calculatedById !== ctx.userId && run.submittedById !== ctx.userId,
  };
}

export async function getRunEntry(ctx: AuthContext, entryId: string) {
  assertCan(ctx, ["payroll.run.manage", "payroll.run.approve", "payroll.export"]);
  const entry = await db.payrollRunEmployee.findFirst({
    where: { id: entryId, run: { companyId: ctx.companyId } },
    include: { run: true, lines: { orderBy: { sortOrder: "asc" } }, payslip: { select: { id: true, voidedAt: true } } },
  });
  if (!entry) throw new NotFoundError((await serverT("payroll"))("errors.entryNotFound"));
  return { ...entry, issues: (entry.issues as CalcIssue[]) ?? [] };
}

export async function currentRunSummary(ctx: AuthContext, period: string) {
  if (!ctx.permissions.has("payroll.run.manage") && !ctx.permissions.has("payroll.run.approve")) return null;
  return db.payrollRun.findMany({ where: { companyId: ctx.companyId, period, status: { not: "CANCELLED" } }, orderBy: { createdAt: "desc" } });
}
