"use client";
import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/server/actions/auth.actions";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import { Alert } from "@/components/ui/alert";
import { fieldError } from "@/components/forms/use-action-feedback";

export function ForgotForm({ labels }: { labels: { email: string; send: string; back: string } }) {
  const [state, action] = useActionState(forgotPasswordAction, null);
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <Alert variant="success">{state.message}</Alert>
        <Link href="/login" className="text-primary text-sm hover:underline">
          {labels.back}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <FormError state={state} />
      <Field label={labels.email} name="email" error={fieldError(state, "email")} required>
        <Input type="email" autoComplete="username" autoFocus />
      </Field>
      <SubmitButton className="w-full">{labels.send}</SubmitButton>
      <Link href="/login" className="text-primary text-center text-sm hover:underline">
        {labels.back}
      </Link>
    </form>
  );
}
