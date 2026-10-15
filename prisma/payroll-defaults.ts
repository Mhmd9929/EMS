/** Default pay components (editable). BASIC and UNPAID_LEAVE are system components used by the engine. */
import type { PrismaClient } from "@prisma/client";

export const DEFAULT_PAY_COMPONENTS = [
  { code: "BASIC", name: "Basic salary", kind: "EARNING", calcType: "FIXED", formula: null, isRecurring: true, isFixedPay: true, isSystem: true },
  { code: "HOUSING", name: "Housing allowance", kind: "EARNING", calcType: "FORMULA", formula: "BASIC * 0.5", isRecurring: true, isFixedPay: true, isSystem: false },
  { code: "TRANSPORT", name: "Transport allowance", kind: "EARNING", calcType: "FIXED", formula: null, isRecurring: true, isFixedPay: true, isSystem: false },
  { code: "OTHER_ALLOWANCE", name: "Other allowance", kind: "EARNING", calcType: "FIXED", formula: null, isRecurring: true, isFixedPay: true, isSystem: false },
  { code: "OVERTIME", name: "Overtime", kind: "EARNING", calcType: "FIXED", formula: null, isRecurring: false, isFixedPay: false, isSystem: false },
  { code: "BONUS", name: "Bonus", kind: "EARNING", calcType: "FIXED", formula: null, isRecurring: false, isFixedPay: false, isSystem: false },
  { code: "REIMBURSEMENT", name: "Reimbursement", kind: "EARNING", calcType: "FIXED", formula: null, isRecurring: false, isFixedPay: false, isSystem: false },
  { code: "UNPAID_LEAVE", name: "Unpaid leave", kind: "DEDUCTION", calcType: "FIXED", formula: null, isRecurring: true, isFixedPay: true, isSystem: true },
  { code: "LOAN", name: "Loan / advance recovery", kind: "DEDUCTION", calcType: "FIXED", formula: null, isRecurring: false, isFixedPay: false, isSystem: false },
  { code: "OTHER_DEDUCTION", name: "Other deduction", kind: "DEDUCTION", calcType: "FIXED", formula: null, isRecurring: false, isFixedPay: false, isSystem: false },
] as const;

export async function ensureDefaultPayComponents(db: PrismaClient, companyId: string) {
  if ((await db.payComponent.count({ where: { companyId } })) > 0) return 0;
  await db.payComponent.createMany({
    data: DEFAULT_PAY_COMPONENTS.map((c, i) => ({ ...c, companyId, sortOrder: (i + 1) * 10 })),
  });
  return DEFAULT_PAY_COMPONENTS.length;
}
