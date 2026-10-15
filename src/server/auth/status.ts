import { todayInTimeZone } from "@/lib/dates";

/** True when the employee may no longer sign in (terminated, or past their last working day). */
export function isEmploymentEnded(
  employee: { status: string; lastWorkingDay: Date | null } | null | undefined,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (!employee) return false;
  if (employee.status === "TERMINATED") return true;
  if (employee.lastWorkingDay) return employee.lastWorkingDay < todayInTimeZone(timeZone, now);
  return false;
}
