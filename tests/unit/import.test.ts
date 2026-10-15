import { describe, expect, it } from "vitest";
import { importTemplateCsv, parseCsv, validateImport, type ImportLookups } from "@/lib/import/employee-csv";

const lookups = (): ImportLookups => ({
  departments: new Map([["FIN", "dep-fin"]]),
  positions: new Map([["ACCT", "pos-acct"]]),
  locations: new Map([["DXB-HQ", "loc-dxb"]]),
  existingEmails: new Set(["taken@example.ae"]),
  existingNumbers: new Set(["EMP-0001"]),
  activeEmployeesByEmail: new Map([["boss@example.ae", "emp-boss"]]),
});

const HEADER = "employeeNumber,firstName,lastName,workEmail,joinDate,employmentType,departmentCode,positionCode,locationCode,managerEmail,iban";
const run = (rows: string[]) => {
  const { records, headers } = parseCsv([HEADER, ...rows].join("\n"));
  return validateImport(records, headers, lookups());
};

describe("employee CSV import", () => {
  it("accepts valid rows and resolves codes and existing managers", () => {
    const r = run([",Ali,Hassan,ali@example.ae,2025-01-01,full-time,fin,ACCT,DXB-HQ,boss@example.ae,AE070331234567890123456"]);
    expect(r.errorCount).toBe(0);
    expect(r.rows[0].input?.departmentId).toBe("dep-fin");
    expect(r.rows[0].input?.employmentType).toBe("FULL_TIME");
    expect(r.rows[0].manager).toEqual({ existingId: "emp-boss" });
  });

  it("reports missing required columns", () => {
    const { records, headers } = parseCsv("firstName,lastName\nA,B");
    const r = validateImport(records, headers, lookups());
    expect(r.fileErrors[0]).toMatch(/Missing required columns: workEmail, joinDate, employmentType/);
  });

  it("flags duplicates, existing emails/numbers and unknown codes", () => {
    const r = run([
      "EMP-0001,A,One,taken@example.ae,2025-01-01,FULL_TIME,XXX,,,,",
      ",B,Two,dup@example.ae,2025-01-01,FULL_TIME,,,,,",
      ",C,Three,DUP@example.ae,2025-01-01,FULL_TIME,,,,,",
    ]);
    expect(r.rows[0].errors.join(" ")).toMatch(/employeeNumber EMP-0001 already exists/);
    expect(r.rows[0].errors.join(" ")).toMatch(/taken@example.ae already exists/);
    expect(r.rows[0].errors.join(" ")).toMatch(/Unknown department code "XXX"/);
    expect(r.rows[1].errors).toHaveLength(0);
    expect(r.rows[2].errors.join(" ")).toMatch(/duplicates row 2/);
  });

  it("orders in-file managers before their reports", () => {
    const r = run([
      ",Staff,Member,staff@example.ae,2025-01-01,FULL_TIME,,,,lead@example.ae,",
      ",Team,Lead,lead@example.ae,2025-01-01,FULL_TIME,,,,boss@example.ae,",
    ]);
    expect(r.errorCount).toBe(0);
    expect(r.creationOrder).toEqual([1, 0]);
    expect(r.rows[0].manager).toEqual({ rowIndex: 1 });
  });

  it("detects reporting loops within the file", () => {
    const r = run([
      ",A,A,a@example.ae,2025-01-01,FULL_TIME,,,,b@example.ae,",
      ",B,B,b@example.ae,2025-01-01,FULL_TIME,,,,a@example.ae,",
    ]);
    expect(r.errorCount).toBe(2);
    expect(r.rows[0].errors.join(" ")).toMatch(/loop/);
  });

  it("rejects unknown managers and self-management", () => {
    const r = run([
      ",A,A,a@example.ae,2025-01-01,FULL_TIME,,,,ghost@example.ae,",
      ",B,B,b@example.ae,2025-01-01,FULL_TIME,,,,b@example.ae,",
    ]);
    expect(r.rows[0].errors.join(" ")).toMatch(/not an active employee/);
    expect(r.rows[1].errors.join(" ")).toMatch(/own manager/);
  });

  it("validates field formats per row", () => {
    const r = run([",A,A,not-an-email,2025-02-30,FULL_TIME,,,,,AE000000"]);
    const text = r.rows[0].errors.join(" ");
    expect(text).toMatch(/workEmail/);
    expect(text).toMatch(/joinDate/);
    expect(text).toMatch(/iban/);
  });

  it("produces a template whose header round-trips", () => {
    const { headers } = parseCsv(importTemplateCsv());
    const r = validateImport([], headers, lookups());
    expect(r.fileErrors).toEqual(["The file has no data rows."]);
  });
});
