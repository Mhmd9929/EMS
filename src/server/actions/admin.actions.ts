"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/server/auth/context";
import { parseInput, runAction } from "./result";
import { deleteRole, setCompanyLogo, updateCompanySettings, upsertRole } from "@/server/services/admin.service";
import { adminSendPasswordReset, revokeSessions, sendInvite, setUserActive, setUserRoles } from "@/server/services/user.service";
import { companySettingsSchema, roleSchema, userRolesSchema } from "@/lib/validation/admin";
import { saveUpload, storage } from "@/server/storage";
import { ValidationError } from "@/server/errors";
import type { ActionResult } from "@/lib/action-result";

const id = z.string().min(1).max(64);

export async function saveRoleAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await upsertRole(ctx, parseInput(roleSchema, formData));
    revalidatePath("/admin/roles");
  }, "Role saved.");
}

export async function deleteRoleAction(roleId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await deleteRole(ctx, id.parse(roleId));
    revalidatePath("/admin/roles");
  }, "Role deleted.");
}

export async function saveUserRolesAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(userRolesSchema, formData);
    await setUserRoles(ctx, input.userId, input.roleIds);
    revalidatePath("/admin/users");
  }, "Roles updated.");
}

export async function sendInviteAction(userId: string): Promise<ActionResult<{ link: string | null }>> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const result = await sendInvite(ctx, id.parse(userId));
    return { ok: true, data: result, message: "Invitation sent." };
  });
}

export async function adminResetPasswordAction(userId: string): Promise<ActionResult<{ link: string | null }>> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const result = await adminSendPasswordReset(ctx, id.parse(userId));
    return { ok: true, data: result, message: "Password reset email sent." };
  });
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await setUserActive(ctx, id.parse(userId), z.boolean().parse(active));
    revalidatePath("/admin/users");
  }, active ? "User activated." : "User deactivated.");
}

export async function revokeSessionsAction(userId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(() => revokeSessions(ctx, id.parse(userId)), "User signed out of all sessions.");
}

export async function saveCompanySettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await updateCompanySettings(ctx, parseInput(companySettingsSchema, formData));
    revalidatePath("/", "layout");
  }, "Company settings saved.");
}

export async function uploadLogoAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const file = formData.get("logo");
    if (!(file instanceof File)) throw new ValidationError("Please choose an image.");
    const key = await saveUpload(file, { companyId: ctx.companyId, folder: "branding", allowed: ["png", "jpg", "webp"], maxMb: 2 });
    const previous = await setCompanyLogo(ctx, key).catch(async (e) => {
      await storage.delete(key);
      throw e;
    });
    if (previous) await storage.delete(previous);
    revalidatePath("/", "layout");
  }, "Logo updated.");
}
