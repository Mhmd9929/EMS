import { z } from "zod";
import { checkbox, emptyToNull, nullableId, nullableString, requiredDate, requiredString } from "./common";

const toArray = (v: unknown) => (v === undefined || v === null || v === "" ? [] : Array.isArray(v) ? v : [v]);
const intOrNull = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(min).max(max).nullable());
const decimal = (min: number, max: number) => z.coerce.number().min(min).max(max).transform((n) => Math.round(n * 100) / 100);

export const halfDaySchema = z.enum(["NONE", "FIRST_HALF", "SECOND_HALF"]).default("NONE");

export const leaveApplySchema = z.object({
  leaveTypeId: z.string({ error: "Choose a leave type" }).min(1, "Choose a leave type"),
  startDate: requiredDate,
  endDate: requiredDate,
  halfDay: z.preprocess((v) => v || "NONE", halfDaySchema),
  reason: nullableString(1000),
});
export type LeaveApplyInput = z.infer<typeof leaveApplySchema>;

export const leaveDecisionSchema = z.object({
  requestIds: z.preprocess(toArray, z.array(z.string().min(1)).min(1, "Select at least one request").max(100)),
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: nullableString(1000),
});

export const leaveCancelSchema = z.object({
  requestId: z.string().min(1),
  reason: nullableString(1000),
});

export const leaveTypeSchema = z
  .object({
    id: nullableId,
    name: requiredString(80),
    code: z.string().trim().toUpperCase().min(1, "Required").max(10).regex(/^[A-Z0-9_-]+$/, "Letters, numbers, - and _ only"),
    description: nullableString(500),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
    isPaid: checkbox,
    annualEntitlement: decimal(0, 366),
    accrualMethod: z.enum(["UPFRONT", "MONTHLY", "NONE"]),
    accrualStartAfterMonths: z.coerce.number().int().min(0).max(120),
    prorateUpfront: checkbox,
    carryForwardMax: decimal(0, 366),
    carryForwardExpiryMonths: intOrNull(1, 24),
    maxConsecutiveDays: intOrNull(1, 366),
    requiresAttachmentAfterDays: intOrNull(0, 366),
    minNoticeDays: z.coerce.number().int().min(0).max(365),
    allowHalfDay: checkbox,
    allowNegativeBalance: checkbox,
    genderEligibility: z.preprocess(emptyToNull, z.enum(["MALE", "FEMALE"]).nullable()),
    countWeekends: checkbox,
    countHolidays: checkbox,
    approvalChain: z.preprocess(toArray, z.array(z.enum(["MANAGER", "HR"])).max(2)),
    isEncashable: checkbox,
    isActive: checkbox,
  })
  .refine((v) => new Set(v.approvalChain).size === v.approvalChain.length, { path: ["approvalChain"], message: "Each step can appear once" });

export const leavePolicySchema = z.object({
  id: nullableId,
  name: requiredString(120),
  leaveTypeId: z.string().min(1, "Choose a leave type"),
  departmentId: nullableId,
  positionId: nullableId,
  employmentType: z.preprocess(emptyToNull, z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]).nullable()),
  isEligible: checkbox,
  annualEntitlement: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().min(0).max(366).nullable()),
  isActive: checkbox,
});

export const holidaySchema = z.object({
  id: nullableId,
  name: requiredString(120),
  date: requiredDate,
  endDate: z.preprocess(emptyToNull, z.string().nullable()),
  locationId: nullableId,
});

export const balanceAdjustSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1, "Choose a leave type"),
  year: z.coerce.number().int().min(2000).max(2100),
  days: z.coerce.number().min(-366).max(366).refine((n) => n !== 0, "Cannot be zero"),
  reason: requiredString(500),
});

export const delegationSchema = z
  .object({
    delegateId: z.string().min(1, "Choose a delegate"),
    startDate: requiredDate,
    endDate: requiredDate,
    reason: nullableString(300),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "Must be on or after the start date" });

export const leaveSettingsSchema = z.object({
  leaveEscalationDays: z.coerce.number().int().min(1).max(30),
});
