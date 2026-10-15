import { z } from "zod";
import { parseDateOnly } from "@/lib/dates";
import { isValidIban, normalizeIban } from "@/lib/iban";
import { EMIRATES_ID_REGEX, formatEmiratesId } from "@/lib/mask";

/** Blank form values ("" / whitespace / missing) become null so they clear the column. */
export const emptyToNull = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v;

export const requiredString = (max = 200) =>
  z.string({ error: "Required" }).trim().min(1, "Required").max(max, `Max ${max} characters`);

export const nullableString = (max = 200) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, `Max ${max} characters`).nullable());

export const requiredEmail = z
  .string({ error: "Required" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Invalid email address").max(254));

export const nullableEmail = z.preprocess(
  emptyToNull,
  z.string().trim().toLowerCase().pipe(z.email("Invalid email address").max(254)).nullable(),
);

export const requiredDate = z
  .string({ error: "Required" })
  .refine((v) => parseDateOnly(v) !== null, "Invalid date")
  .transform((v) => parseDateOnly(v)!);

export const nullableDate = z.preprocess(
  emptyToNull,
  z.string().refine((v) => parseDateOnly(v) !== null, "Invalid date").transform((v) => parseDateOnly(v)!).nullable(),
);

export const nullableId = z.preprocess(emptyToNull, z.string().min(1).max(64).nullable());

export const phone = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, "Invalid phone number")
    .nullable(),
);

export const iban = z.preprocess(
  emptyToNull,
  z
    .string()
    .transform(normalizeIban)
    .refine(isValidIban, "Invalid IBAN (check country, length and check digits)")
    .nullable(),
);

export const emiratesId = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .regex(EMIRATES_ID_REGEX, "Format: 784-YYYY-NNNNNNN-N")
    .transform(formatEmiratesId)
    .nullable(),
);

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const password = z
  .string()
  .min(10, "At least 10 characters")
  .max(128)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), "Must include upper- and lower-case letters and a number");

/** Convert FormData into a plain object (multi-value keys become arrays). */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}
