"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Employee } from "@prisma/client";
import { createEmployeeAction, updateEmployeeAction } from "@/server/actions/employee.actions";
import { useFormAction } from "@/components/forms/use-form-action";
import { useActionFeedback, fieldError } from "@/components/forms/use-action-feedback";
import { Field, FormSection } from "@/components/forms/field";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { EMPLOYMENT_TYPES, GENDERS } from "@/lib/constants";
import { toDateInput } from "@/lib/dates";
import { formatIban } from "@/lib/iban";

type Option = { value: string; label: string; isActive?: boolean };

const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"] as const;

export function EmployeeForm({
  employee,
  options,
  nextNumberHint,
}: {
  employee?: Employee;
  options: { departments: Option[]; positions: Option[]; locations: Option[]; managers: Option[] };
  nextNumberHint?: string;
}) {
  const isEdit = !!employee;
  const t = useTranslations("employees");
  const tf = useTranslations("employees.form");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const { state, onSubmit, pending } = useFormAction(isEdit ? updateEmployeeAction : createEmployeeAction);
  useActionFeedback(state, { silentSuccess: true });
  const err = (name: string) => fieldError(state, name);
  const v = (key: keyof Employee) => {
    const value = employee?.[key];
    if (value instanceof Date) return toDateInput(value);
    return value == null ? "" : String(value);
  };
  const select = (name: string, list: Option[], placeholder: string, current: string) => (
    <NativeSelect defaultValue={current}>
      <option value="">{placeholder}</option>
      {list
        .filter((o) => o.isActive !== false || o.value === current)
        .map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
    </NativeSelect>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      <FormError state={state} />
      {isEdit && <input type="hidden" name="id" value={employee.id} />}

      <FormSection title={tf("sections.personal")}>
        <Field label={tf("firstName")} name="firstName" error={err("firstName")} required>
          <Input defaultValue={v("firstName")} autoComplete="off" />
        </Field>
        <Field label={tf("lastName")} name="lastName" error={err("lastName")} required>
          <Input defaultValue={v("lastName")} autoComplete="off" />
        </Field>
        <Field label={tf("preferredName")} name="preferredName" error={err("preferredName")}>
          <Input defaultValue={v("preferredName")} />
        </Field>
        <Field label={tf("dateOfBirth")} name="dateOfBirth" error={err("dateOfBirth")}>
          <Input type="date" defaultValue={v("dateOfBirth")} />
        </Field>
        <Field label={tf("gender")} name="gender" error={err("gender")}>
          <NativeSelect defaultValue={v("gender")}>
            <option value="">—</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {te(`gender.${g.value}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={tf("nationality")} name="nationality" error={err("nationality")}>
          <Input defaultValue={v("nationality")} />
        </Field>
        <Field label={tf("maritalStatus")} name="maritalStatus" error={err("maritalStatus")}>
          <NativeSelect defaultValue={v("maritalStatus")}>
            <option value="">—</option>
            {MARITAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`maritalStatus.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={tf("mobilePhone")} name="phone" error={err("phone")} hint={tf("mobilePhoneHint")}>
          <Input type="tel" defaultValue={v("phone")} dir="ltr" />
        </Field>
        <Field label={tf("workEmail")} name="workEmail" error={err("workEmail")} required hint={tf("workEmailHint")}>
          <Input type="email" defaultValue={v("workEmail")} dir="ltr" />
        </Field>
        <Field label={tf("personalEmail")} name="personalEmail" error={err("personalEmail")}>
          <Input type="email" defaultValue={v("personalEmail")} dir="ltr" />
        </Field>
        <Field label={tf("homeAddress")} name="address" error={err("address")} className="sm:col-span-2">
          <Textarea rows={2} defaultValue={v("address")} />
        </Field>
      </FormSection>

      <FormSection title={tf("sections.job")}>
        {!isEdit && (
          <Field label={tf("employeeNumber")} name="employeeNumber" error={err("employeeNumber")} hint={nextNumberHint ? tf("employeeNumberHintNext", { next: nextNumberHint }) : tf("employeeNumberHint")}>
            <Input dir="ltr" />
          </Field>
        )}
        <Field label={tf("employmentType")} name="employmentType" error={err("employmentType")} required>
          <NativeSelect defaultValue={v("employmentType") || "FULL_TIME"}>
            {EMPLOYMENT_TYPES.map((et) => (
              <option key={et.value} value={et.value}>
                {te(`employmentType.${et.value}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={tf("joinDate")} name="joinDate" error={err("joinDate")} required>
          <Input type="date" defaultValue={v("joinDate")} />
        </Field>
        <Field label={tf("probationEndDate")} name="probationEndDate" error={err("probationEndDate")}>
          <Input type="date" defaultValue={v("probationEndDate")} />
        </Field>
        <Field label={tc("department")} name="departmentId" error={err("departmentId")}>
          {select("departmentId", options.departments, tf("noDepartment"), v("departmentId"))}
        </Field>
        <Field label={tc("position")} name="positionId" error={err("positionId")}>
          {select("positionId", options.positions, tf("noPosition"), v("positionId"))}
        </Field>
        <Field label={tc("manager")} name="managerId" error={err("managerId")} hint={tf("managerHint")}>
          {select("managerId", options.managers.filter((m) => m.value !== employee?.id), tf("noManager"), v("managerId"))}
        </Field>
        <Field label={tc("location")} name="locationId" error={err("locationId")}>
          {select("locationId", options.locations, tf("noLocation"), v("locationId"))}
        </Field>
      </FormSection>

      <FormSection title={tf("sections.documents")}>
        <Field label={tf("emiratesIdNumber")} name="emiratesIdNumber" error={err("emiratesIdNumber")} hint="784-YYYY-NNNNNNN-N">
          <Input defaultValue={v("emiratesIdNumber")} inputMode="numeric" dir="ltr" />
        </Field>
        <Field label={tf("emiratesIdExpiry")} name="emiratesIdExpiry" error={err("emiratesIdExpiry")}>
          <Input type="date" defaultValue={v("emiratesIdExpiry")} />
        </Field>
        <Field label={tf("passportNumber")} name="passportNumber" error={err("passportNumber")}>
          <Input defaultValue={v("passportNumber")} dir="ltr" />
        </Field>
        <Field label={tf("passportExpiry")} name="passportExpiry" error={err("passportExpiry")}>
          <Input type="date" defaultValue={v("passportExpiry")} />
        </Field>
        <Field label={tf("visaNumber")} name="visaNumber" error={err("visaNumber")}>
          <Input defaultValue={v("visaNumber")} dir="ltr" />
        </Field>
        <Field label={tf("visaExpiry")} name="visaExpiry" error={err("visaExpiry")}>
          <Input type="date" defaultValue={v("visaExpiry")} />
        </Field>
        <Field label={tf("labourCardNumber")} name="labourCardNumber" error={err("labourCardNumber")}>
          <Input defaultValue={v("labourCardNumber")} dir="ltr" />
        </Field>
        <Field label={tf("labourCardExpiry")} name="labourCardExpiry" error={err("labourCardExpiry")}>
          <Input type="date" defaultValue={v("labourCardExpiry")} />
        </Field>
      </FormSection>

      <FormSection title={tf("sections.bank")}>
        <Field label={tf("bankName")} name="bankName" error={err("bankName")}>
          <Input defaultValue={v("bankName")} />
        </Field>
        <Field label={tf("bankAccountName")} name="bankAccountName" error={err("bankAccountName")}>
          <Input defaultValue={v("bankAccountName")} />
        </Field>
        <Field label={tf("iban")} name="iban" error={err("iban")} hint={tf("ibanHint")}>
          <Input defaultValue={employee?.iban ? formatIban(employee.iban) : ""} autoComplete="off" spellCheck={false} dir="ltr" />
        </Field>
        <Field label={tf("bankRoutingCode")} name="bankRoutingCode" error={err("bankRoutingCode")} hint={tf("bankRoutingCodeHint")}>
          <Input defaultValue={v("bankRoutingCode")} inputMode="numeric" maxLength={9} autoComplete="off" dir="ltr" />
        </Field>
      </FormSection>

      {!isEdit && (
        <div className="flex items-center gap-2">
          <Checkbox id="sendInvite" name="sendInvite" defaultChecked />
          <Label htmlFor="sendInvite">{tf("sendInvite")}</Label>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Link href={isEdit ? `/employees/${employee.id}` : "/employees"} className={buttonVariants({ variant: "outline" })}>
          {tc("cancel")}
        </Link>
        <SubmitButton pending={pending} pendingText={tc("saving")}>
          {isEdit ? tf("saveChanges") : tf("create")}
        </SubmitButton>
      </div>
    </form>
  );
}
