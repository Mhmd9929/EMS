"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/server/auth/context";
import { parseInput, runAction } from "./result";
import {
  cancelTermination,
  createEmployee,
  deleteEmergencyContact,
  setEmployeePhoto,
  terminateEmployee,
  updateEmployee,
  updateOwnProfile,
  upsertEmergencyContact,
} from "@/server/services/employee.service";
import {
  emergencyContactSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  selfProfileSchema,
  terminateEmployeeSchema,
} from "@/lib/validation/employee";
import { saveUpload, storage } from "@/server/storage";
import { ValidationError } from "@/server/errors";
import { commitImport, previewImport, type ImportPreview } from "@/server/services/import.service";
import type { ActionResult } from "@/lib/action-result";
import { serverT } from "@/server/i18n";

const tEmp = () => serverT("employees");

export async function createEmployeeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  let id: string | null = null;
  const result = await runAction(async () => {
    const employee = await createEmployee(ctx, parseInput(employeeCreateSchema, formData));
    id = employee.id;
  });
  if (result.ok && id) {
    revalidatePath("/employees");
    redirect(`/employees/${id}?created=1`);
  }
  return result;
}

export async function updateEmployeeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  const result = await runAction(() => updateEmployee(ctx, parseInput(employeeUpdateSchema, formData)).then(() => undefined));
  if (result.ok) {
    const id = String(formData.get("id"));
    revalidatePath(`/employees/${id}`);
    redirect(`/employees/${id}?updated=1`);
  }
  return result;
}

export async function terminateEmployeeAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(terminateEmployeeSchema, formData);
    const e = await terminateEmployee(ctx, input);
    revalidatePath(`/employees/${input.id}`);
    revalidatePath("/employees");
    const t = await tEmp();
    return {
      ok: true,
      message: e.status === "TERMINATED" ? t("messages.terminated") : t("messages.terminationScheduled"),
    };
  });
}

export async function cancelTerminationAction(employeeId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await cancelTermination(ctx, z.string().min(1).parse(employeeId));
    revalidatePath(`/employees/${employeeId}`);
  }, (await tEmp())("messages.terminationCancelled"));
}

export async function updateOwnProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await updateOwnProfile(ctx, parseInput(selfProfileSchema, formData));
    revalidatePath("/profile");
  }, (await tEmp())("messages.profileUpdated"));
}

export async function saveEmergencyContactAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(emergencyContactSchema, formData);
    const employeeId = input.employeeId ?? ctx.employeeId;
    if (!employeeId) throw new ValidationError((await tEmp())("errors.noEmployeeLinked"));
    await upsertEmergencyContact(ctx, { ...input, employeeId });
    revalidatePath("/profile");
    revalidatePath(`/employees/${employeeId}`);
  }, (await tEmp())("messages.contactSaved"));
}

export async function deleteEmergencyContactAction(contactId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await deleteEmergencyContact(ctx, z.string().min(1).parse(contactId));
    revalidatePath("/profile");
  }, (await tEmp())("messages.contactRemoved"));
}

export async function uploadPhotoAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const employeeId = z.string().min(1).parse(formData.get("employeeId") || ctx.employeeId);
    const file = formData.get("photo");
    if (!(file instanceof File)) throw new ValidationError((await tEmp())("errors.chooseImage"));
    const key = await saveUpload(file, { companyId: ctx.companyId, folder: "photos", allowed: ["png", "jpg", "webp"], maxMb: 2 });
    const previous = await setEmployeePhoto(ctx, employeeId, key).catch(async (e) => {
      await storage.delete(key);
      throw e;
    });
    if (previous) await storage.delete(previous);
    revalidatePath("/", "layout");
  }, (await tEmp())("messages.photoUpdated"));
}

export async function removePhotoAction(employeeId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const previous = await setEmployeePhoto(ctx, z.string().min(1).parse(employeeId), null);
    if (previous) await storage.delete(previous);
    revalidatePath("/", "layout");
  }, (await tEmp())("messages.photoRemoved"));
}

const MAX_CSV_BYTES = 2 * 1024 * 1024;

async function readCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new ValidationError((await tEmp())("errors.chooseCsv"));
  if (file.size > MAX_CSV_BYTES) throw new ValidationError((await tEmp())("errors.csvTooLarge"));
  const text = await file.text();
  if (text.includes("\u0000")) throw new ValidationError((await tEmp())("errors.notCsv"));
  return text;
}

export async function previewImportAction(_prev: ActionResult<ImportPreview> | null, formData: FormData): Promise<ActionResult<ImportPreview>> {
  const ctx = await requireAuth();
  return runAction(async () => previewImport(ctx, await readCsv(formData)));
}

export async function commitImportAction(_prev: ActionResult<{ created: number; invited: number }> | null, formData: FormData): Promise<ActionResult<{ created: number; invited: number }>> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const result = await commitImport(ctx, await readCsv(formData), { sendInvites: formData.get("sendInvites") === "on" });
    revalidatePath("/employees");
    return { ok: true, data: result, message: (await tEmp())("messages.imported", { count: result.created }) };
  });
}
