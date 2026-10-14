import { describe, expect, it } from "vitest";
import { employeeCreateSchema, terminateEmployeeSchema } from "@/lib/validation/employee";
import { changePasswordSchema } from "@/lib/validation/auth";
import { companySettingsSchema } from "@/lib/validation/admin";
import { formDataToObject } from "@/lib/validation/common";

const valid = {
  firstName: "Aisha",
  lastName: "Al Mansoori",
  workEmail: "Aisha@Example.ae",
  joinDate: "2025-01-15",
  employmentType: "FULL_TIME",
  sendInvite: "on",
};

const errorsOf = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) => r.error?.issues.map((i) => i.path.join(".")) ?? [];

describe("employee schema", () => {
  it("accepts a minimal employee and normalises values", () => {
    const r = employeeCreateSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.workEmail).toBe("aisha@example.ae");
    expect(r.data?.sendInvite).toBe(true);
    expect(r.data?.phone).toBeNull(); // blank -> null
    expect(r.data?.joinDate.toISOString()).toBe("2025-01-15T00:00:00.000Z");
  });

  it("requires names, email, join date", () => {
    const r = employeeCreateSchema.safeParse({ employmentType: "FULL_TIME" });
    expect(errorsOf(r)).toEqual(expect.arrayContaining(["firstName", "lastName", "workEmail", "joinDate"]));
  });

  it("validates IBAN, Emirates ID and phone formats", () => {
    const r = employeeCreateSchema.safeParse({ ...valid, iban: "AE000331234567890123456", emiratesIdNumber: "123", phone: "abc" });
    expect(errorsOf(r)).toEqual(expect.arrayContaining(["iban", "emiratesIdNumber", "phone"]));
  });

  it("normalises a valid IBAN and Emirates ID", () => {
    const r = employeeCreateSchema.safeParse({ ...valid, iban: "ae07 0331 2345 6789 0123 456", emiratesIdNumber: "784199012345671" });
    expect(r.data?.iban).toBe("AE070331234567890123456");
    expect(r.data?.emiratesIdNumber).toBe("784-1990-1234567-1");
  });

  it("rejects probation ending before joining and birth after joining", () => {
    const r = employeeCreateSchema.safeParse({ ...valid, probationEndDate: "2024-12-31", dateOfBirth: "2025-02-01" });
    expect(errorsOf(r)).toEqual(expect.arrayContaining(["probationEndDate", "dateOfBirth"]));
  });

  it("rejects unknown employment types", () => {
    expect(employeeCreateSchema.safeParse({ ...valid, employmentType: "INTERN" }).success).toBe(false);
  });

  it("requires a known termination reason", () => {
    expect(terminateEmployeeSchema.safeParse({ id: "x", lastWorkingDay: "2026-01-31", reason: "Bored" }).success).toBe(false);
    expect(terminateEmployeeSchema.safeParse({ id: "x", lastWorkingDay: "2026-01-31", reason: "Resignation" }).success).toBe(true);
  });
});

describe("password policy", () => {
  it("enforces strength, confirmation and change", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "Old@123456", password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "Old@123456", password: "alllowercase123", confirmPassword: "alllowercase123" }).success).toBe(false);
    expect(errorsOf(changePasswordSchema.safeParse({ currentPassword: "Old@123456", password: "NewPassw0rd!", confirmPassword: "Different1A" }))).toContain("confirmPassword");
    expect(errorsOf(changePasswordSchema.safeParse({ currentPassword: "SamePassw0rd", password: "SamePassw0rd", confirmPassword: "SamePassw0rd" }))).toContain("password");
    expect(changePasswordSchema.safeParse({ currentPassword: "Old@123456", password: "NewPassw0rd!", confirmPassword: "NewPassw0rd!" }).success).toBe(true);
  });
});

describe("company settings", () => {
  it("parses multi-value work week from FormData", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ name: "Acme", country: "ae", currency: "AED", timezone: "Asia/Dubai", fiscalYearStartMonth: "4", employeeNumberPrefix: "EMP-", employeeNumberPadding: "5" })) fd.set(k, v);
    fd.append("workWeek", "1");
    fd.append("workWeek", "2");
    fd.append("workWeek", "3");
    const r = companySettingsSchema.safeParse(formDataToObject(fd));
    expect(r.success).toBe(true);
    expect(r.data?.workWeek).toEqual([1, 2, 3]);
    expect(r.data?.country).toBe("AE");
    expect(r.data?.fiscalYearStartMonth).toBe(4);
  });

  it("requires at least one working day", () => {
    const r = companySettingsSchema.safeParse({ name: "Acme", country: "AE", currency: "AED", timezone: "Asia/Dubai", fiscalYearStartMonth: 1, employeeNumberPrefix: "", employeeNumberPadding: 4 });
    expect(errorsOf(r)).toContain("workWeek");
  });
});
