/**
 * UAE leave-type defaults. These are *editable starting points* (flagged isSystemDefault), not hard-coded
 * labour law — HR can change every rule from Leave → Settings.
 */
import type { AccrualMethod, Gender, PrismaClient } from "@prisma/client";

type Def = {
  code: string;
  name: string;
  description: string;
  color: string;
  isPaid: boolean;
  annualEntitlement: number;
  accrualMethod: AccrualMethod;
  accrualStartAfterMonths?: number;
  carryForwardMax?: number;
  carryForwardExpiryMonths?: number | null;
  maxConsecutiveDays?: number | null;
  requiresAttachmentAfterDays?: number | null;
  minNoticeDays?: number;
  allowHalfDay?: boolean;
  genderEligibility?: Gender | null;
  countWeekends?: boolean;
  countHolidays?: boolean;
  approvalChain?: string[];
  isEncashable?: boolean;
};

export const UAE_LEAVE_DEFAULTS: Def[] = [
  {
    code: "AL", name: "Annual Leave", color: "#0d9488", isPaid: true, annualEntitlement: 30, accrualMethod: "MONTHLY",
    description: "30 days a year, accruing 2.5 days per month after 6 months of service.",
    accrualStartAfterMonths: 6, carryForwardMax: 10, carryForwardExpiryMonths: 3, minNoticeDays: 7, isEncashable: true,
  },
  {
    code: "SL", name: "Sick Leave", color: "#dc2626", isPaid: true, annualEntitlement: 15, accrualMethod: "UPFRONT",
    description: "Paid sick leave. A medical certificate is required for absences longer than 2 days.",
    accrualStartAfterMonths: 3, requiresAttachmentAfterDays: 2, minNoticeDays: 0,
  },
  {
    code: "ML", name: "Maternity Leave", color: "#db2777", isPaid: true, annualEntitlement: 60, accrualMethod: "UPFRONT",
    description: "60 calendar days. Medical certificate required.",
    genderEligibility: "FEMALE", countWeekends: true, countHolidays: true, maxConsecutiveDays: 60,
    requiresAttachmentAfterDays: 0, allowHalfDay: false, approvalChain: ["MANAGER", "HR"],
  },
  {
    code: "PL", name: "Paternity Leave", color: "#2563eb", isPaid: true, annualEntitlement: 5, accrualMethod: "UPFRONT",
    description: "5 working days, to be taken within 6 months of the birth.", genderEligibility: "MALE", maxConsecutiveDays: 5,
  },
  {
    code: "BL", name: "Bereavement Leave", color: "#475569", isPaid: true, annualEntitlement: 5, accrualMethod: "UPFRONT",
    description: "Up to 5 days on the death of a spouse; 3 days for a close relative.", maxConsecutiveDays: 5, allowHalfDay: false,
  },
  {
    code: "HJ", name: "Hajj Leave", color: "#a16207", isPaid: false, annualEntitlement: 30, accrualMethod: "UPFRONT",
    description: "Unpaid, up to 30 days once during employment.", accrualStartAfterMonths: 12, countWeekends: true,
    maxConsecutiveDays: 30, minNoticeDays: 30, allowHalfDay: false, approvalChain: ["MANAGER", "HR"],
  },
  {
    code: "ST", name: "Study Leave", color: "#7c3aed", isPaid: true, annualEntitlement: 10, accrualMethod: "UPFRONT",
    description: "10 working days a year for exams at an accredited UAE institution, after 2 years of service.",
    accrualStartAfterMonths: 24, requiresAttachmentAfterDays: 0, minNoticeDays: 14, approvalChain: ["MANAGER", "HR"],
  },
  {
    code: "UL", name: "Unpaid Leave", color: "#78716c", isPaid: false, annualEntitlement: 0, accrualMethod: "NONE",
    description: "Leave without pay; deducted in payroll.", minNoticeDays: 7, approvalChain: ["MANAGER", "HR"],
  },
];

/** Create the default leave types for a company that has none. Returns how many were created. */
export async function ensureDefaultLeaveTypes(db: PrismaClient, companyId: string) {
  if ((await db.leaveType.count({ where: { companyId } })) > 0) return 0;
  await db.leaveType.createMany({
    data: UAE_LEAVE_DEFAULTS.map((t, i) => ({
      companyId,
      code: t.code,
      name: t.name,
      description: t.description,
      color: t.color,
      isPaid: t.isPaid,
      annualEntitlement: t.annualEntitlement,
      accrualMethod: t.accrualMethod,
      accrualStartAfterMonths: t.accrualStartAfterMonths ?? 0,
      carryForwardMax: t.carryForwardMax ?? 0,
      carryForwardExpiryMonths: t.carryForwardExpiryMonths ?? null,
      maxConsecutiveDays: t.maxConsecutiveDays ?? null,
      requiresAttachmentAfterDays: t.requiresAttachmentAfterDays ?? null,
      minNoticeDays: t.minNoticeDays ?? 0,
      allowHalfDay: t.allowHalfDay ?? true,
      genderEligibility: t.genderEligibility ?? null,
      countWeekends: t.countWeekends ?? false,
      countHolidays: t.countHolidays ?? false,
      approvalChain: t.approvalChain ?? ["MANAGER"],
      isEncashable: t.isEncashable ?? false,
      isSystemDefault: true,
      sortOrder: i,
    })),
  });
  return UAE_LEAVE_DEFAULTS.length;
}
