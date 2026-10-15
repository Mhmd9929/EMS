import { describe, expect, it } from "vitest";
import { ALL_PERMISSION_KEYS, DEFAULT_ROLES, PERMISSIONS, type PermissionKey } from "@/server/rbac/catalogue";
import { visibleNav } from "@/components/layout/nav";

const has = (role: keyof typeof DEFAULT_ROLES, key: PermissionKey) => DEFAULT_ROLES[role].permissions.includes(key);

describe("permission catalogue", () => {
  it("has unique keys", () => {
    expect(new Set(ALL_PERMISSION_KEYS).size).toBe(PERMISSIONS.length);
  });

  it("default roles only reference known permissions", () => {
    for (const role of Object.values(DEFAULT_ROLES)) {
      for (const p of role.permissions) expect(ALL_PERMISSION_KEYS).toContain(p);
    }
  });

  it("gives Super Admin everything", () => {
    expect([...DEFAULT_ROLES.SUPER_ADMIN.permissions].sort()).toEqual([...ALL_PERMISSION_KEYS].sort());
  });
});

describe("default role matrix", () => {
  it("Employee: directory and org chart only", () => {
    expect(DEFAULT_ROLES.EMPLOYEE.permissions.sort()).toEqual(["directory.read", "orgchart.read"]);
    expect(has("EMPLOYEE", "employee.read.all")).toBe(false);
    expect(has("EMPLOYEE", "employee.sensitive.read")).toBe(false);
  });

  it("Manager: team view, nothing company-wide or sensitive", () => {
    expect(has("MANAGER", "employee.read.team")).toBe(true);
    expect(has("MANAGER", "employee.read.all")).toBe(false);
    expect(has("MANAGER", "employee.update")).toBe(false);
    expect(has("MANAGER", "employee.sensitive.read")).toBe(false);
  });

  it("HR Admin: manages employees and org but not roles or company settings", () => {
    for (const p of ["employee.create", "employee.update", "employee.terminate", "employee.import", "org.manage", "audit.read", "user.manage"] as const) {
      expect(has("HR_ADMIN", p)).toBe(true);
    }
    expect(has("HR_ADMIN", "role.manage")).toBe(false);
    expect(has("HR_ADMIN", "company.settings.manage")).toBe(false);
  });

  it("Payroll Admin: reads employees and bank details, cannot change HR data", () => {
    expect(has("PAYROLL_ADMIN", "employee.read.all")).toBe(true);
    expect(has("PAYROLL_ADMIN", "employee.sensitive.read")).toBe(true);
    expect(has("PAYROLL_ADMIN", "employee.create")).toBe(false);
    expect(has("PAYROLL_ADMIN", "employee.update")).toBe(false);
    expect(has("PAYROLL_ADMIN", "user.manage")).toBe(false);
  });
});

describe("navigation visibility", () => {
  const hrefs = (perms: string[], hasEmployee = true) => visibleNav(new Set(perms), hasEmployee).flatMap((g) => g.items.map((i) => i.href));

  it("shows an employee only self-service pages", () => {
    expect(hrefs(DEFAULT_ROLES.EMPLOYEE.permissions)).toEqual(["/dashboard", "/profile", "/directory", "/org-chart", "/leave", "/leave/calendar", "/payslips"]);
  });

  it("shows admin pages to Super Admin", () => {
    const h = hrefs(DEFAULT_ROLES.SUPER_ADMIN.permissions);
    expect(h).toContain("/admin/roles");
    expect(h).toContain("/admin/settings");
  });

  it("hides the profile link for users without an employee record", () => {
    expect(hrefs(DEFAULT_ROLES.EMPLOYEE.permissions, false)).not.toContain("/profile");
  });
});
