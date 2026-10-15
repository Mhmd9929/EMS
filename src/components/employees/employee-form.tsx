"use client";
import Link from "next/link";
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

      <FormSection title="Personal details">
        <Field label="First name" name="firstName" error={err("firstName")} required>
          <Input defaultValue={v("firstName")} autoComplete="off" />
        </Field>
        <Field label="Last name" name="lastName" error={err("lastName")} required>
          <Input defaultValue={v("lastName")} autoComplete="off" />
        </Field>
        <Field label="Preferred name" name="preferredName" error={err("preferredName")}>
          <Input defaultValue={v("preferredName")} />
        </Field>
        <Field label="Date of birth" name="dateOfBirth" error={err("dateOfBirth")}>
          <Input type="date" defaultValue={v("dateOfBirth")} />
        </Field>
        <Field label="Gender" name="gender" error={err("gender")}>
          <NativeSelect defaultValue={v("gender")}>
            <option value="">—</option>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Nationality" name="nationality" error={err("nationality")}>
          <Input defaultValue={v("nationality")} />
        </Field>
        <Field label="Marital status" name="maritalStatus" error={err("maritalStatus")}>
          <NativeSelect defaultValue={v("maritalStatus")}>
            <option value="">—</option>
            {["Single", "Married", "Divorced", "Widowed"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Mobile phone" name="phone" error={err("phone")} hint="e.g. +971 50 123 4567">
          <Input type="tel" defaultValue={v("phone")} />
        </Field>
        <Field label="Work email" name="workEmail" error={err("workEmail")} required hint="Used to sign in">
          <Input type="email" defaultValue={v("workEmail")} />
        </Field>
        <Field label="Personal email" name="personalEmail" error={err("personalEmail")}>
          <Input type="email" defaultValue={v("personalEmail")} />
        </Field>
        <Field label="Home address" name="address" error={err("address")} className="sm:col-span-2">
          <Textarea rows={2} defaultValue={v("address")} />
        </Field>
      </FormSection>

      <FormSection title="Job">
        {!isEdit && (
          <Field label="Employee number" name="employeeNumber" error={err("employeeNumber")} hint={nextNumberHint ? `Leave blank to auto-assign (next: ${nextNumberHint})` : "Leave blank to auto-assign"}>
            <Input />
          </Field>
        )}
        <Field label="Employment type" name="employmentType" error={err("employmentType")} required>
          <NativeSelect defaultValue={v("employmentType") || "FULL_TIME"}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Join date" name="joinDate" error={err("joinDate")} required>
          <Input type="date" defaultValue={v("joinDate")} />
        </Field>
        <Field label="Probation end date" name="probationEndDate" error={err("probationEndDate")}>
          <Input type="date" defaultValue={v("probationEndDate")} />
        </Field>
        <Field label="Department" name="departmentId" error={err("departmentId")}>
          {select("departmentId", options.departments, "— No department —", v("departmentId"))}
        </Field>
        <Field label="Position" name="positionId" error={err("positionId")}>
          {select("positionId", options.positions, "— No position —", v("positionId"))}
        </Field>
        <Field label="Manager" name="managerId" error={err("managerId")} hint="Reporting line (loops are prevented)">
          {select("managerId", options.managers.filter((m) => m.value !== employee?.id), "— No manager —", v("managerId"))}
        </Field>
        <Field label="Location" name="locationId" error={err("locationId")}>
          {select("locationId", options.locations, "— No location —", v("locationId"))}
        </Field>
      </FormSection>

      <FormSection title="UAE identity documents">
        <Field label="Emirates ID number" name="emiratesIdNumber" error={err("emiratesIdNumber")} hint="784-YYYY-NNNNNNN-N">
          <Input defaultValue={v("emiratesIdNumber")} inputMode="numeric" />
        </Field>
        <Field label="Emirates ID expiry" name="emiratesIdExpiry" error={err("emiratesIdExpiry")}>
          <Input type="date" defaultValue={v("emiratesIdExpiry")} />
        </Field>
        <Field label="Passport number" name="passportNumber" error={err("passportNumber")}>
          <Input defaultValue={v("passportNumber")} />
        </Field>
        <Field label="Passport expiry" name="passportExpiry" error={err("passportExpiry")}>
          <Input type="date" defaultValue={v("passportExpiry")} />
        </Field>
        <Field label="Visa number" name="visaNumber" error={err("visaNumber")}>
          <Input defaultValue={v("visaNumber")} />
        </Field>
        <Field label="Visa expiry" name="visaExpiry" error={err("visaExpiry")}>
          <Input type="date" defaultValue={v("visaExpiry")} />
        </Field>
        <Field label="Labour card number" name="labourCardNumber" error={err("labourCardNumber")}>
          <Input defaultValue={v("labourCardNumber")} />
        </Field>
        <Field label="Labour card expiry" name="labourCardExpiry" error={err("labourCardExpiry")}>
          <Input type="date" defaultValue={v("labourCardExpiry")} />
        </Field>
      </FormSection>

      <FormSection title="Bank details (WPS)">
        <Field label="Bank name" name="bankName" error={err("bankName")}>
          <Input defaultValue={v("bankName")} />
        </Field>
        <Field label="Account holder name" name="bankAccountName" error={err("bankAccountName")}>
          <Input defaultValue={v("bankAccountName")} />
        </Field>
        <Field label="IBAN" name="iban" error={err("iban")} hint="UAE IBANs are 23 characters, e.g. AE07 0331 2345 6789 0123 456">
          <Input defaultValue={employee?.iban ? formatIban(employee.iban) : ""} autoComplete="off" spellCheck={false} />
        </Field>
        <Field label="Bank routing code (WPS agent ID)" name="bankRoutingCode" error={err("bankRoutingCode")} hint="9 digits, from the employee's bank — needed for the WPS SIF file">
          <Input defaultValue={v("bankRoutingCode")} inputMode="numeric" maxLength={9} autoComplete="off" />
        </Field>
      </FormSection>

      {!isEdit && (
        <div className="flex items-center gap-2">
          <Checkbox id="sendInvite" name="sendInvite" defaultChecked />
          <Label htmlFor="sendInvite">Email an invitation to set a password</Label>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Link href={isEdit ? `/employees/${employee.id}` : "/employees"} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
        <SubmitButton pending={pending} pendingText="Saving…">
          {isEdit ? "Save changes" : "Create employee"}
        </SubmitButton>
      </div>
    </form>
  );
}
