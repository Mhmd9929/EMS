/**
 * Phase 3 demo data: pay components, WPS settings, salary structures by grade (with history and a
 * mid-month raise), one-time adjustments, released payroll for every completed month of this year
 * (run through the real maker-checker services), and a draft final settlement for the upcoming leaver.
 */
import type { PrismaClient } from "@prisma/client";
import { ensureDefaultPayComponents } from "./payroll-defaults";
import { contextForUser } from "../src/server/auth/system-context";
import { approveRun, calculateRun, createRun, releaseRun, submitRun } from "../src/server/services/payroll/run.service";
import { saveSettlement } from "../src/server/services/payroll/settlement.service";

const BASIC_BY_GRADE: Record<string, number> = { G10: 60000, G9: 38000, G8: 28000, G7: 22000, G6: 16000, G5: 12000, G4: 8500, G3: 5500 };
// Demo routing codes per bank code (verify real WPS agent IDs with your bank).
const ROUTING: Record<string, string> = { "026": "302620122", "035": "803520101", "003": "600310101", "024": "502410101", "033": "203320101" };

export async function seedPayroll(db: PrismaClient, companyId: string, today: Date) {
  await ensureDefaultPayComponents(db, companyId);
  await db.company.update({ where: { id: companyId }, data: { wpsEmployerId: "1000000123456", wpsEmployerBankCode: "302620122" } });
  const components = Object.fromEntries((await db.payComponent.findMany({ where: { companyId } })).map((c) => [c.code, c]));
  const employees = await db.employee.findMany({ where: { companyId }, include: { position: true }, orderBy: { employeeNumber: "asc" } });
  const year = today.getUTCFullYear();
  const fils = (aed: number) => BigInt(Math.round(aed) * 100);

  let i = 0;
  for (const e of employees) {
    i++;
    const ibanBank = e.iban?.slice(4, 7) ?? "";
    await db.employee.update({
      where: { id: e.id },
      data: { bankRoutingCode: ROUTING[ibanBank] ?? null, labourCardNumber: e.labourCardNumber ?? String(10_000_000_000_000 + i * 7919) },
    });
    const basic = (BASIC_BY_GRADE[e.position?.grade ?? "G4"] ?? 8500) * (0.92 + ((i * 37) % 17) / 100);
    const transport = (e.position?.level ?? 4) >= 7 ? 3000 : 1500;
    const other = 500 + ((i * 13) % 4) * 250;
    const lines = (b: number) => [
      { componentId: components.BASIC.id, amount: fils(b) },
      { componentId: components.HOUSING.id, amount: null },
      { componentId: components.TRANSPORT.id, amount: fils(transport) },
      { componentId: components.OTHER_ALLOWANCE.id, amount: fils(other) },
    ];
    // History: starting salary at joining, then a raise this year for long-serving staff.
    const raiseDate = i % 7 === 0 ? new Date(Date.UTC(year, 6, 16)) : new Date(Date.UTC(year, 3, 1)); // a few mid-month (16 Jul) raises
    const raised = e.joinDate < new Date(Date.UTC(year - 1, 0, 1)) && i % 2 === 0;
    await db.salaryStructure.create({
      data: { companyId, employeeId: e.id, effectiveFrom: e.joinDate, reason: "Offer letter", lines: { create: lines(raised ? Math.round(basic * 0.9) : Math.round(basic)) } },
    });
    if (raised) {
      await db.salaryStructure.create({
        data: { companyId, employeeId: e.id, effectiveFrom: raiseDate, reason: "Annual increment", lines: { create: lines(Math.round(basic)) } },
      });
    }
  }

  // One-time adjustments: past bonuses/overtime and some for the current month (not yet paid).
  const byKey = (n: number) => employees[n % employees.length];
  const adjust = async (n: number, month: number, code: string, aed: number, description: string) =>
    db.payrollAdjustment.create({ data: { companyId, employeeId: byKey(n).id, period: `${year}-${String(month).padStart(2, "0")}`, componentId: components[code].id, amount: fils(aed), description } });
  const currentMonth = today.getUTCMonth() + 1;
  for (let m = 1; m < currentMonth; m++) {
    await adjust(m * 3, m, "OVERTIME", 450 + m * 25, "Weekend overtime");
    if (m % 3 === 0) await adjust(m * 5 + 1, m, "BONUS", 3000, `Q${m / 3} performance bonus`);
    if (m === 5) await adjust(11, m, "REIMBURSEMENT", 820, "Visa medical reimbursement");
    if (m >= 6) await adjust(17, m, "LOAN", 1000, `Salary advance recovery ${m - 5}/4`);
  }
  await adjust(2, currentMonth, "BONUS", 5000, "Project delivery bonus");
  await adjust(9, currentMonth, "OVERTIME", 780, "Year-end stock count overtime");
  await adjust(21, currentMonth, "REIMBURSEMENT", 350, "Client visit taxi fares");
  await adjust(30, currentMonth, "OTHER_DEDUCTION", 250, "Lost access card");

  // Released payroll for each completed month (maker: payroll@, checker: admin@).
  const maker = await contextForUser("payroll@falcongulf.ae");
  const checker = await contextForUser("admin@falcongulf.ae");
  for (let m = 1; m < currentMonth; m++) {
    const period = `${year}-${String(m).padStart(2, "0")}`;
    const run = await createRun(maker, { period, scope: "ALL", scopeId: null, notes: null });
    await calculateRun(maker, run.id);
    // Payroll admins would fix data issues; for the demo, hold anyone with a blocking issue.
    const blocked = await db.payrollRunEmployee.findMany({ where: { runId: run.id } });
    for (const b of blocked) {
      if ((b.issues as { level: string }[]).some((x) => x.level === "error")) {
        await db.payrollRunEmployee.update({ where: { id: b.id }, data: { status: "HELD", statusReason: "Missing bank details" } });
      }
    }
    await submitRun(maker, run.id);
    await approveRun(checker, run.id, "Checked against last month's register");
    await releaseRun(maker, run.id, { notify: false });
  }

  // Draft final settlement for the employee leaving at month end (approve as admin@ to see maker-checker).
  const leaver = await db.employee.findFirst({ where: { companyId, status: { not: "TERMINATED" }, lastWorkingDay: { not: null } } });
  if (leaver) await saveSettlement(maker, { employeeId: leaver.id, otherEarnings: "0", deductions: "500", notes: "Deduction: company laptop bag not returned" });
}
