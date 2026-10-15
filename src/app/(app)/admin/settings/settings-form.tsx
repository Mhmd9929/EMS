"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { saveCompanySettingsAction, uploadLogoAction } from "@/server/actions/admin.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Field, FormSection } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { CURRENCIES, MONTHS, TIMEZONES, UAE_EMIRATES } from "@/lib/constants";
import { WEEKDAYS } from "@/lib/dates";
import { formatEmployeeNumber } from "@/lib/employee-number";

type Company = {
  name: string; legalName: string; addressLine1: string; addressLine2: string; city: string; emirate: string; country: string;
  phone: string; email: string; website: string; tradeLicenseNumber: string; currency: string; timezone: string; workWeek: number[];
  fiscalYearStartMonth: number; employeeNumberPrefix: string; employeeNumberPadding: number;
};

export function CompanySettingsForm({ company }: { company: Company }) {
  const router = useRouter();
  const { state, onSubmit, pending } = useFormAction(saveCompanySettingsAction);
  useActionFeedback(state, { onSuccess: () => router.refresh() });
  const err = (n: string) => fieldError(state, n);
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <FormError state={state} />
      <FormSection title="Company">
        <Field label="Display name" name="name" error={err("name")} required>
          <Input defaultValue={company.name} />
        </Field>
        <Field label="Legal name" name="legalName" error={err("legalName")}>
          <Input defaultValue={company.legalName} />
        </Field>
        <Field label="Trade licence number" name="tradeLicenseNumber" error={err("tradeLicenseNumber")}>
          <Input defaultValue={company.tradeLicenseNumber} />
        </Field>
        <Field label="Website" name="website" error={err("website")}>
          <Input defaultValue={company.website} />
        </Field>
        <Field label="Phone" name="phone" error={err("phone")}>
          <Input defaultValue={company.phone} />
        </Field>
        <Field label="HR email" name="email" error={err("email")}>
          <Input type="email" defaultValue={company.email} />
        </Field>
      </FormSection>
      <FormSection title="Address">
        <Field label="Address line 1" name="addressLine1" error={err("addressLine1")}>
          <Input defaultValue={company.addressLine1} />
        </Field>
        <Field label="Address line 2" name="addressLine2" error={err("addressLine2")}>
          <Input defaultValue={company.addressLine2} />
        </Field>
        <Field label="City" name="city" error={err("city")}>
          <Input defaultValue={company.city} />
        </Field>
        <Field label="Emirate" name="emirate" error={err("emirate")}>
          <NativeSelect defaultValue={company.emirate}>
            <option value="">—</option>
            {UAE_EMIRATES.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Country (ISO)" name="country" error={err("country")}>
          <Input defaultValue={company.country} maxLength={2} className="uppercase" />
        </Field>
      </FormSection>
      <FormSection title="Locale & calendar" description="Dates are stored in UTC and shown in this timezone.">
        <Field label="Currency" name="currency" error={err("currency")}>
          <NativeSelect defaultValue={company.currency}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Timezone" name="timezone" error={err("timezone")}>
          <NativeSelect defaultValue={company.timezone}>
            {TIMEZONES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Fiscal year starts" name="fiscalYearStartMonth" error={err("fiscalYearStartMonth")}>
          <NativeSelect defaultValue={String(company.fiscalYearStartMonth)}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <fieldset className="grid gap-1.5 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">Working days</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <label key={d.value} className="has-[:checked]:bg-primary/10 has-[:checked]:border-primary flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <Checkbox name="workWeek" value={d.value} defaultChecked={company.workWeek.includes(d.value)} />
                {d.short}
              </label>
            ))}
          </div>
          {err("workWeek") && <p className="text-destructive text-xs">{err("workWeek")![0]}</p>}
        </fieldset>
      </FormSection>
      <FormSection title="Employee numbers" description={`Example: ${formatEmployeeNumber(company.employeeNumberPrefix, 42, company.employeeNumberPadding)}. Applies to new employees only.`}>
        <Field label="Prefix" name="employeeNumberPrefix" error={err("employeeNumberPrefix")}>
          <Input defaultValue={company.employeeNumberPrefix} />
        </Field>
        <Field label="Digits" name="employeeNumberPadding" error={err("employeeNumberPadding")}>
          <Input type="number" min={1} max={10} defaultValue={company.employeeNumberPadding} />
        </Field>
      </FormSection>
      <div>
        <SubmitButton pending={pending}>Save settings</SubmitButton>
      </div>
    </form>
  );
}

export function LogoUpload({ hasLogo }: { hasLogo: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const { state, onSubmit, pending } = useFormAction(uploadLogoAction);
  useActionFeedback(state, { onSuccess: () => router.refresh() });
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      {hasLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/files/logo?t=${Date.now()}`} alt="Company logo" className="bg-muted h-20 w-auto rounded-md object-contain p-2" />
      )}
      <label htmlFor="logo" className="sr-only">
        Logo file
      </label>
      <input
        id="logo"
        name="logo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={pending}
        onChange={() => ref.current?.requestSubmit()}
        className="text-muted-foreground file:bg-secondary file:text-foreground text-sm file:me-2 file:rounded-md file:border-0 file:px-3 file:py-1.5"
      />
      <FormError state={state} />
    </form>
  );
}
