"use client";
import { useActionState } from "react";
import { changePasswordAction } from "@/server/actions/auth.actions";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import { fieldError } from "@/components/forms/use-action-feedback";

export function ChangePasswordForm({
  redirectTo = "/dashboard",
  labels,
}: {
  redirectTo?: string;
  labels: { current: string; password: string; confirm: string; hint: string; submit: string };
}) {
  const [state, action] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="grid gap-4">
      <FormError state={state} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Field label={labels.current} name="currentPassword" error={fieldError(state, "currentPassword")} required>
        <Input type="password" autoComplete="current-password" />
      </Field>
      <Field label={labels.password} name="password" hint={labels.hint} error={fieldError(state, "password")} required>
        <Input type="password" autoComplete="new-password" />
      </Field>
      <Field label={labels.confirm} name="confirmPassword" error={fieldError(state, "confirmPassword")} required>
        <Input type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton>{labels.submit}</SubmitButton>
    </form>
  );
}
