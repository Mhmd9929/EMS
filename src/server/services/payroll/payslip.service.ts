import "server-only";
import { db } from "@/server/db";
import type { AuthContext } from "@/server/auth/permissions";
import { getEmployeeAccess } from "@/server/rbac/scope";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { maskIban } from "@/lib/iban";
import { serverT } from "@/server/i18n";
import { n } from "./common";

/**
 * Payslip visibility rule (enforced here, tested):
 *   - an employee sees only their OWN payslips, only once released and not voided;
 *   - `payslip.read.all` (Payroll Admin) sees any non-voided payslip in the company.
 * Anything else is reported as "not found" so payslip ids can't be probed.
 */
export async function getPayslip(ctx: AuthContext, payslipId: string) {
  const ps = await db.payslip.findFirst({
    where: { id: payslipId, companyId: ctx.companyId, voidedAt: null, runEmployee: { run: { status: "RELEASED" } } },
    include: { runEmployee: { include: { lines: { orderBy: { sortOrder: "asc" } }, run: true } } },
  });
  const isOwner = !!ps && !!ctx.employeeId && ps.employeeId === ctx.employeeId;
  if (!ps || (!isOwner && !ctx.permissions.has("payslip.read.all"))) throw new NotFoundError((await serverT("payroll"))("errors.payslipNotFound"));

  const company = await db.company.findUniqueOrThrow({
    where: { id: ctx.companyId },
    select: { name: true, legalName: true, addressLine1: true, addressLine2: true, city: true, emirate: true, country: true, phone: true, email: true, tradeLicenseNumber: true, logoPath: true, fiscalYearStartMonth: true, currency: true },
  });
  // Year-to-date (fiscal year) totals from released, non-voided payslips.
  const [y, m] = ps.period.split("-").map(Number);
  const fyStartYear = m >= company.fiscalYearStartMonth ? y : y - 1;
  const fyStart = `${fyStartYear}-${String(company.fiscalYearStartMonth).padStart(2, "0")}`;
  const ytdRows = await db.payrollRunEmployee.findMany({
    where: { employeeId: ps.employeeId, payslip: { voidedAt: null, period: { gte: fyStart, lte: ps.period } } },
    select: { gross: true, deductions: true, net: true },
  });
  const ytd = {
    from: fyStart,
    gross: ytdRows.reduce((a, r) => a + n(r.gross), 0),
    deductions: ytdRows.reduce((a, r) => a + n(r.deductions), 0),
    net: ytdRows.reduce((a, r) => a + n(r.net), 0),
  };
  const e = ps.runEmployee;
  return {
    id: ps.id,
    number: ps.number,
    period: ps.period,
    periodStart: e.run.periodStart,
    periodEnd: e.run.periodEnd,
    releasedAt: ps.releasedAt,
    currency: e.run.currency,
    company,
    employee: {
      id: ps.employeeId,
      number: e.employeeNumber,
      name: e.name,
      department: e.department,
      position: e.position,
      location: e.location,
      joinDate: e.joinDate,
      bankName: e.bankName,
      ibanMasked: maskIban(e.iban),
    },
    calendarDays: e.calendarDays,
    paidDays: Number(e.paidDays),
    unpaidLeaveDays: Number(e.unpaidLeaveDays),
    basis: e.run.prorationBasis,
    earnings: e.lines.filter((l) => l.kind === "EARNING").map((l) => ({ name: l.name, amount: n(l.amount), note: l.note })),
    deductions: e.lines.filter((l) => l.kind === "DEDUCTION").map((l) => ({ name: l.name, amount: n(l.amount), note: l.note })),
    gross: n(e.gross),
    totalDeductions: n(e.deductions),
    net: n(e.net),
    ytd,
  };
}

export type PayslipData = Awaited<ReturnType<typeof getPayslip>>;

/** Released payslips for an employee (self, or anyone with payslip.read.all). */
export async function listPayslips(ctx: AuthContext, employeeId: string, year?: number) {
  if (employeeId !== ctx.employeeId) {
    if (!ctx.permissions.has("payslip.read.all")) throw new ForbiddenError();
    if ((await getEmployeeAccess(ctx, employeeId)) === "none") throw new ForbiddenError();
  }
  const rows = await db.payslip.findMany({
    where: { employeeId, companyId: ctx.companyId, voidedAt: null, runEmployee: { run: { status: "RELEASED" } }, ...(year && { period: { startsWith: String(year) } }) },
    include: { runEmployee: { select: { gross: true, deductions: true, net: true, run: { select: { currency: true } } } } },
    orderBy: { period: "desc" },
  });
  return rows.map((r) => ({ id: r.id, number: r.number, period: r.period, releasedAt: r.releasedAt, currency: r.runEmployee.run.currency, gross: n(r.runEmployee.gross), deductions: n(r.runEmployee.deductions), net: n(r.runEmployee.net) }));
}

/**
 * Password for an encrypted payslip PDF, or null when the company does not protect payslips.
 * Date of birth as DDMMYYYY, falling back to the employee number. Only call after getPayslip authorised access.
 */
export async function payslipPdfPassword(companyId: string, employeeId: string) {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId }, select: { payslipPdfPassword: true } });
  if (!company.payslipPdfPassword) return null;
  const e = await db.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { dateOfBirth: true, employeeNumber: true } });
  if (!e.dateOfBirth) return e.employeeNumber;
  const d = e.dateOfBirth.toISOString().slice(0, 10).split("-");
  return `${d[2]}${d[1]}${d[0]}`;
}
