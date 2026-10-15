"use client";
import { saveLeaveSettingsAction } from "@/server/actions/leave.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";

export function LeaveSettingsForm({ escalationDays }: { escalationDays: number }) {
  const { state, onSubmit, pending } = useFormAction(saveLeaveSettingsAction);
  useActionFeedback(state);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <FormError state={state} />
      <Field label="Remind approvers after (days)" name="leaveEscalationDays" error={fieldError(state, "leaveEscalationDays")} hint="Approvers get a reminder when a request waits this long; at the next reminder, manager steps are escalated to HR." required>
        <Input type="number" min={1} max={30} defaultValue={escalationDays} className="w-32" />
      </Field>
      <div>
        <SubmitButton pending={pending}>Save</SubmitButton>
      </div>
    </form>
  );
}
