import type { PermissionKey } from "@/server/rbac/catalogue";

export type NavIcon =
  | "dashboard" | "directory" | "orgchart" | "profile" | "employees" | "import"
  | "departments" | "positions" | "locations" | "users" | "roles" | "audit" | "settings";

export type NavItem = { href: string; labelKey: string; icon: NavIcon; anyOf?: PermissionKey[]; requiresEmployee?: boolean };
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
