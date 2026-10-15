"use client";
import { savePayrollSettingsAction } from "@/server/actions/payroll.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Field, FormSection } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";

type S = {
  currency: string; payrollProrationBasis: string; wpsEmployerId: string; wpsEmployerBankCode: string; wpsFormat: string;
  gratuityMinServiceYears: number; gratuityDaysFirstYears: number; gratuityThresholdYears: number; gratuityDaysAfter: number; gratuityCapMonths: number;
  gratuityDailyBasis: string; leaveEncashmentBasis: string; payslipPdfPassword: boolean;
};

export function PayrollSettingsForm({ settings: s }: { settings: S }) {
  const { state, onSubmit, pending } = useFormAction(savePayrollSettingsAction);
  useActionFeedback(state);
  const err = (n: string) => fieldError(state, n);
  return (
    <form onSubmit={onSubmit} className="grid max-w-4xl gap-6">
      <FormError state={state} />
      <FormSection title="Salary calculation" description={`Amounts are in ${s.currency} (company currency).`}>
        <Field label="Pro-rata basis" name="payrollProrationBasis" error={err("payrollProrationBasis")} hint="Used for joiners, leavers, salary changes mid-month and unpaid leave." required>
          <NativeSelect defaultValue={s.payrollProrationBasis}>
            <option value="CALENDAR_DAYS">Calendar days in the month (28–31)</option>
            <option value="THIRTY_DAYS">Fixed 30-day month</option>
          </NativeSelect>
        </Field>
        <label className="flex items-start gap-2 self-end pb-2 text-sm">
          <Checkbox name="payslipPdfPassword" defaultChecked={s.payslipPdfPassword} className="mt-0.5" />
          <span>
            Password-protect payslip PDFs
            <span className="text-muted-foreground block text-xs">Password: date of birth as DDMMYYYY (employee number if no date of birth).</span>
          </span>
        </label>
      </FormSection>

      <FormSection title="WPS (Wage Protection System)" description="Printed in the SIF header. Get these from your bank / MOHRE registration.">
        <Field label="Employer ID (MOHRE establishment ID)" name="wpsEmployerId" error={err("wpsEmployerId")} hint="13 digits">
          <Input defaultValue={s.wpsEmployerId} inputMode="numeric" maxLength={13} />
        </Field>
        <Field label="Employer bank routing code" name="wpsEmployerBankCode" error={err("wpsEmployerBankCode")} hint="9-digit agent ID of the bank that submits the file">
          <Input defaultValue={s.wpsEmployerBankCode} inputMode="numeric" maxLength={9} />
        </Field>
        <Field label="SIF format" name="wpsFormat" error={err("wpsFormat")} required>
          <NativeSelect defaultValue={s.wpsFormat}>
            <option value="UAE_SIF_V1">UAE SIF (EDR + SCR, CSV)</option>
          </NativeSelect>
        </Field>
      </FormSection>

      <FormSection title="End-of-service gratuity" description="Defaults follow UAE Labour Law (Federal Decree-Law 33/2021): 21 days' basic per year for the first 5 years, 30 days after, capped at 2 years' wages, nothing under 1 year.">
        <Field label="Minimum service (years)" name="gratuityMinServiceYears" error={err("gratuityMinServiceYears")} required>
          <Input type="number" step="0.01" min={0} defaultValue={s.gratuityMinServiceYears} />
        </Field>
        <Field label="Days per year — first years" name="gratuityDaysFirstYears" error={err("gratuityDaysFirstYears")} required>
          <Input type="number" step="0.01" min={0} defaultValue={s.gratuityDaysFirstYears} />
        </Field>
        <Field label="Number of first years" name="gratuityThresholdYears" error={err("gratuityThresholdYears")} required>
          <Input type="number" step="0.01" min={0} defaultValue={s.gratuityThresholdYears} />
        </Field>
        <Field label="Days per year — after that" name="gratuityDaysAfter" error={err("gratuityDaysAfter")} required>
          <Input type="number" step="0.01" min={0} defaultValue={s.gratuityDaysAfter} />
        </Field>
        <Field label="Cap (months of basic salary)" name="gratuityCapMonths" error={err("gratuityCapMonths")} required>
          <Input type="number" step="0.01" min={0} defaultValue={s.gratuityCapMonths} />
        </Field>
        <Field label="Daily wage" name="gratuityDailyBasis" error={err("gratuityDailyBasis")} required>
          <NativeSelect defaultValue={s.gratuityDailyBasis}>
            <option value="DIV30">Basic ÷ 30</option>
            <option value="DIV365">Basic × 12 ÷ 365</option>
          </NativeSelect>
        </Field>
        <Field label="Leave encashment daily rate" name="leaveEncashmentBasis" error={err("leaveEncashmentBasis")} hint="Unused balance of leave types marked encashable" required>
          <NativeSelect defaultValue={s.leaveEncashmentBasis}>
            <option value="BASIC">Basic ÷ 30</option>
            <option value="GROSS">Gross monthly salary ÷ 30</option>
          </NativeSelect>
        </Field>
      </FormSection>
      <div>
        <SubmitButton pending={pending}>Save settings</SubmitButton>
      </div>
    </form>
  );
}
