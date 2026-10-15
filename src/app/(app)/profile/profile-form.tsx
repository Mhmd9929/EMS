"use client";
import { updateOwnProfileAction } from "@/server/actions/employee.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Field } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";

export function ProfileForm({ defaults }: { defaults: Record<"preferredName" | "personalEmail" | "phone" | "address" | "maritalStatus", string> }) {
  const { state, onSubmit, pending } = useFormAction(updateOwnProfileAction);
  useActionFeedback(state);
  const err = (n: string) => fieldError(state, n);
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormError state={state} />
      </div>
      <Field label="Preferred name" name="preferredName" error={err("preferredName")}>
        <Input defaultValue={defaults.preferredName} />
      </Field>
      <Field label="Marital status" name="maritalStatus" error={err("maritalStatus")}>
        <NativeSelect defaultValue={defaults.maritalStatus}>
          <option value="">—</option>
          {["Single", "Married", "Divorced", "Widowed"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Mobile phone" name="phone" error={err("phone")}>
        <Input type="tel" defaultValue={defaults.phone} />
      </Field>
      <Field label="Personal email" name="personalEmail" error={err("personalEmail")}>
        <Input type="email" defaultValue={defaults.personalEmail} />
      </Field>
      <Field label="Home address" name="address" error={err("address")} className="sm:col-span-2">
        <Textarea rows={2} defaultValue={defaults.address} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pending={pending}>Save changes</SubmitButton>
      </div>
    </form>
  );
}
