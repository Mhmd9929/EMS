import { z } from "zod";
import {
  emiratesId,
  emptyToNull,
  iban,
  nullableDate,
  nullableEmail,
  nullableId,
  nullableString,
  phone,
  requiredDate,
  requiredEmail,
  requiredString,
  checkbox,
} from "./common";
import { TERMINATION_REASONS } from "@/lib/constants";

export const employmentTypeSchema = z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]);
export const employeeStatusSchema = z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]);
export const genderSchema = z.preprocess(emptyToNull, z.enum(["MALE", "FEMALE"]).nullable());

export const employeeBaseSchema = z.object({
  firstName: requiredString(80),
  lastName: requiredString(80),
  preferredName: nullableString(80),
  workEmail: requiredEmail,
  personalEmail: nullableEmail,
  phone,
  dateOfBirth: nullableDate,
  gender: genderSchema,
  nationality: nullableString(80),
  maritalStatus: nullableString(40),
  address: nullableString(300),

  joinDate: requiredDate,
  probationEndDate: nullableDate,
  employmentType: employmentTypeSchema,
  departmentId: nullableId,
  positionId: nullableId,
  managerId: nullableId,
  locationId: nullableId,

  emiratesIdNumber: emiratesId,
  emiratesIdExpiry: nullableDate,
  passportNumber: nullableString(30),
  passportExpiry: nullableDate,
  visaNumber: nullableString(30),
  visaExpiry: nullableDate,
  labourCardNumber: nullableString(30),
  labourCardExpiry: nullableDate,

  bankName: nullableString(120),
  iban,
  bankAccountName: nullableString(120),
});

const refineDates = <T extends z.infer<typeof employeeBaseSchema>>(v: T, ctx: z.RefinementCtx) => {
  if (v.probationEndDate && v.probationEndDate < v.joinDate) {
    ctx.addIssue({ code: "custom", path: ["probationEndDate"], message: "Must be on or after the join date" });
  }
  if (v.dateOfBirth && v.dateOfBirth >= v.joinDate) {
    ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Must be before the join date" });
  }
};

export const employeeCreateSchema = employeeBaseSchema
  .extend({
    employeeNumber: nullableString(30), // blank = auto-generate
    sendInvite: checkbox,
  })
  .superRefine(refineDates);

export const employeeUpdateSchema = employeeBaseSchema.extend({ id: z.string().min(1) }).superRefine(refineDates);

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

export const terminateEmployeeSchema = z.object({
  id: z.string().min(1),
  lastWorkingDay: requiredDate,
  reason: z.enum(TERMINATION_REASONS),
  notes: nullableString(1000),
});

/** Fields an employee can maintain about themselves. */
export const selfProfileSchema = z.object({
  preferredName: nullableString(80),
  personalEmail: nullableEmail,
  phone,
  address: nullableString(300),
  maritalStatus: nullableString(40),
});

export const emergencyContactSchema = z.object({
  id: nullableId,
  employeeId: nullableId,
  name: requiredString(120),
  relationship: requiredString(60),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Invalid phone number"),
  email: nullableEmail,
});
