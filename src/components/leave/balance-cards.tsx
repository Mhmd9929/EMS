import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TypeBalance } from "@/server/services/leave/balance.service";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));
const minus = (n: number) => (n === 0 ? "0" : `−${fmt(n)}`);

/** One card per leave type: available up front, the full breakdown below. */
export function BalanceCards({ balances, compact }: { balances: TypeBalance[]; compact?: boolean }) {
  const shown = balances.filter((b) => b.eligible && (b.tracked ? b.accrued + b.carriedForward + b.adjustments > 0 || b.taken + b.pending > 0 : b.taken + b.pending > 0));
  if (!shown.length) return <p className="text-muted-foreground text-sm">No leave balances yet. Balances appear once you become eligible for a leave type.</p>;
  return (
    <ul className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"}>
      {shown.map((b) => (
        <li key={b.leaveType.id} data-testid={`balance-${b.leaveType.code}`}>
          <Card className="h-full gap-3 py-4">
            <CardContent className="space-y-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: b.leaveType.color }} aria-hidden />
                  {b.leaveType.name}
                </p>
                {!b.leaveType.isPaid && <Badge variant="secondary">Unpaid</Badge>}
              </div>
              {b.tracked ? (
                <p>
                  <span data-field="available" className={`text-3xl font-semibold tabular-nums ${b.available < 0 ? "text-destructive" : ""}`}>{fmt(b.available)}</span>
                  <span className="text-muted-foreground ms-1 text-sm">days available</span>
                </p>
              ) : (
                <p>
                  <span className="text-3xl font-semibold tabular-nums">{fmt(b.taken)}</span>
                  <span className="text-muted-foreground ms-1 text-sm">days taken</span>
                </p>
              )}
              {!compact && b.tracked && (
                <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt>Entitlement / year</dt>
                  <dd className="text-end tabular-nums">{fmt(b.entitled)}</dd>
                  <dt>{b.leaveType.accrualMethod === "MONTHLY" ? "Accrued so far" : "Granted"}</dt>
                  <dd className="text-end tabular-nums">{fmt(b.accrued)}</dd>
                  {b.carriedForward !== 0 && (
                    <>
                      <dt>Carried forward</dt>
                      <dd className="text-end tabular-nums">{fmt(b.carriedForward)}</dd>
                    </>
                  )}
                  {b.adjustments !== 0 && (
                    <>
                      <dt>Adjustments</dt>
                      <dd className="text-end tabular-nums">{b.adjustments > 0 ? "+" : ""}{fmt(b.adjustments)}</dd>
                    </>
                  )}
                  {b.expired !== 0 && (
                    <>
                      <dt>Expired</dt>
                      <dd className="text-end tabular-nums">{minus(b.expired)}</dd>
                    </>
                  )}
                  <dt>Taken</dt>
                  <dd data-field="taken" className="text-end tabular-nums">{minus(b.taken)}</dd>
                  <dt>Pending</dt>
                  <dd data-field="pending" className="text-end tabular-nums">{minus(b.pending)}</dd>
                </dl>
              )}
              {!compact && !b.tracked && b.pending > 0 && <p className="text-muted-foreground text-xs">{fmt(b.pending)} days pending</p>}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
