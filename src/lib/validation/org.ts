import { z } from "zod";
import { checkbox, nullableId, nullableString, requiredString } from "./common";

const code = z
  .string({ error: "Required" })
  .trim()
  .toUpperCase()
  .min(1, "Required")
  .max(20)
  .regex(/^[A-Z0-9_-]+$/, "Letters, numbers, - and _ only");

export const departmentSchema = z.object({
  id: nullableId,
  name: requiredString(120),
  code,
  costCenterCode: nullableString(30),
  description: nullableString(500),
  parentId: nullableId,
  headId: nullableId,
  isActive: checkbox,
});

export const positionSchema = z.object({
  id: nullableId,
  title: requiredString(120),
  code,
  grade: nullableString(20),
  level: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(0).max(100).nullable(),
  ),
  description: nullableString(500),
  isActive: checkbox,
});

export const locationSchema = z.object({
  id: nullableId,
  name: requiredString(120),
  code,
  address: nullableString(300),
  city: nullableString(80),
  emirate: nullableString(80),
  country: z.string().trim().length(2).toUpperCase().default("AE"),
  isActive: checkbox,
});
