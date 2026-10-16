"use client";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("profile");
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormError state={state} />
      </div>
      <Field label={t("form.preferredName")} name="preferredName" error={err("preferredName")}>
        <Input defaultValue={defaults.preferredName} />
      </Field>
      <Field label={t("form.maritalStatus")} name="maritalStatus" error={err("maritalStatus")}>
        <NativeSelect defaultValue={defaults.maritalStatus}>
          <option value="">—</option>
          {(["Single", "Married", "Divorced", "Widowed"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`maritalStatus.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("form.mobilePhone")} name="phone" error={err("phone")}>
        <Input type="tel" defaultValue={defaults.phone} />
      </Field>
      <Field label={t("form.personalEmail")} name="personalEmail" error={err("personalEmail")}>
        <Input type="email" defaultValue={defaults.personalEmail} />
      </Field>
      <Field label={t("form.homeAddress")} name="address" error={err("address")} className="sm:col-span-2">
        <Textarea rows={2} defaultValue={defaults.address} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pending={pending}>{t("form.saveChanges")}</SubmitButton>
      </div>
    </form>
  );
}
