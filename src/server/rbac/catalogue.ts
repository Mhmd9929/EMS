/**
 * Permission catalogue. Isomorphic (no server imports) so the UI can reference keys and tests can
 * import it. Seeded into the `Permission` table; role → permission mapping lives in the DB.
 */
export const PERMISSIONS = [
  { key: "company.settings.manage", module: "Administration", description: "Edit company settings (name, logo, currency, timezone, work week)" },
  { key: "role.manage", module: "Administration", description: "Create and edit roles and their permissions" },
  { key: "user.manage", module: "Administration", description: "Invite users, assign roles, reset access, deactivate users" },
  { key: "audit.read", module: "Administration", description: "View the audit log" },
  { key: "dashboard.hr", module: "Administration", description: "See HR dashboard metrics (headcount, joiners/leavers, pending items)" },

  { key: "org.manage", module: "Organisation", description: "Manage departments, positions and locations" },
  { key: "directory.read", module: "Organisation", description: "View the company directory" },
  { key: "orgchart.read", module: "Organisation", description: "View the org chart" },

  { key: "employee.read.all", module: "Employees", description: "View every employee record" },
  { key: "employee.read.team", module: "Employees", description: "View records of direct and indirect reports" },
  { key: "employee.create", module: "Employees", description: "Create employees" },
  { key: "employee.update", module: "Employees", description: "Edit employee records" },
  { key: "employee.terminate", module: "Employees", description: "Terminate employees" },
  { key: "employee.import", module: "Employees", description: "Bulk import employees from CSV" },
  { key: "employee.export", module: "Employees", description: "Export employee lists" },
  { key: "employee.sensitive.read", module: "Employees", description: "View unmasked identity documents and bank details" },

  { key: "leave.config.manage", module: "Leave", description: "Configure leave types, policies, public holidays and leave settings" },
  { key: "leave.request.read.all", module: "Leave", description: "View every leave request and the company-wide leave calendar" },
  { key: "leave.approve.team", module: "Leave", description: "Approve or reject leave for direct reports (or as a delegate)" },
  { key: "leave.approve.all", module: "Leave", description: "Act on any approval step, including HR steps" },
  { key: "leave.balance.adjust", module: "Leave", description: "Manually adjust leave balances (reason required, audited)" },
  { key: "leave.report.read", module: "Leave", description: "Run leave reports and export balances" },

  { key: "payroll.settings.manage", module: "Payroll", description: "Manage pay components, proration, WPS and gratuity settings" },
  { key: "payroll.salary.read", module: "Payroll", description: "View salaries and salary history" },
  { key: "payroll.salary.manage", module: "Payroll", description: "Change salary structures and enter one-time adjustments" },
  { key: "payroll.run.manage", module: "Payroll", description: "Create, calculate, review, release and cancel payroll runs" },
  { key: "payroll.run.approve", module: "Payroll", description: "Approve payroll runs calculated by someone else (maker-checker)" },
  { key: "payroll.run.reopen", module: "Payroll", description: "Reopen a released payroll run (reason required, audited)" },
  { key: "payroll.export", module: "Payroll", description: "Export WPS SIF, bank transfer files and payroll registers" },
  { key: "payslip.read.all", module: "Payroll", description: "View every employee's payslips" },
  { key: "payroll.settlement.manage", module: "Payroll", description: "Calculate and approve end-of-service gratuity and final settlements" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as PermissionKey[];

export const SYSTEM_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  HR_ADMIN: "HR_ADMIN",
  PAYROLL_ADMIN: "PAYROLL_ADMIN",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE",
} as const;

export type SystemRoleKey = keyof typeof SYSTEM_ROLES;

const everyone: PermissionKey[] = ["directory.read", "orgchart.read"];


export const DEFAULT_ROLES: Record<SystemRoleKey, { name: string; description: string; permissions: PermissionKey[] }> = {
  SUPER_ADMIN: {
    name: "Super Admin",
    description: "Full access including company settings and roles",
    permissions: ALL_PERMISSION_KEYS,
  },
  HR_ADMIN: {
    name: "HR Admin",
    description: "Employees, departments, leave policies, all leave requests, documents",
    permissions: [
      ...everyone,
      "user.manage",
      "audit.read",
      "dashboard.hr",
      "org.manage",
      "employee.read.all",
      "employee.read.team",
      "employee.create",
      "employee.update",
      "employee.terminate",
      "employee.import",
      "employee.export",
      "employee.sensitive.read",
      "leave.config.manage",
      "leave.request.read.all",
      "leave.approve.team",
      "leave.approve.all",
      "leave.balance.adjust",
      "leave.report.read",
    ],
  },
  PAYROLL_ADMIN: {
    name: "Payroll Admin",
    description: "Salary structures, payroll runs, payslips, exports",
    permissions: [
      ...everyone,
      "employee.read.all",
      "employee.export",
      "employee.sensitive.read",
      "leave.report.read",
      "payroll.settings.manage",
      "payroll.salary.read",
      "payroll.salary.manage",
      "payroll.run.manage",
      "payroll.run.approve",
      "payroll.export",
      "payslip.read.all",
      "payroll.settlement.manage",
    ],
  },
  MANAGER: {
    name: "Manager",
    description: "View own team (direct and indirect reports), approve team leave",
    permissions: [...everyone, "employee.read.team", "leave.approve.team"],
  },
  EMPLOYEE: {
    name: "Employee",
    description: "Own profile, own leave, own payslips, directory and org chart",
    permissions: [...everyone],
  },
};

export function hasPermission(granted: ReadonlySet<string>, key: PermissionKey): boolean {
  return granted.has(key);
}

export function hasAnyPermission(granted: ReadonlySet<string>, keys: PermissionKey[]): boolean {
  return keys.some((k) => granted.has(k));
}
