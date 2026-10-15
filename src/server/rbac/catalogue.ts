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
    ],
  },
  PAYROLL_ADMIN: {
    name: "Payroll Admin",
    description: "Salary structures, payroll runs, payslips, exports",
    permissions: [...everyone, "employee.read.all", "employee.export", "employee.sensitive.read"],
  },
  MANAGER: {
    name: "Manager",
    description: "View own team (direct and indirect reports), approve team leave",
    permissions: [...everyone, "employee.read.team"],
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
