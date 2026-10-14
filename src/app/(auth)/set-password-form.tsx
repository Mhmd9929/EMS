"use client";
import { useActionState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import { fieldError } from "@/components/forms/use-action-feedback";

/** Shared by invite acceptance and password reset. */
export function SetPasswordForm({
  token,
  action: serverAction,
  labels,
}: {
  token: string;
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  labels: { password: string; confirm: string; hint: string; submit: string };
}) {
  const [state, action] = useActionState(serverAction, null);
  return (
    <form action={action} className="grid gap-4">
      <FormError state={state} />
      <input type="hidden" name="token" value={token} />
      <Field label={labels.password} name="password" hint={labels.hint} error={fieldError(state, "password")} required>
        <Input type="password" autoComplete="new-password" autoFocus />
      </Field>
      <Field label={labels.confirm} name="confirmPassword" error={fieldError(state, "confirmPassword")} required>
        <Input type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton className="w-full">{labels.submit}</SubmitButton>
    </form>
  );
}
