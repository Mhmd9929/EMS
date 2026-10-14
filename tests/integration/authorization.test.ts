import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { ForbiddenError, ValidationError } from "@/server/errors";
import { getEmployeeDetail, getEmployeeForEdit, listEmployees, updateEmployee, exportEmployees, listDirectory } from "@/server/services/employee.service";
import { setUserRoles, listUsers } from "@/server/services/user.service";
import { upsertRole, updateCompanySettings, listAuditLogs } from "@/server/services/admin.service";
import { upsertDepartment } from "@/server/services/org.service";
import { getTeamEmployeeIds } from "@/server/rbac/scope";
import type { AuthContext } from "@/server/auth/context";
import { contextFor, employeeIdByEmail, DOMAIN } from "./helpers";

const listParams = { page: 1, pageSize: 100, q: "", sort: "name" as const, dir: "asc" as const };

let admin: AuthContext, hr: AuthContext, payroll: AuthContext, manager: AuthContext, employee: AuthContext;
let saraId: string, hrEmployeeId: string, ceoId: string;

beforeAll(async () => {
  [admin, hr, payroll, manager, employee] = await Promise.all(
    ["admin", "hr", "payroll", "manager", "employee"].map((u) => contextFor(`${u}@${DOMAIN}`)),
  );
  saraId = await employeeIdByEmail(`employee@${DOMAIN}`);
  hrEmployeeId = await employeeIdByEmail(`hr@${DOMAIN}`);
  ceoId = (await db.employee.findFirstOrThrow({ where: { managerId: null, status: "ACTIVE", firstName: "Khalid" } })).id;
});

afterAll(() => db.$disconnect());

describe("employee listing scope", () => {
  it("an employee cannot list employees", async () => {
    await expect(listEmployees(employee, listParams, {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("a manager only sees direct and indirect reports", async () => {
    const result = await listEmployees(manager, listParams, {});
    const team = await getTeamEmployeeIds(manager.companyId, manager.employeeId!);
    expect(result.total).toBe(team.length);
    expect(result.items.every((e) => team.includes(e.id))).toBe(true);
    expect(result.items.some((e) => e.id === hrEmployeeId)).toBe(false);
    // indirect report (reports to a senior engineer, not the manager)
    expect(result.items.some((e) => e.firstName === "Lucas")).toBe(true);
  });

  it("HR sees everyone", async () => {
    const result = await listEmployees(hr, listParams, {});
    expect(result.total).toBe(await db.employee.count({ where: { companyId: hr.companyId } }));
  });

  it("only roles with export permission can export", async () => {
    await expect(exportEmployees(manager, {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(exportEmployees(payroll, {})).resolves.toBeInstanceOf(Array);
  });

  it("the directory never selects sensitive columns", async () => {
    const result = await listDirectory(employee, { ...listParams, sort: "name" }, {});
    const keys = Object.keys(result.items[0]);
    for (const forbidden of ["iban", "emiratesIdNumber", "passportNumber", "dateOfBirth", "phone", "personalEmail"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe("employee detail shaping", () => {
  it("an employee cannot open another employee's record", async () => {
    await expect(getEmployeeDetail(employee, hrEmployeeId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("an employee sees their own record unmasked", async () => {
    const me = await getEmployeeDetail(employee, saraId);
    expect(me.access).toBe("self");
    expect(me.iban).toMatch(/^AE\d{21}$/);
  });

  it("a manager sees team members with identifiers masked and personal data hidden", async () => {
    const d = await getEmployeeDetail(manager, saraId);
    expect(d.access).toBe("team");
    expect(d.iban).toContain("••••");
    expect(d.emiratesIdNumber).toContain("••••");
    expect(d.dateOfBirth).toBeNull();
    expect(d.emergencyContacts).toEqual([]);
    expect(d.canEdit).toBe(false);
  });

  it("a manager cannot open someone outside their team", async () => {
    await expect(getEmployeeDetail(manager, hrEmployeeId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("HR sees unmasked sensitive data", async () => {
    const d = await getEmployeeDetail(hr, saraId);
    expect(d.canSeeSensitive).toBe(true);
    expect(d.iban).not.toContain("•");
    expect(d.canEdit).toBe(true);
  });
});

describe("mutations are authorised on the server", () => {
  it("managers and payroll cannot edit employees", async () => {
    await expect(getEmployeeForEdit(manager, saraId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getEmployeeForEdit(payroll, saraId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("prevents reporting-line cycles", async () => {
    const ceo = await db.employee.findUniqueOrThrow({ where: { id: ceoId } });
    await expect(
      updateEmployee(hr, { ...ceo, id: ceo.id, managerId: saraId, gender: ceo.gender, employmentType: ceo.employmentType }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("writes an audit entry with before/after on update", async () => {
    const before = await db.employee.findUniqueOrThrow({ where: { id: saraId } });
    const marker = `+971 50 ${Date.now().toString().slice(-3)} 0000`;
    await updateEmployee(hr, { ...before, phone: marker });
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: saraId, action: "employee.update" }, orderBy: { createdAt: "desc" } });
    expect(log.actorUserId).toBe(hr.userId);
    expect(log.before).toMatchObject({ phone: before.phone });
    expect(log.after).toMatchObject({ phone: marker });
    await updateEmployee(hr, { ...before }); // restore
  });

  it("prevents department cycles", async () => {
    const tech = await db.department.findFirstOrThrow({ where: { code: "TECH" } });
    const eng = await db.department.findFirstOrThrow({ where: { code: "TECH-ENG" } });
    await expect(
      upsertDepartment(hr, { ...tech, id: tech.id, parentId: eng.id }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("only Super Admins can grant Super Admin", async () => {
    const superRole = await db.role.findFirstOrThrow({ where: { key: "SUPER_ADMIN" } });
    await expect(setUserRoles(hr, employee.userId, [superRole.id])).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("the last Super Admin cannot be removed", async () => {
    const empRole = await db.role.findFirstOrThrow({ where: { key: "EMPLOYEE" } });
    await expect(setUserRoles(admin, admin.userId, [empRole.id])).rejects.toBeInstanceOf(ValidationError);
  });

  it("HR cannot manage roles, company settings is Super Admin only", async () => {
    await expect(upsertRole(hr, { id: null, name: "Sneaky", description: null, permissions: ["role.manage"] })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateCompanySettings(hr, {} as never)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("Super Admin role permissions are locked", async () => {
    const superRole = await db.role.findFirstOrThrow({ where: { key: "SUPER_ADMIN" } });
    await expect(upsertRole(admin, { id: superRole.id, name: "Super Admin", description: null, permissions: [] })).rejects.toBeInstanceOf(ValidationError);
  });

  it("employees cannot read users or the audit log", async () => {
    await expect(listUsers(employee, { ...listParams, sort: "name" }, {})).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listAuditLogs(employee, { ...listParams, sort: "createdAt", dir: "desc" }, {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("role assignment cannot escalate privileges", () => {
  it("HR cannot change their own roles", async () => {
    const hrRoleIds = hr.roles.map((r) => r.id);
    await expect(setUserRoles(hr, hr.userId, hrRoleIds)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("HR cannot grant a role with permissions HR does not hold", async () => {
    // Payroll Admin holds only permissions HR also holds today, so build a stricter custom role.
    const roleId = await upsertRole(admin, { id: null, name: `Settings editor ${Date.now()}`, description: null, permissions: ["company.settings.manage"] });
    const employeeRole = await db.role.findFirstOrThrow({ where: { key: "EMPLOYEE" } });
    await expect(setUserRoles(hr, employee.userId, [employeeRole.id, roleId])).rejects.toBeInstanceOf(ForbiddenError);
    await db.role.delete({ where: { id: roleId } });
  });

  it("HR can grant roles within their own permissions", async () => {
    const [employeeRole, managerRole] = await Promise.all([
      db.role.findFirstOrThrow({ where: { key: "EMPLOYEE" } }),
      db.role.findFirstOrThrow({ where: { key: "MANAGER" } }),
    ]);
    await setUserRoles(hr, employee.userId, [employeeRole.id, managerRole.id]);
    await setUserRoles(hr, employee.userId, [employeeRole.id]); // restore
  });

  it("HR cannot disable a Super Admin", async () => {
    const { setUserActive } = await import("@/server/services/user.service");
    await expect(setUserActive(hr, admin.userId, false)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
