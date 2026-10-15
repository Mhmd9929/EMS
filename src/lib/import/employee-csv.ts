/**
 * Pure CSV → employee validation used by the bulk importer (dry run and commit).
 * No server imports so it can be unit-tested directly.
 */
import Papa from "papaparse";
import { employeeCreateSchema, type EmployeeCreateInput } from "@/lib/validation/employee";

export const IMPORT_COLUMNS = [
  { key: "employeeNumber", required: false, example: "", help: "Blank = auto-generate" },
  { key: "firstName", required: true, example: "Aisha" },
  { key: "lastName", required: true, example: "Al Mansoori" },
  { key: "preferredName", required: false, example: "" },
  { key: "workEmail", required: true, example: "aisha.almansoori@example.ae" },
  { key: "personalEmail", required: false, example: "" },
  { key: "phone", required: false, example: "+971 50 123 4567" },
  { key: "dateOfBirth", required: false, example: "1990-04-21", help: "YYYY-MM-DD" },
  { key: "gender", required: false, example: "FEMALE", help: "MALE / FEMALE" },
  { key: "nationality", required: false, example: "Emirati" },
  { key: "joinDate", required: true, example: "2024-01-15", help: "YYYY-MM-DD" },
  { key: "probationEndDate", required: false, example: "2024-07-15" },
  { key: "employmentType", required: true, example: "FULL_TIME", help: "FULL_TIME / PART_TIME / CONTRACT" },
  { key: "departmentCode", required: false, example: "FIN" },
  { key: "positionCode", required: false, example: "ACCT" },
  { key: "locationCode", required: false, example: "DXB-HQ" },
  { key: "managerEmail", required: false, example: "", help: "Existing employee or another row in this file" },
  { key: "emiratesIdNumber", required: false, example: "784-1990-1234567-1" },
  { key: "emiratesIdExpiry", required: false, example: "2027-04-20" },
  { key: "passportNumber", required: false, example: "" },
  { key: "passportExpiry", required: false, example: "" },
  { key: "visaNumber", required: false, example: "" },
  { key: "visaExpiry", required: false, example: "" },
  { key: "labourCardNumber", required: false, example: "" },
  { key: "labourCardExpiry", required: false, example: "" },
  { key: "bankName", required: false, example: "Emirates NBD" },
  { key: "iban", required: false, example: "AE070331234567890123456" },
  { key: "bankAccountName", required: false, example: "" },
  { key: "bankRoutingCode", required: false, example: "302620122" },
] as const;

export const MAX_IMPORT_ROWS = 2000;

export type ImportLookups = {
  departments: Map<string, string>; // code (upper) -> id
  positions: Map<string, string>;
  locations: Map<string, string>;
  existingEmails: Set<string>; // lower-case emails already used by users/employees
  existingNumbers: Set<string>;
  activeEmployeesByEmail: Map<string, string>; // lower-case email -> employee id (possible managers)
};

export type ImportRow = {
  row: number; // 1-based data row (header excluded)
  name: string;
  email: string;
  errors: string[];
  input?: EmployeeCreateInput;
  /** Manager referenced by email: either an existing employee id or another row in the file. */
  manager?: { existingId: string } | { rowIndex: number };
};

export type ImportValidation = {
  rows: ImportRow[];
  /** Order in which valid rows must be created so in-file managers exist first. */
  creationOrder: number[];
  errorCount: number;
  fileErrors: string[];
};

export function parseCsv(text: string): { records: Record<string, string>[]; headers: string[]; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });
  const errors = parsed.errors.slice(0, 10).map((e) => `Row ${(e.row ?? 0) + 1}: ${e.message}`);
  return { records: parsed.data, headers: parsed.meta.fields ?? [], errors };
}

export function validateImport(records: Record<string, string>[], headers: string[], lookups: ImportLookups): ImportValidation {
  const fileErrors: string[] = [];
  const headerMap = new Map(headers.map((h) => [h.toLowerCase(), h]));
  const missing = IMPORT_COLUMNS.filter((c) => c.required && !headerMap.has(c.key.toLowerCase())).map((c) => c.key);
  if (missing.length) fileErrors.push(`Missing required columns: ${missing.join(", ")}`);
  if (records.length === 0) fileErrors.push("The file has no data rows.");
  if (records.length > MAX_IMPORT_ROWS) fileErrors.push(`Too many rows (max ${MAX_IMPORT_ROWS}).`);
  if (fileErrors.length) return { rows: [], creationOrder: [], errorCount: fileErrors.length, fileErrors };

  const get = (rec: Record<string, string>, key: string) => {
    const h = headerMap.get(key.toLowerCase());
    return h ? (rec[h] ?? "") : "";
  };

  const emailRow = new Map<string, number>();
  const numberRow = new Map<string, number>();
  const rows: ImportRow[] = records.map((rec, i) => {
    const errors: string[] = [];
    const email = get(rec, "workEmail").toLowerCase();
    const number = get(rec, "employeeNumber");
    const name = `${get(rec, "firstName")} ${get(rec, "lastName")}`.trim();

    if (email) {
      if (lookups.existingEmails.has(email)) errors.push(`workEmail ${email} already exists`);
      if (emailRow.has(email)) errors.push(`workEmail duplicates row ${emailRow.get(email)! + 1}`);
      else emailRow.set(email, i);
    }
    if (number) {
      if (lookups.existingNumbers.has(number)) errors.push(`employeeNumber ${number} already exists`);
      if (numberRow.has(number)) errors.push(`employeeNumber duplicates row ${numberRow.get(number)! + 1}`);
      else numberRow.set(number, i);
    }

    const lookup = (field: string, map: Map<string, string>, label: string) => {
      const code = get(rec, field).toUpperCase();
      if (!code) return null;
      const id = map.get(code);
      if (!id) errors.push(`Unknown ${label} code "${code}"`);
      return id ?? null;
    };
    const departmentId = lookup("departmentCode", lookups.departments, "department");
    const positionId = lookup("positionCode", lookups.positions, "position");
    const locationId = lookup("locationCode", lookups.locations, "location");

    const parsed = employeeCreateSchema.safeParse({
      employeeNumber: number,
      firstName: get(rec, "firstName"),
      lastName: get(rec, "lastName"),
      preferredName: get(rec, "preferredName"),
      workEmail: get(rec, "workEmail"),
      personalEmail: get(rec, "personalEmail"),
      phone: get(rec, "phone"),
      dateOfBirth: get(rec, "dateOfBirth"),
      gender: get(rec, "gender").toUpperCase(),
      nationality: get(rec, "nationality"),
      maritalStatus: "",
      address: "",
      joinDate: get(rec, "joinDate"),
      probationEndDate: get(rec, "probationEndDate"),
      employmentType: get(rec, "employmentType").toUpperCase().replace(/[\s-]/g, "_"),
      departmentId,
      positionId,
      locationId,
      managerId: null,
      emiratesIdNumber: get(rec, "emiratesIdNumber"),
      emiratesIdExpiry: get(rec, "emiratesIdExpiry"),
      passportNumber: get(rec, "passportNumber"),
      passportExpiry: get(rec, "passportExpiry"),
      visaNumber: get(rec, "visaNumber"),
      visaExpiry: get(rec, "visaExpiry"),
      labourCardNumber: get(rec, "labourCardNumber"),
      labourCardExpiry: get(rec, "labourCardExpiry"),
      bankName: get(rec, "bankName"),
      iban: get(rec, "iban"),
      bankAccountName: get(rec, "bankAccountName"),
      bankRoutingCode: get(rec, "bankRoutingCode"),
      sendInvite: "false",
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(`${issue.path.join(".") || "row"}: ${issue.message}`);
    }
    return { row: i + 1, name, email, errors, input: parsed.success ? parsed.data : undefined };
  });

  // Resolve managers (second pass, now that every row's email is known).
  rows.forEach((row, i) => {
    const managerEmail = get(records[i], "managerEmail").toLowerCase();
    if (!managerEmail) return;
    if (managerEmail === row.email) {
      row.errors.push("An employee cannot be their own manager");
      return;
    }
    const inFile = emailRow.get(managerEmail);
    if (inFile !== undefined) row.manager = { rowIndex: inFile };
    else if (lookups.activeEmployeesByEmail.has(managerEmail)) row.manager = { existingId: lookups.activeEmployeesByEmail.get(managerEmail)! };
    else row.errors.push(`managerEmail ${managerEmail} is not an active employee or a row in this file`);
  });

  // Topological order: in-file managers before their reports. Rows left over are in a cycle.
  const order: number[] = [];
  const placed = new Set<number>();
  let progressed = true;
  while (progressed) {
    progressed = false;
    rows.forEach((row, i) => {
      if (placed.has(i)) return;
      const dep = row.manager && "rowIndex" in row.manager ? row.manager.rowIndex : null;
      if (dep === null || placed.has(dep)) {
        order.push(i);
        placed.add(i);
        progressed = true;
      }
    });
  }
  rows.forEach((row, i) => {
    if (!placed.has(i)) row.errors.push("Reporting line forms a loop within the file");
  });
  // A row whose in-file manager is invalid can't be created either.
  for (const i of order) {
    const m = rows[i].manager;
    if (m && "rowIndex" in m && rows[m.rowIndex].errors.length && !rows[i].errors.length) {
      rows[i].errors.push(`Manager (row ${m.rowIndex + 1}) has errors`);
    }
  }

  const errorCount = rows.filter((r) => r.errors.length).length;
  return { rows, creationOrder: order, errorCount, fileErrors };
}

export function importTemplateCsv() {
  const header = IMPORT_COLUMNS.map((c) => c.key).join(",");
  const example = IMPORT_COLUMNS.map((c) => c.example).join(",");
  return `${header}\n${example}\n`;
}
