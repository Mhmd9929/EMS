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
    return {
      ok: true,
      message: e.status === "TERMINATED" ? "Employee terminated and login disabled." : "Termination scheduled. Login will be blocked after the last working day.",
    };
  });
}

export async function cancelTerminationAction(employeeId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await cancelTermination(ctx, z.string().min(1).parse(employeeId));
    revalidatePath(`/employees/${employeeId}`);
  }, "Scheduled termination cancelled.");
}

export async function updateOwnProfileAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await updateOwnProfile(ctx, parseInput(selfProfileSchema, formData));
    revalidatePath("/profile");
  }, "Profile updated.");
}

export async function saveEmergencyContactAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(emergencyContactSchema, formData);
    const employeeId = input.employeeId ?? ctx.employeeId;
    if (!employeeId) throw new ValidationError("No employee record linked to your account.");
    await upsertEmergencyContact(ctx, { ...input, employeeId });
    revalidatePath("/profile");
    revalidatePath(`/employees/${employeeId}`);
  }, "Emergency contact saved.");
}

export async function deleteEmergencyContactAction(contactId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await deleteEmergencyContact(ctx, z.string().min(1).parse(contactId));
    revalidatePath("/profile");
  }, "Emergency contact removed.");
}

export async function uploadPhotoAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const employeeId = z.string().min(1).parse(formData.get("employeeId") || ctx.employeeId);
    const file = formData.get("photo");
    if (!(file instanceof File)) throw new ValidationError("Please choose an image.");
    const key = await saveUpload(file, { companyId: ctx.companyId, folder: "photos", allowed: ["png", "jpg", "webp"], maxMb: 2 });
    const previous = await setEmployeePhoto(ctx, employeeId, key).catch(async (e) => {
      await storage.delete(key);
      throw e;
    });
    if (previous) await storage.delete(previous);
    revalidatePath("/", "layout");
  }, "Photo updated.");
}

export async function removePhotoAction(employeeId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const previous = await setEmployeePhoto(ctx, z.string().min(1).parse(employeeId), null);
    if (previous) await storage.delete(previous);
    revalidatePath("/", "layout");
  }, "Photo removed.");
}

const MAX_CSV_BYTES = 2 * 1024 * 1024;

async function readCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new ValidationError("Please choose a CSV file.");
  if (file.size > MAX_CSV_BYTES) throw new ValidationError("CSV is too large (max 2 MB).");
  const text = await file.text();
  if (text.includes("\u0000")) throw new ValidationError("That doesn't look like a CSV file.");
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
    return { ok: true, data: result, message: `Imported ${result.created} employees.` };
  });
}
