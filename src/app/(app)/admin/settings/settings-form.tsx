"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useFormat } from "@/components/i18n/use-format";
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
  const t = useTranslations("admin.settings");
  const te = useTranslations("enums");
  const f = useFormat();
  // Month and weekday names come from Intl in the current language (2024-01-01 was a Monday).
  const monthName = new Intl.DateTimeFormat(f.intl, { month: "long", timeZone: "UTC" });
  const weekdayName = (isoDay: number) => f.weekday(new Date(Date.UTC(2024, 0, isoDay)));
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <FormError state={state} />
      <FormSection title={t("sections.company")}>
        <Field label={t("fields.name")} name="name" error={err("name")} required>
          <Input defaultValue={company.name} />
        </Field>
        <Field label={t("fields.legalName")} name="legalName" error={err("legalName")}>
          <Input defaultValue={company.legalName} />
        </Field>
        <Field label={t("fields.tradeLicenseNumber")} name="tradeLicenseNumber" error={err("tradeLicenseNumber")}>
          <Input defaultValue={company.tradeLicenseNumber} />
        </Field>
        <Field label={t("fields.website")} name="website" error={err("website")}>
          <Input defaultValue={company.website} />
        </Field>
        <Field label={t("fields.phone")} name="phone" error={err("phone")}>
          <Input defaultValue={company.phone} />
        </Field>
        <Field label={t("fields.email")} name="email" error={err("email")}>
          <Input type="email" dir="ltr" defaultValue={company.email} />
        </Field>
      </FormSection>
      <FormSection title={t("sections.address")}>
        <Field label={t("fields.addressLine1")} name="addressLine1" error={err("addressLine1")}>
          <Input defaultValue={company.addressLine1} />
        </Field>
        <Field label={t("fields.addressLine2")} name="addressLine2" error={err("addressLine2")}>
          <Input defaultValue={company.addressLine2} />
        </Field>
        <Field label={t("fields.city")} name="city" error={err("city")}>
          <Input defaultValue={company.city} />
        </Field>
        <Field label={t("fields.emirate")} name="emirate" error={err("emirate")}>
          <NativeSelect defaultValue={company.emirate}>
            <option value="">—</option>
            {UAE_EMIRATES.map((e) => (
              <option key={e} value={e}>
                {te(`emirate.${e}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("fields.country")} name="country" error={err("country")}>
          <Input defaultValue={company.country} maxLength={2} className="uppercase" />
        </Field>
      </FormSection>
      <FormSection title={t("sections.locale")} description={t("sections.localeDescription")}>
        <Field label={t("fields.currency")} name="currency" error={err("currency")}>
          <NativeSelect defaultValue={company.currency}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("fields.timezone")} name="timezone" error={err("timezone")}>
          <NativeSelect defaultValue={company.timezone}>
            {TIMEZONES.map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("fields.fiscalYearStartMonth")} name="fiscalYearStartMonth" error={err("fiscalYearStartMonth")}>
          <NativeSelect defaultValue={String(company.fiscalYearStartMonth)}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {monthName.format(new Date(Date.UTC(2024, i, 1)))}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <fieldset className="grid gap-1.5 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">{t("fields.workWeek")}</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <label key={d.value} className="has-[:checked]:bg-primary/10 has-[:checked]:border-primary flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <Checkbox name="workWeek" value={d.value} defaultChecked={company.workWeek.includes(d.value)} />
                {weekdayName(d.value)}
              </label>
            ))}
          </div>
          {err("workWeek") && <p className="text-destructive text-xs">{err("workWeek")![0]}</p>}
        </fieldset>
      </FormSection>
      <FormSection
        title={t("sections.employeeNumbers")}
        description={t("sections.employeeNumbersDescription", { example: formatEmployeeNumber(company.employeeNumberPrefix, 42, company.employeeNumberPadding) })}
      >
        <Field label={t("fields.prefix")} name="employeeNumberPrefix" error={err("employeeNumberPrefix")}>
          <Input defaultValue={company.employeeNumberPrefix} />
        </Field>
        <Field label={t("fields.digits")} name="employeeNumberPadding" error={err("employeeNumberPadding")}>
          <Input type="number" min={1} max={10} defaultValue={company.employeeNumberPadding} />
        </Field>
      </FormSection>
      <div>
        <SubmitButton pending={pending}>{t("save")}</SubmitButton>
      </div>
    </form>
  );
}

export function LogoUpload({ hasLogo }: { hasLogo: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const { state, onSubmit, pending } = useFormAction(uploadLogoAction);
  useActionFeedback(state, { onSuccess: () => router.refresh() });
  const t = useTranslations("admin.settings");
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      {hasLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/files/logo?t=${Date.now()}`} alt={t("logoAlt")} className="bg-muted h-20 w-auto rounded-md object-contain p-2" />
      )}
      <label htmlFor="logo" className="sr-only">
        {t("logoFile")}
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
