import "server-only";
import { applyDueTerminations } from "./terminations";

/** Job registry: queue name → schedule (cron, in JOBS_TIMEZONE) and handler. */
export const JOBS: { name: string; cron: string; description: string; handler: () => Promise<unknown> }[] = [
  {
    name: "employee-apply-terminations",
    cron: "15 0 * * *",
    description: "Mark employees whose last working day has passed as terminated",
    handler: applyDueTerminations,
  },
  // Phase 2: leave-monthly-accrual, leave-year-end, leave-escalations
  // Phase 4: documents-expiry-alerts
];
