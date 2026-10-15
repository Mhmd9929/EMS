"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/server/auth/context";
import { parseInput, runAction } from "./result";
import { ValidationError } from "@/server/errors";
import { saveUpload, storage } from "@/server/storage";
import {
  balanceAdjustSchema,
  delegationSchema,
  holidaySchema,
  leaveApplySchema,
  leaveCancelSchema,
  leaveDecisionSchema,
  leavePolicySchema,
  leaveSettingsSchema,
  leaveTypeSchema,
} from "@/lib/validation/leave";
import { requiredDate } from "@/lib/validation/common";
import { decideMany, hrCancelLeave, previewLeave, requestCancellation, submitLeave, withdrawLeave, type LeaveEvaluation } from "@/server/services/leave/request.service";
import { adjustBalance } from "@/server/services/leave/balance.service";
import { copyHolidays, deleteHoliday, updateLeaveSettings, upsertHoliday, upsertLeavePolicy, upsertLeaveType } from "@/server/services/leave/config.service";
import { createDelegation, revokeDelegation } from "@/server/services/leave/delegation.service";
import { markAllRead, markRead } from "@/server/services/notification.service";
import type { ActionResult } from "@/lib/action-result";

const id = z.string().min(1).max(64);

const previewSchema = z.object({
  leaveTypeId: z.string().min(1),
  startDate: requiredDate,
  endDate: requiredDate,
  halfDay: z.enum(["NONE", "FIRST_HALF", "SECOND_HALF"]).default("NONE"),
});

/** Live calculation for the apply form (no side effects). */
export async function previewLeaveAction(input: Record<string, unknown>): Promise<ActionResult<LeaveEvaluation>> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const parsed = previewSchema.safeParse(input);
    if (!parsed.success) return { ok: true, data: undefined };
    return { ok: true, data: await previewLeave(ctx, parsed.data) };
  });
}

export async function applyLeaveAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  let requestId: string | null = null;
  const result = await runAction(async () => {
    const input = parseInput(leaveApplySchema, formData);
    const file = formData.get("attachment");
    let attachmentPath: string | null = null;
    if (file instanceof File && file.size > 0) {
      attachmentPath = await saveUpload(file, { companyId: ctx.companyId, folder: "leave", allowed: ["pdf", "png", "jpg", "webp"], maxMb: 5 });
    }
    try {
      requestId = (await submitLeave(ctx, { ...input, attachmentPath })).id;
    } catch (e) {
      if (attachmentPath) await storage.delete(attachmentPath);
      throw e;
    }
  });
  if (result.ok && requestId) {
    revalidatePath("/leave");
    redirect(`/leave/requests/${requestId}?submitted=1`);
  }
  return result;
}

export async function decideLeaveAction(_prev: ActionResult<{ approved: number; failed: string[] }> | null, formData: FormData): Promise<ActionResult<{ approved: number; failed: string[] }>> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(leaveDecisionSchema, formData);
    if (input.decision === "REJECTED" && !input.comment) throw new ValidationError("Please give a reason when rejecting.", { comment: ["Required when rejecting"] });
    const results = await decideMany(ctx, input.requestIds, input.decision, input.comment);
    revalidatePath("/leave", "layout");
    const ok = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).map((r) => r.error!);
    if (!ok) throw new ValidationError(failed[0] ?? "Nothing was updated.");
    const verb = input.decision === "APPROVED" ? "Approved" : "Rejected";
    return { ok: true, data: { approved: ok, failed }, message: `${verb} ${ok} request${ok === 1 ? "" : "s"}${failed.length ? ` (${failed.length} failed)` : ""}.` };
  });
}

export async function withdrawLeaveAction(requestId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await withdrawLeave(ctx, id.parse(requestId));
    revalidatePath("/leave", "layout");
  }, "Request withdrawn.");
}

export async function requestCancellationAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(leaveCancelSchema, formData);
    await requestCancellation(ctx, input.requestId, input.reason);
    revalidatePath("/leave", "layout");
  }, "Cancellation requested. Your approver has been notified.");
}

export async function hrCancelLeaveAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(leaveCancelSchema, formData);
    await hrCancelLeave(ctx, input.requestId, input.reason);
    revalidatePath("/leave", "layout");
  }, "Leave cancelled.");
}

export async function adjustBalanceAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await adjustBalance(ctx, parseInput(balanceAdjustSchema, formData));
    revalidatePath("/leave", "layout");
  }, "Balance adjusted.");
}

export async function saveLeaveTypeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await upsertLeaveType(ctx, parseInput(leaveTypeSchema, formData));
    revalidatePath("/leave", "layout");
  }, "Leave type saved.");
}

export async function saveLeavePolicyAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await upsertLeavePolicy(ctx, parseInput(leavePolicySchema, formData));
    revalidatePath("/leave/settings");
  }, "Policy saved.");
}

export async function saveHolidayAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const n = await upsertHoliday(ctx, parseInput(holidaySchema, formData));
    revalidatePath("/leave", "layout");
    return { ok: true, message: n > 1 ? `Added ${n} holiday days.` : "Holiday saved." };
  });
}

export async function deleteHolidayAction(holidayId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await deleteHoliday(ctx, id.parse(holidayId));
    revalidatePath("/leave", "layout");
  }, "Holiday removed.");
}

export async function copyHolidaysAction(fromYear: number, toYear: number): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const n = await copyHolidays(ctx, z.number().int().parse(fromYear), z.number().int().parse(toYear));
    revalidatePath("/leave/settings");
    return { ok: true, message: `Copied ${n} holidays. Adjust the lunar (Islamic) holidays to the announced dates.` };
  });
}

export async function saveLeaveSettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await updateLeaveSettings(ctx, parseInput(leaveSettingsSchema, formData));
    revalidatePath("/leave/settings");
  }, "Settings saved.");
}

export async function createDelegationAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await createDelegation(ctx, parseInput(delegationSchema, formData));
    revalidatePath("/leave/approvals");
  }, "Delegation created.");
}

export async function revokeDelegationAction(delegationId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await revokeDelegation(ctx, id.parse(delegationId));
    revalidatePath("/leave/approvals");
  }, "Delegation ended.");
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult<{ link: string | null }>> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const n = await markRead(ctx, id.parse(notificationId));
    revalidatePath("/", "layout");
    return { ok: true, data: { link: n.link } };
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await markAllRead(ctx);
    revalidatePath("/", "layout");
  }, "All caught up.");
}
