"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { loginAction } from "@/server/actions/auth.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";

export function LoginForm({
  callbackUrl,
  labels,
}: {
  callbackUrl?: string;
  labels: { email: string; password: string; signIn: string; signingIn: string; forgot: string };
}) {
  const { state, onSubmit, pending } = useFormAction(loginAction);
  const passwordRef = useRef<HTMLInputElement>(null);
  // Keep the email after a failed attempt, but clear the password.
  useEffect(() => {
    if (state && !state.ok && passwordRef.current) {
      passwordRef.current.value = "";
      passwordRef.current.focus();
    }
  }, [state]);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormError state={state} />
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <div className="grid gap-1.5">
        <Label htmlFor="email">{labels.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{labels.password}</Label>
          <Link href="/forgot-password" className="text-primary text-xs hover:underline">
            {labels.forgot}
          </Link>
        </div>
        <Input ref={passwordRef} id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <SubmitButton className="w-full" pending={pending} pendingText={labels.signingIn}>
        {labels.signIn}
      </SubmitButton>
    </form>
  );
}
