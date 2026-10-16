import "server-only";
import { db } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { writeAudit } from "@/server/audit";
import { ValidationError } from "@/server/errors";
import { parseCsv, validateImport, type ImportI18n, type ImportLookups, type ImportValidation } from "@/lib/import/employee-csv";
import { getAppLocale, serverT } from "@/server/i18n";
import { translateIssue } from "@/server/validation-i18n";
import { createEmployee } from "./employee.service";
import { sendInvite } from "./user.service";

async function loadLookups(companyId: string): Promise<ImportLookups> {
  const [departments, positions, locations, employees, users] = await Promise.all([
    db.department.findMany({ where: { companyId, isActive: true }, select: { id: true, code: true } }),
    db.position.findMany({ where: { companyId, isActive: true }, select: { id: true, code: true } }),
    db.location.findMany({ where: { companyId, isActive: true }, select: { id: true, code: true } }),
    db.employee.findMany({ where: { companyId }, select: { id: true, workEmail: true, employeeNumber: true, status: true } }),
    db.user.findMany({ select: { email: true } }), // emails are globally unique
  ]);
  return {
    departments: new Map(departments.map((d) => [d.code.toUpperCase(), d.id])),
    positions: new Map(positions.map((p) => [p.code.toUpperCase(), p.id])),
    locations: new Map(locations.map((l) => [l.code.toUpperCase(), l.id])),
    existingEmails: new Set([...users.map((u) => u.email.toLowerCase()), ...employees.map((e) => e.workEmail.toLowerCase())]),
    existingNumbers: new Set(employees.map((e) => e.employeeNumber)),
    activeEmployeesByEmail: new Map(employees.filter((e) => e.status !== "TERMINATED").map((e) => [e.workEmail.toLowerCase(), e.id])),
  };
}

export type ImportPreview = ImportValidation & { total: number };

export async function previewImport(ctx: AuthContext, csvText: string): Promise<ImportPreview> {
  assertCan(ctx, "employee.import");
  const [t, locale] = await Promise.all([serverT("employees"), getAppLocale()]);
  const i18n: ImportI18n = {
    t: (key, values) => t(`import.errors.${key}`, values),
    issueMessage: (issue) => translateIssue(issue, locale),
  };
  const { records, headers, errors } = parseCsv(csvText, i18n);
  const result = validateImport(records, headers, await loadLookups(ctx.companyId), i18n);
  return { ...result, fileErrors: [...errors, ...result.fileErrors], total: records.length };
}

/** All-or-nothing import: re-validates server-side and refuses if any row has errors. */
export async function commitImport(ctx: AuthContext, csvText: string, opts: { sendInvites: boolean }) {
  assertCan(ctx, ["employee.import"]);
  assertCan(ctx, ["employee.create"]);
  const preview = await previewImport(ctx, csvText);
  if (preview.fileErrors.length || preview.errorCount) {
    throw new ValidationError((await serverT("employees"))("errors.importHasErrors"));
  }
  const created = await db.$transaction(
    async (tx) => {
      const idByRow = new Map<number, string>();
      const out: { id: string; userId: string | null }[] = [];
      for (const i of preview.creationOrder) {
        const row = preview.rows[i];
        const managerId = row.manager ? ("existingId" in row.manager ? row.manager.existingId : idByRow.get(row.manager.rowIndex)!) : null;
        const employee = await createEmployee(ctx, { ...row.input!, managerId, sendInvite: false }, tx);
        idByRow.set(i, employee.id);
        out.push({ id: employee.id, userId: employee.userId });
      }
      await writeAudit(ctx, { action: "employee.import", entityType: "Employee", summary: `Imported ${out.length} employees from CSV` }, tx);
      return out;
    },
    { timeout: 300_000, maxWait: 10_000 },
  );
  let invited = 0;
  if (opts.sendInvites) {
    for (const e of created) {
      if (!e.userId) continue;
      await sendInvite(ctx, e.userId).then(() => invited++).catch((err) => console.error("[import] invite failed", err));
    }
  }
  return { created: created.length, invited };
}
