"use client";
import { useRouter } from "next/navigation";
import { saveSettlementAction } from "@/server/actions/payroll.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, Textarea } from "@/components/ui/input";

export function SettlementForm({ employeeId, currency }: { employeeId: string; currency: string }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(saveSettlementAction);
  useActionFeedback(state, { onSuccess: () => router.refresh() });
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <FormError state={state} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Other earnings (${currency})`} name="otherEarnings" error={fieldError(state, "otherEarnings")} hint="e.g. notice pay, airfare">
          <Input inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label={`Deductions (${currency})`} name="deductions" error={fieldError(state, "deductions")} hint="e.g. loan balance, unreturned assets">
          <Input inputMode="decimal" placeholder="0.00" />
        </Field>
      </div>
      <Field label="Notes" name="notes" error={fieldError(state, "notes")}>
        <Textarea rows={2} />
      </Field>
      <div>
        <SubmitButton pending={pending}>Save draft settlement</SubmitButton>
      </div>
    </form>
  );
}
