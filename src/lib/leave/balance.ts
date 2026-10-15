/**
 * Balance arithmetic (pure). A balance for (employee, leave type, year) is:
 *
 *   available = accrued + carriedForward + adjustments − expired − carriedOut − taken − pending
 *
 * where `taken` and `pending` come from request days falling in that year (cross-year requests are split),
 * and ledger kinds map as below.
 */
import { round2, sum } from "./numbers";

export type LedgerKind = "ENTITLEMENT" | "ACCRUAL" | "CARRY_FORWARD" | "CARRY_OUT" | "LAPSE" | "CARRY_FORWARD_EXPIRY" | "ADJUSTMENT";

export type Balance = {
  entitled: number; // informational: annual entitlement from type/policy
  accrued: number;
  carriedForward: number;
  adjustments: number;
  expired: number; // lapsed at year end + carried-forward days that expired
  carriedOut: number;
  taken: number;
  pending: number;
  available: number;
};

export function computeBalance(input: {
  entitled: number;
  ledger: { kind: LedgerKind; days: number }[];
  takenDays: number;
  pendingDays: number;
}): Balance {
  const by = (k: LedgerKind[]) => sum(input.ledger.filter((e) => k.includes(e.kind)).map((e) => e.days));
  const accrued = by(["ENTITLEMENT", "ACCRUAL"]);
  const carriedForward = by(["CARRY_FORWARD"]);
  const adjustments = by(["ADJUSTMENT"]);
  const expired = -by(["LAPSE", "CARRY_FORWARD_EXPIRY"]);
  const carriedOut = -by(["CARRY_OUT"]);
  const taken = round2(input.takenDays);
  const pending = round2(input.pendingDays);
  const available = round2(accrued + carriedForward + adjustments - expired - carriedOut - taken - pending);
  return { entitled: round2(input.entitled), accrued, carriedForward, adjustments, expired: round2(expired), carriedOut: round2(carriedOut), taken, pending, available };
}

/**
 * Year-end close: how much of the remaining balance carries over and how much lapses.
 * Negative balances (allowed for some types) carry over in full as a debt.
 */
export function yearEndCarry(remaining: number, carryForwardMax: number) {
  const r = round2(remaining);
  if (r <= 0) return { carry: r, lapse: 0 };
  const carry = round2(Math.min(r, Math.max(0, carryForwardMax)));
  return { carry, lapse: round2(r - carry) };
}

/**
 * Carried-forward days not used by the expiry date lapse. Days taken in the new year are drawn
 * from the carried-forward bucket first (FIFO).
 */
export function carryForwardExpiry(carriedForward: number, takenBeforeExpiry: number) {
  return round2(Math.max(0, carriedForward - Math.max(0, takenBeforeExpiry)));
}
