"use client";
import { savePayrollSettingsAction } from "@/server/actions/payroll.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Field, FormSection } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { useTranslations } from "next-intl";

type S = {
  currency: string; payrollProrationBasis: string; wpsEmployerId: string; wpsEmployerBankCode: string; wpsFormat: string;
  gratuityMinServiceYears: number; gratuityDaysFirstYears: number; gratuityThresholdYears: number; gratuityDaysAfter: number; gratuityCapMonths: number;
  gratuityDailyBasis: string; leaveEncashmentBasis: string; payslipPdfPassword: boolean;
};

export function PayrollSettingsForm({ settings: s }: { settings: S }) {
  const t = useTranslations("payroll.settingsForm");
  const { state, onSubmit, pending } = useFormAction(savePayrollSettingsAction);
  useActionFeedback(state);
  const err = (n: string) => fieldError(state, n);
  return (
    <form onSubmit={onSubmit} className="grid max-w-4xl gap-6">
      <FormError state={state} />
      <FormSection title={t("salaryCalc")} description={t("salaryCalcDescription", { currency: s.currency })}>
        <Field label={t("basis")} name="payrollProrationBasis" error={err("payrollProrationBasis")} hint={t("basisHint")} required>
          <NativeSelect defaultValue={s.payrollProrationBasis}>
            <option value="CALENDAR_DAYS">{t("basisCalendar")}</option>
            <option value="THIRTY_DAYS">{t("basisThirty")}</option>
          </NativeSelect>
        </Field>
        <label className="flex items-start gap-2 self-end pb-2 text-sm">
          <Checkbox name="payslipPdfPassword" defaultChecked={s.payslipPdfPassword} className="mt-0.5" />
          <span>
            {t("pdfPassword")}
            <span className="text-muted-foreground block text-xs">{t("pdfPasswordHint")}</span>
          </span>
        </label>
      </FormSection>

      <FormSection title={t("wps")} description={t("wpsDescription")}>
        <Field label={t("employerId")} name="wpsEmployerId" error={err("wpsEmployerId")} hint={t("employerIdHint")}>
          <Input defaultValue={s.wpsEmployerId} inputMode="numeric" maxLength={13} dir="ltr" />
        </Field>
        <Field label={t("bankCode")} name="wpsEmployerBankCode" error={err("wpsEmployerBankCode")} hint={t("bankCodeHint")}>
          <Input defaultValue={s.wpsEmployerBankCode} inputMode="numeric" maxLength={9} dir="ltr" />
        </Field>
        <Field label={t("sifFormat")} name="wpsFormat" error={err("wpsFormat")} required>
          <NativeSelect defaultValue={s.wpsFormat}>
            <option value="UAE_SIF_V1">{t("sifFormatOption")}</option>
          </NativeSelect>
        </Field>
      </FormSection>

      <FormSection title={t("gratuity")} description={t("gratuityDescription")}>
        <Field label={t("minService")} name="gratuityMinServiceYears" error={err("gratuityMinServiceYears")} required>
          <Input type="number" step="0.01" min={0} defaultValue={s.gratuityMinServiceYears} />
        </Field>
        <Field label={t("daysFirst")} name="gratuityDaysFirstYears" error={err("gratuityDaysFirstYears")} required>
          <Input type="number" step="0.01" min={0} defaultValue={s.gratuityDaysFirstYears} />
        </Field>
        <Field label={t("thresholdYears")} name="gratuityThresholdYears" error={err("gratuityThresholdYears")} required>
          <Input type="number" step="0.01" min={0} defaultValue={s.gratuityThresholdYears} />
        </Field>
        <Field label={t("daysAfter")} name="gratuityDaysAfter" error={err("gratuityDaysAfter")} required>
          <Input type="number" step="0.01" min={0} defaultValue={s.gratuityDaysAfter} />
        </Field>
        <Field label={t("cap")} name="gratuityCapMonths" error={err("gratuityCapMonths")} required>
          <Input type="number" step="0.01" min={0} defaultValue={s.gratuityCapMonths} />
        </Field>
        <Field label={t("dailyWage")} name="gratuityDailyBasis" error={err("gratuityDailyBasis")} required>
          <NativeSelect defaultValue={s.gratuityDailyBasis}>
            <option value="DIV30">{t("div30")}</option>
            <option value="DIV365">{t("div365")}</option>
          </NativeSelect>
        </Field>
        <Field label={t("encashment")} name="leaveEncashmentBasis" error={err("leaveEncashmentBasis")} hint={t("encashmentHint")} required>
          <NativeSelect defaultValue={s.leaveEncashmentBasis}>
            <option value="BASIC">{t("encashBasic")}</option>
            <option value="GROSS">{t("encashGross")}</option>
          </NativeSelect>
        </Field>
      </FormSection>
      <div>
        <SubmitButton pending={pending}>{t("save")}</SubmitButton>
      </div>
    </form>
  );
}
