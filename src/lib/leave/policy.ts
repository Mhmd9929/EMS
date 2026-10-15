/** Resolve which leave policy applies to an employee: the most specific active match wins. */
export type PolicyLike = {
  id: string;
  leaveTypeId: string;
  departmentId: string | null;
  positionId: string | null;
  employmentType: string | null;
  isEligible: boolean;
  annualEntitlement: number | null;
  isActive: boolean;
};

export type EmployeeFacts = {
  departmentId: string | null;
  positionId: string | null;
  employmentType: string;
  gender: string | null;
  joinDate: Date;
};

export function matchPolicy<P extends PolicyLike>(policies: P[], leaveTypeId: string, e: EmployeeFacts): P | null {
  let best: P | null = null;
  let bestScore = -1;
  for (const p of policies) {
    if (!p.isActive || p.leaveTypeId !== leaveTypeId) continue;
    if (p.departmentId && p.departmentId !== e.departmentId) continue;
    if (p.positionId && p.positionId !== e.positionId) continue;
    if (p.employmentType && p.employmentType !== e.employmentType) continue;
    // position is most specific, then department, then employment type
    const score = (p.positionId ? 4 : 0) + (p.departmentId ? 2 : 0) + (p.employmentType ? 1 : 0);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

export type LeaveTypeRules = {
  id: string;
  annualEntitlement: number;
  genderEligibility: string | null;
  accrualStartAfterMonths: number;
  accrualMethod: "UPFRONT" | "MONTHLY" | "NONE";
};

/** Effective entitlement and eligibility for one employee and leave type. */
export function effectiveRules(type: LeaveTypeRules, policies: PolicyLike[], e: EmployeeFacts) {
  const policy = matchPolicy(policies, type.id, e);
  if (type.genderEligibility && e.gender !== type.genderEligibility) {
    return { eligible: false as const, reason: "Not available for your gender", entitlement: 0, policyId: policy?.id ?? null };
  }
  if (policy && !policy.isEligible) {
    return { eligible: false as const, reason: "Your leave policy does not include this leave type", entitlement: 0, policyId: policy.id };
  }
  return { eligible: true as const, reason: null, entitlement: policy?.annualEntitlement ?? type.annualEntitlement, policyId: policy?.id ?? null };
}
