"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/server/auth";
import { requireAuth } from "@/server/auth/context";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, setPasswordSchema } from "@/lib/validation/auth";
import { parseInput, runAction } from "./result";
import { acceptInvite, changePassword, requestPasswordReset, resetPassword } from "@/server/services/user.service";
import type { ActionResult } from "@/lib/action-result";

const LOGIN_ERRORS: Record<string, string> = {
  invalid_credentials: "Invalid email or password.",
  rate_limited: "Too many failed attempts. Please wait 15 minutes and try again.",
  account_disabled: "Your account is disabled. Contact HR.",
};

/** Only allow same-site relative redirects after login. */
function safeCallback(url: string | undefined) {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/login")) return "/dashboard";
  return url;
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: "Enter your email and password." };
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeCallback(parsed.data.callbackUrl),
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof CredentialsSignin) return { ok: false, error: LOGIN_ERRORS[error.code] ?? LOGIN_ERRORS.invalid_credentials };
    if (error instanceof AuthError) return { ok: false, error: "Sign-in failed. Please try again." };
    throw error; // NEXT_REDIRECT on success
  }
}

export async function ssoLoginAction(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  if (!["google", "microsoft-entra-id"].includes(provider)) return;
  await signIn(provider, { redirectTo: safeCallback(String(formData.get("callbackUrl") ?? "")) });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function forgotPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { email } = parseInput(forgotPasswordSchema, formData);
    await requestPasswordReset(email);
    return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
  });
}

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const input = parseInput(setPasswordSchema, formData);
    await resetPassword(input.token, input.password);
  });
  if (result.ok) redirect("/login?reset=1");
  return result;
}

export async function acceptInviteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let email: string | null = null;
  let password: string | null = null;
  const result = await runAction(async () => {
    const input = parseInput(setPasswordSchema, formData);
    email = (await acceptInvite(input.token, input.password)).email;
    password = input.password;
  });
  if (!result.ok || !email || !password) return result;
  // Sign straight in after activation.
  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return result;
}

export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth({ allowPendingPasswordChange: true });
  let newPassword: string | null = null;
  const result = await runAction(async () => {
    const input = parseInput(changePasswordSchema, formData);
    await changePassword(ctx, input.currentPassword, input.password);
    newPassword = input.password;
  });
  if (!result.ok || !newPassword) return result;
  // sessionVersion was bumped (signing out other devices); re-issue this device's session.
  await signIn("credentials", { email: ctx.email, password: newPassword, redirectTo: safeCallback(String(formData.get("redirectTo") ?? "")) });
  return result;
}
