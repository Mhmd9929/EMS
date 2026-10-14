import { z } from "zod";
import { nullableEmail, nullableString, requiredString } from "./common";
import { CURRENCIES, TIMEZONES } from "@/lib/constants";

const toArray = (v: unknown) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]);

export const roleSchema = z.object({
  id: z.preprocess((v) => (v === "" ? null : v), z.string().nullable()),
  name: requiredString(60),
  description: nullableString(300),
  permissions: z.preprocess(toArray, z.array(z.string().max(80)).max(200)),
});

export const userRolesSchema = z.object({
  userId: z.string().min(1),
  roleIds: z.preprocess(toArray, z.array(z.string().min(1)).max(50)),
});

export const companySettingsSchema = z.object({
  name: requiredString(120),
  legalName: nullableString(200),
  addressLine1: nullableString(200),
  addressLine2: nullableString(200),
  city: nullableString(80),
  emirate: nullableString(80),
  country: z.string().trim().length(2).toUpperCase(),
  phone: nullableString(30),
  email: nullableEmail,
  website: nullableString(200),
  tradeLicenseNumber: nullableString(60),
  currency: z.enum(CURRENCIES),
  timezone: z.enum(TIMEZONES),
  workWeek: z.preprocess(
    (v) => toArray(v).map(Number),
    z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one working day").max(7),
  ),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
  employeeNumberPrefix: z.string().trim().max(10).regex(/^[A-Za-z0-9-_/]*$/, "Letters, numbers, - _ / only"),
  employeeNumberPadding: z.coerce.number().int().min(1).max(10),
});

export const auditFilterSchema = z.object({
  actorUserId: z.string().optional(),
  entityType: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
