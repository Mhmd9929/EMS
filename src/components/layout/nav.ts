import type { PermissionKey } from "@/server/rbac/catalogue";

export type NavIcon =
  | "dashboard" | "directory" | "orgchart" | "profile" | "employees" | "import"
  | "departments" | "positions" | "locations" | "users" | "roles" | "audit" | "settings"
  | "leave" | "approvals" | "calendar" | "requests" | "balances" | "reports" | "leaveSettings"
  | "payslips" | "payrollRuns" | "salaries" | "adjustments" | "settlements" | "payrollSettings";

export type NavItem = { href: string; labelKey: string; icon: NavIcon; anyOf?: PermissionKey[]; requiresEmployee?: boolean; badge?: "approvals" };
export type NavGroup = { labelKey: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    labelKey: "main",
    items: [
      { href: "/dashboard", labelKey: "dashboard", icon: "dashboard" },
      { href: "/profile", labelKey: "profile", icon: "profile", requiresEmployee: true },
      { href: "/directory", labelKey: "directory", icon: "directory", anyOf: ["directory.read"] },
      { href: "/org-chart", labelKey: "orgChart", icon: "orgchart", anyOf: ["orgchart.read"] },
    ],
  },
  {
    labelKey: "leave",
    items: [
      { href: "/leave", labelKey: "myLeave", icon: "leave", requiresEmployee: true },
      { href: "/leave/approvals", labelKey: "approvals", icon: "approvals", anyOf: ["leave.approve.team", "leave.approve.all"], badge: "approvals" },
      { href: "/leave/calendar", labelKey: "leaveCalendar", icon: "calendar" },
      { href: "/leave/requests", labelKey: "allRequests", icon: "requests", anyOf: ["leave.request.read.all", "leave.approve.team"] },
      { href: "/leave/balances", labelKey: "balances", icon: "balances", anyOf: ["leave.balance.adjust", "leave.report.read"] },
      { href: "/leave/reports", labelKey: "reports", icon: "reports", anyOf: ["leave.report.read"] },
      { href: "/leave/settings", labelKey: "leaveSettings", icon: "leaveSettings", anyOf: ["leave.config.manage"] },
    ],
  },
  {
    labelKey: "payroll",
    items: [
      { href: "/payslips", labelKey: "myPayslips", icon: "payslips", requiresEmployee: true },
      { href: "/payroll", labelKey: "payrollRuns", icon: "payrollRuns", anyOf: ["payroll.run.manage", "payroll.run.approve"] },
      { href: "/payroll/salaries", labelKey: "salaries", icon: "salaries", anyOf: ["payroll.salary.read"] },
      { href: "/payroll/adjustments", labelKey: "adjustments", icon: "adjustments", anyOf: ["payroll.salary.manage"] },
      { href: "/payroll/settlements", labelKey: "settlements", icon: "settlements", anyOf: ["payroll.settlement.manage"] },
      { href: "/payroll/settings", labelKey: "payrollSettings", icon: "payrollSettings", anyOf: ["payroll.settings.manage"] },
    ],
  },
  {
    labelKey: "people",
    items: [
      { href: "/employees", labelKey: "employees", icon: "employees", anyOf: ["employee.read.all", "employee.read.team"] },
      { href: "/employees/import", labelKey: "importEmployees", icon: "import", anyOf: ["employee.import"] },
    ],
  },
  {
    labelKey: "organisation",
    items: [
      { href: "/organization/departments", labelKey: "departments", icon: "departments", anyOf: ["org.manage"] },
      { href: "/organization/positions", labelKey: "positions", icon: "positions", anyOf: ["org.manage"] },
      { href: "/organization/locations", labelKey: "locations", icon: "locations", anyOf: ["org.manage"] },
    ],
  },
  {
    labelKey: "admin",
    items: [
      { href: "/admin/users", labelKey: "users", icon: "users", anyOf: ["user.manage"] },
      { href: "/admin/roles", labelKey: "roles", icon: "roles", anyOf: ["role.manage"] },
      { href: "/admin/audit", labelKey: "audit", icon: "audit", anyOf: ["audit.read"] },
      { href: "/admin/settings", labelKey: "settings", icon: "settings", anyOf: ["company.settings.manage"] },
    ],
  },
];

export function visibleNav(permissions: ReadonlySet<string>, hasEmployee: boolean) {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.anyOf || i.anyOf.some((p) => permissions.has(p))) && (!i.requiresEmployee || hasEmployee)),
  })).filter((g) => g.items.length > 0);
}
