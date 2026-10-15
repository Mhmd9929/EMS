import { describe, expect, it } from "vitest";
import { isEmploymentEnded } from "@/server/auth/status";
import { formatEmployeeNumber } from "@/lib/employee-number";
import { parseListParams } from "@/lib/list-params";
import { changedKeys, diffSnapshots, toAuditJson } from "@/lib/audit-diff";
import { parseDateOnly } from "@/lib/dates";

describe("isEmploymentEnded (login blocking)", () => {
  const now = new Date("2026-03-31T21:00:00Z"); // 1 Apr 01:00 in Dubai
  it("blocks terminated employees", () => {
    expect(isEmploymentEnded({ status: "TERMINATED", lastWorkingDay: null }, "Asia/Dubai", now)).toBe(true);
  });
  it("allows sign-in on the last working day itself, blocks the day after (company timezone)", () => {
    expect(isEmploymentEnded({ status: "ACTIVE", lastWorkingDay: parseDateOnly("2026-04-01") }, "Asia/Dubai", now)).toBe(false);
    expect(isEmploymentEnded({ status: "ACTIVE", lastWorkingDay: parseDateOnly("2026-03-31") }, "Asia/Dubai", now)).toBe(true);
    // Still 31 Mar in UTC
    expect(isEmploymentEnded({ status: "ACTIVE", lastWorkingDay: parseDateOnly("2026-03-31") }, "UTC", now)).toBe(false);
  });
  it("allows users without an employee record", () => {
    expect(isEmploymentEnded(null, "Asia/Dubai", now)).toBe(false);
  });
});

describe("employee numbers", () => {
  it("pads with the configured prefix", () => {
    expect(formatEmployeeNumber("EMP-", 7, 4)).toBe("EMP-0007");
    expect(formatEmployeeNumber("", 12345, 4)).toBe("12345");
  });
});

describe("list params", () => {
  it("clamps and whitelists", () => {
    const p = parseListParams({ page: "-3", pageSize: "999", sort: "password", dir: "sideways", q: "  ali " }, { sortable: ["name", "joinDate"] as const, defaultSort: "name" });
    expect(p).toEqual({ page: 1, pageSize: 20, q: "ali", sort: "name", dir: "asc" });
    expect(parseListParams({ page: "3", pageSize: "50", sort: "joinDate", dir: "desc" }, { sortable: ["name", "joinDate"] as const, defaultSort: "name" })).toMatchObject({ page: 3, pageSize: 50, sort: "joinDate", dir: "desc" });
  });
});

describe("audit snapshots", () => {
  it("redacts secrets and serialises dates and bigints", () => {
    expect(toAuditJson({ passwordHash: "x", at: new Date("2026-01-01T00:00:00Z"), amount: 10n })).toEqual({ passwordHash: "[redacted]", at: "2026-01-01T00:00:00.000Z", amount: "10" });
  });
  it("diffs only changed fields, ignoring updatedAt", () => {
    const before = { phone: "1", name: "A", updatedAt: new Date(1) };
    const after = { phone: "2", name: "A", updatedAt: new Date(2) };
    expect(changedKeys(before, after)).toEqual(["phone"]);
    expect(diffSnapshots(before, after)).toEqual({ keys: ["phone"], before: { phone: "1" }, after: { phone: "2" } });
  });
});
