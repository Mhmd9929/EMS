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
import { serverT } from "@/server/i18n";

const id = z.string().min(1).max(64);

export async function saveRoleAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await upsertRole(ctx, parseInput(roleSchema, formData));
    revalidatePath("/admin/roles");
  }, (await serverT("admin"))("roles.saved"));
}

export async function deleteRoleAction(roleId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await deleteRole(ctx, id.parse(roleId));
    revalidatePath("/admin/roles");
  }, (await serverT("admin"))("roles.deleted"));
}

export async function saveUserRolesAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const input = parseInput(userRolesSchema, formData);
    await setUserRoles(ctx, input.userId, input.roleIds);
    revalidatePath("/admin/users");
  }, (await serverT("admin"))("users.rolesUpdated"));
}

export async function sendInviteAction(userId: string): Promise<ActionResult<{ link: string | null }>> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const result = await sendInvite(ctx, id.parse(userId));
    return { ok: true, data: result, message: (await serverT("admin"))("users.inviteSent") };
  });
}

export async function adminResetPasswordAction(userId: string): Promise<ActionResult<{ link: string | null }>> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const result = await adminSendPasswordReset(ctx, id.parse(userId));
    return { ok: true, data: result, message: (await serverT("admin"))("users.resetSent") };
  });
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await setUserActive(ctx, id.parse(userId), z.boolean().parse(active));
    revalidatePath("/admin/users");
  }, (await serverT("admin"))(active ? "users.activated" : "users.deactivated"));
}

export async function revokeSessionsAction(userId: string): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(() => revokeSessions(ctx, id.parse(userId)), (await serverT("admin"))("users.sessionsRevoked"));
}

export async function saveCompanySettingsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    await updateCompanySettings(ctx, parseInput(companySettingsSchema, formData));
    revalidatePath("/", "layout");
  }, (await serverT("admin"))("settings.saved"));
}

export async function uploadLogoAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();
  return runAction(async () => {
    const file = formData.get("logo");
    if (!(file instanceof File)) throw new ValidationError((await serverT("admin"))("settings.chooseImage"));
    const key = await saveUpload(file, { companyId: ctx.companyId, folder: "branding", allowed: ["png", "jpg", "webp"], maxMb: 2 });
    const previous = await setCompanyLogo(ctx, key).catch(async (e) => {
      await storage.delete(key);
      throw e;
    });
    if (previous) await storage.delete(previous);
    revalidatePath("/", "layout");
  }, (await serverT("admin"))("settings.logoUpdated"));
}
