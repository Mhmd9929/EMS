"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/server/auth/context";
import { parseInput, runAction } from "./result";
import {
  adjustmentSchema,
  createRunSchema,
  entryStatusSchema,
  payComponentSchema,
  payrollSettingsSchema,
  runCommentSchema,
  runReasonSchema,
  salaryStructureSchema,
  settlementSchema,
} from "@/lib/validation/payroll";
import { upsertPayComponent, updatePayrollSettings } from "@/server/services/payroll/settings.service";
import { createSalaryStructure, deleteSalaryStructure } from "@/server/services/payroll/salary.service";
import { createAdjustment, deleteAdjustment } from "@/server/services/payroll/adjustment.service";
import { approveRun, calculateRun, cancelRun, createRun, releaseRun, reopenRun, returnRun, setEntryStatus, submitRun } from "@/server/services/payroll/run.service";
import { approveSettlement, saveSettlement } from "@/server/services/payroll/settlement.service";
import type { ActionResult } from "@/lib/action-result";
import { serverT } from "@/server/i18n";

const id = z.string().min(1).max(64);
const refresh = () => revalidatePath("/payroll", "layout");

export async function savePayComponentAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    await upsertPayComponent(ctx, parseInput(payComponentSchema, fd));
    refresh();
  }, t("success.componentSaved"));
}

export async function savePayrollSettingsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    await updatePayrollSettings(ctx, parseInput(payrollSettingsSchema, fd));
    refresh();
  }, t("success.settingsSaved"));
}

export async function saveSalaryAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    const input = parseInput(salaryStructureSchema, fd);
    const r = await createSalaryStructure(ctx, input);
    revalidatePath(`/employees/${input.employeeId}`);
    refresh();
    return {
      ok: true,
      message: r.backdatedOverReleased ? t("success.salaryBackdated", { period: r.backdatedOverReleased }) : t("success.salarySaved"),
    };
  });
}

export async function deleteSalaryAction(structureId: string, employeeId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    await deleteSalaryStructure(ctx, id.parse(structureId));
    revalidatePath(`/employees/${employeeId}`);
  }, t("success.salaryDeleted"));
}

export async function saveAdjustmentAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    await createAdjustment(ctx, parseInput(adjustmentSchema, fd));
    refresh();
  }, t("success.adjustmentAdded"));
}

export async function deleteAdjustmentAction(adjustmentId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    await deleteAdjustment(ctx, id.parse(adjustmentId));
    refresh();
  }, t("success.adjustmentDeleted"));
}

export async function createRunAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  let runId: string | null = null;
  const result = await runAction(async () => {
    runId = (await createRun(ctx, parseInput(createRunSchema, fd))).id;
  });
  if (result.ok && runId) {
    refresh();
    redirect(`/payroll/runs/${runId}`);
  }
  return result;
}

export async function calculateRunAction(runId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    const r = await calculateRun(ctx, id.parse(runId));
    refresh();
    return {
      ok: true,
      message: r.skipped.length ? t("success.calculatedSkipped", { count: r.calculated, skipped: r.skipped.length }) : t("success.calculated", { count: r.calculated }),
    };
  });
}

export async function setEntryStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    await setEntryStatus(ctx, parseInput(entryStatusSchema, fd));
    refresh();
  }, t("success.entryUpdated"));
}

export async function submitRunAction(runId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    await submitRun(ctx, id.parse(runId));
    refresh();
  }, t("success.submitted"));
}

export async function approveRunAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    const input = parseInput(runCommentSchema, fd);
    await approveRun(ctx, input.runId, input.comment);
    refresh();
  }, t("success.approved"));
}

export async function returnRunAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    const input = parseInput(runCommentSchema, fd);
    await returnRun(ctx, input.runId, input.comment);
    refresh();
  }, t("success.returned"));
}

export async function releaseRunAction(runId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    await releaseRun(ctx, id.parse(runId));
    refresh();
    revalidatePath("/payslips");
  }, t("success.released"));
}

export async function cancelRunAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    const input = parseInput(runReasonSchema, fd);
    await cancelRun(ctx, input.runId, input.reason);
    refresh();
  }, t("success.cancelled"));
}

export async function reopenRunAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    const input = parseInput(runReasonSchema, fd);
    await reopenRun(ctx, input.runId, input.reason);
    refresh();
    revalidatePath("/payslips");
  }, t("success.reopened"));
}

export async function saveSettlementAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    const input = parseInput(settlementSchema, fd);
    await saveSettlement(ctx, input);
    revalidatePath(`/employees/${input.employeeId}`);
    refresh();
  }, t("success.settlementSaved"));
}

export async function approveSettlementAction(settlementId: string, employeeId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  const t = await serverT("payroll");
  return runAction(async () => {
    await approveSettlement(ctx, id.parse(settlementId));
    revalidatePath(`/employees/${employeeId}`);
    refresh();
  }, t("success.settlementApproved"));
}
