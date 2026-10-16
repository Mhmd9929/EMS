import type { AppLocale } from "./config";
import { NAMESPACES } from "./config";

export type Messages = {
  app: typeof import("../../messages/en/app.json");
  nav: typeof import("../../messages/en/nav.json");
  auth: typeof import("../../messages/en/auth.json");
  common: typeof import("../../messages/en/common.json");
  enums: typeof import("../../messages/en/enums.json");
  errors: typeof import("../../messages/en/errors.json");
  emails: typeof import("../../messages/en/emails.json");
  documents: typeof import("../../messages/en/documents.json");
  dashboard: typeof import("../../messages/en/dashboard.json");
  profile: typeof import("../../messages/en/profile.json");
  notifications: typeof import("../../messages/en/notifications.json");
  directory: typeof import("../../messages/en/directory.json");
  orgChart: typeof import("../../messages/en/orgChart.json");
  employees: typeof import("../../messages/en/employees.json");
  organization: typeof import("../../messages/en/organization.json");
  admin: typeof import("../../messages/en/admin.json");
  leave: typeof import("../../messages/en/leave.json");
  payroll: typeof import("../../messages/en/payroll.json");
  payslips: typeof import("../../messages/en/payslips.json");
};

const cache = new Map<AppLocale, Promise<Messages>>();

/** All namespaces of a locale merged into one object (cached per process). */
export function loadMessages(locale: AppLocale): Promise<Messages> {
  if (!cache.has(locale)) {
    cache.set(
      locale,
      Promise.all(NAMESPACES.map(async (ns) => [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const)).then(
        (entries) => Object.fromEntries(entries) as Messages,
      ),
    );
  }
  return cache.get(locale)!;
}
