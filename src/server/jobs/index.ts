import "server-only";
import { applyDueTerminations } from "./terminations";
import { runLeaveAccruals, runLeaveDaily, runLeaveEscalations, runLeaveYearEnd } from "@/server/services/leave/jobs";
import { deliverEmails } from "@/server/services/notification.service";

/** Job registry: queue name → schedule (cron, in JOBS_TIMEZONE) and handler. All handlers are idempotent. */
export const JOBS: { name: string; cron: string; description: string; handler: () => Promise<unknown> }[] = [
  {
    name: "employee-apply-terminations",
    cron: "15 0 * * *",
    description: "Mark employees whose last working day has passed as terminated",
    handler: applyDueTerminations,
  },
  {
    name: "leave-year-end",
    cron: "5 0 1 1 *",
    description: "Close the previous leave year: carry forward up to the limit, lapse the rest",
    handler: runLeaveYearEnd,
  },
  {
    name: "leave-monthly-accrual",
    cron: "20 0 1 * *",
    description: "Credit monthly accruals and yearly entitlements (catches up any missed months)",
    handler: runLeaveAccruals,
  },
  {
    name: "leave-daily",
    cron: "30 0 * * *",
    description: "Expire unused carried-forward days; sync ACTIVE/ON_LEAVE status; accrual catch-up",
    handler: async () => ({ ...(await runLeaveDaily()), ...(await runLeaveAccruals()) }),
  },
  {
    name: "leave-escalations",
    cron: "0 8 * * 1-5",
    description: "Remind approvers about leave waiting too long; escalate manager steps to HR",
    handler: runLeaveEscalations,
  },
  {
    name: "notifications-email",
    cron: "*/5 * * * *",
    description: "Retry queued notification emails (outbox)",
    handler: () => deliverEmails(),
  },
];
