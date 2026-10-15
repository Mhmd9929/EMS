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

const id = z.string().min(1).max(64);
const refresh = () => revalidatePath("/payroll", "layout");

export async function savePayComponentAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await upsertPayComponent(ctx, parseInput(payComponentSchema, fd));
    refresh();
  }, "Pay component saved.");
}

export async function savePayrollSettingsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await updatePayrollSettings(ctx, parseInput(payrollSettingsSchema, fd));
    refresh();
  }, "Payroll settings saved.");
}

export async function saveSalaryAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(salaryStructureSchema, fd);
    const r = await createSalaryStructure(ctx, input);
    revalidatePath(`/employees/${input.employeeId}`);
    refresh();
    return {
      ok: true,
      message: r.backdatedOverReleased
        ? `Salary saved. It is backdated over released payroll (${r.backdatedOverReleased}) — add an arrears adjustment if the difference must be paid.`
        : "Salary saved.",
    };
  });
}

export async function deleteSalaryAction(structureId: string, employeeId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await deleteSalaryStructure(ctx, id.parse(structureId));
    revalidatePath(`/employees/${employeeId}`);
  }, "Scheduled salary change deleted.");
}

export async function saveAdjustmentAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await createAdjustment(ctx, parseInput(adjustmentSchema, fd));
    refresh();
  }, "Adjustment added.");
}

export async function deleteAdjustmentAction(adjustmentId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await deleteAdjustment(ctx, id.parse(adjustmentId));
    refresh();
  }, "Adjustment deleted.");
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
  return runAction(async () => {
    const r = await calculateRun(ctx, id.parse(runId));
    refresh();
    return { ok: true, message: `Calculated ${r.calculated} employees.${r.skipped.length ? ` Skipped ${r.skipped.length} already in another run for this month.` : ""}` };
  });
}

export async function setEntryStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await setEntryStatus(ctx, parseInput(entryStatusSchema, fd));
    refresh();
  }, "Updated.");
}

export async function submitRunAction(runId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await submitRun(ctx, id.parse(runId));
    refresh();
  }, "Submitted for approval.");
}

export async function approveRunAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(runCommentSchema, fd);
    await approveRun(ctx, input.runId, input.comment);
    refresh();
  }, "Payroll approved.");
}

export async function returnRunAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(runCommentSchema, fd);
    await returnRun(ctx, input.runId, input.comment);
    refresh();
  }, "Sent back for changes.");
}

export async function releaseRunAction(runId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await releaseRun(ctx, id.parse(runId));
    refresh();
    revalidatePath("/payslips");
  }, "Released. Payslips are available to employees.");
}

export async function cancelRunAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(runReasonSchema, fd);
    await cancelRun(ctx, input.runId, input.reason);
    refresh();
  }, "Run cancelled.");
}

export async function reopenRunAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(runReasonSchema, fd);
    await reopenRun(ctx, input.runId, input.reason);
    refresh();
    revalidatePath("/payslips");
  }, "Run reopened. Its payslips are withdrawn until it is released again.");
}

export async function saveSettlementAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(settlementSchema, fd);
    await saveSettlement(ctx, input);
    revalidatePath(`/employees/${input.employeeId}`);
    refresh();
  }, "Final settlement saved as draft.");
}

export async function approveSettlementAction(settlementId: string, employeeId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await approveSettlement(ctx, id.parse(settlementId));
    revalidatePath(`/employees/${employeeId}`);
    refresh();
  }, "Final settlement approved.");
}
