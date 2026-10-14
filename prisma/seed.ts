/**
 * Demo seed: one company, RBAC, org structure and ~40 employees across 4 reporting levels.
 *
 * WARNING: resets all application data. Run with `npm run db:seed` (or `npm run db:reset`).
 */
import { PrismaClient, type EmploymentType, type Gender } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLES, type SystemRoleKey } from "../src/server/rbac/catalogue";
import { syncPermissions } from "./sync-permissions";

const db = new PrismaClient();

export const DEMO_PASSWORD = "Demo@12345";
export const NEW_JOINER_PASSWORD = "Welcome@2026";
const DOMAIN = "falcongulf.ae";

// ───────────── deterministic helpers ─────────────
let seed = 20260101;
function rand() {
  // mulberry32
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]) => arr[int(0, arr.length - 1)];
const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join("");
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);
const iso = (date: Date) => date.toISOString().slice(0, 10);

function todayDubai() {
  return d(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date()));
}

/** Valid UAE IBAN with correct mod-97 check digits. */
function uaeIban(bankCode: string) {
  const bban = bankCode + digits(16);
  const numeric = (bban + "AE00").replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  return `AE${String(98 - rem).padStart(2, "0")}${bban}`;
}

const BANKS = [
  { name: "Emirates NBD", code: "026" },
  { name: "First Abu Dhabi Bank", code: "035" },
  { name: "Abu Dhabi Commercial Bank", code: "003" },
  { name: "Dubai Islamic Bank", code: "024" },
  { name: "Mashreq Bank", code: "033" },
];

// ───────────── reference data ─────────────
const LOCATIONS = [
  { code: "DXB-HQ", name: "Dubai Head Office", city: "Dubai", emirate: "Dubai", address: "Office 1204, Business Bay Tower, Business Bay" },
  { code: "AUH", name: "Abu Dhabi Branch", city: "Abu Dhabi", emirate: "Abu Dhabi", address: "Al Maryah Island, Tower 3" },
  { code: "JAFZA", name: "Jebel Ali Warehouse", city: "Dubai", emirate: "Dubai", address: "Plot S30402, Jebel Ali Free Zone South" },
];

const DEPARTMENTS: { code: string; name: string; cc: string; parent?: string }[] = [
  { code: "EXEC", name: "Executive Office", cc: "CC-100" },
  { code: "FIN", name: "Finance", cc: "CC-200" },
  { code: "FIN-ACC", name: "Accounts", cc: "CC-210", parent: "FIN" },
  { code: "FIN-PAY", name: "Payroll", cc: "CC-220", parent: "FIN" },
  { code: "HR", name: "Human Resources", cc: "CC-300" },
  { code: "HR-TA", name: "Talent Acquisition", cc: "CC-310", parent: "HR" },
  { code: "TECH", name: "Technology", cc: "CC-400" },
  { code: "TECH-ENG", name: "Engineering", cc: "CC-410", parent: "TECH" },
  { code: "TECH-IT", name: "IT Support", cc: "CC-420", parent: "TECH" },
  { code: "SAM", name: "Sales & Marketing", cc: "CC-500" },
  { code: "SAM-SAL", name: "Sales", cc: "CC-510", parent: "SAM" },
  { code: "SAM-MKT", name: "Marketing", cc: "CC-520", parent: "SAM" },
  { code: "OPS", name: "Operations", cc: "CC-600" },
  { code: "OPS-LOG", name: "Logistics", cc: "CC-610", parent: "OPS" },
];

const POSITIONS = [
  { code: "CEO", title: "Chief Executive Officer", grade: "G10", level: 10 },
  { code: "DIR-FIN", title: "Finance Director", grade: "G9", level: 9 },
  { code: "DIR-HR", title: "HR Director", grade: "G9", level: 9 },
  { code: "DIR-TECH", title: "Technology Director", grade: "G9", level: 9 },
  { code: "DIR-SAM", title: "Sales & Marketing Director", grade: "G9", level: 9 },
  { code: "DIR-OPS", title: "Operations Director", grade: "G9", level: 9 },
  { code: "EA", title: "Executive Assistant", grade: "G4", level: 4 },
  { code: "MGR-FIN", title: "Finance Manager", grade: "G7", level: 7 },
  { code: "MGR-PAY", title: "Payroll Manager", grade: "G7", level: 7 },
  { code: "MGR-HR", title: "HR Manager", grade: "G7", level: 7 },
  { code: "LEAD-TA", title: "Talent Acquisition Lead", grade: "G6", level: 6 },
  { code: "MGR-ENG", title: "Engineering Manager", grade: "G7", level: 7 },
  { code: "LEAD-IT", title: "IT Support Lead", grade: "G6", level: 6 },
  { code: "MGR-SAL", title: "Sales Manager", grade: "G7", level: 7 },
  { code: "MGR-MKT", title: "Marketing Manager", grade: "G7", level: 7 },
  { code: "MGR-LOG", title: "Logistics Manager", grade: "G7", level: 7 },
  { code: "ACCT", title: "Accountant", grade: "G4", level: 4 },
  { code: "PAY-SPEC", title: "Payroll Specialist", grade: "G4", level: 4 },
  { code: "HR-GEN", title: "HR Generalist", grade: "G4", level: 4 },
  { code: "TA-SPEC", title: "Recruitment Specialist", grade: "G4", level: 4 },
  { code: "SWE-SR", title: "Senior Software Engineer", grade: "G6", level: 6 },
  { code: "SWE", title: "Software Engineer", grade: "G5", level: 5 },
  { code: "IT-ENG", title: "IT Support Engineer", grade: "G4", level: 4 },
  { code: "SYSADMIN", title: "Systems Administrator", grade: "G5", level: 5 },
  { code: "AE", title: "Account Executive", grade: "G4", level: 4 },
  { code: "MKT-SPEC", title: "Marketing Specialist", grade: "G4", level: 4 },
  { code: "LOG-COORD", title: "Logistics Coordinator", grade: "G3", level: 3 },
];

type Person = {
  key: string;
  first: string;
  last: string;
  gender: Gender;
  nationality: string;
  position: string;
  dept: string;
  manager?: string;
  location?: string;
  joined: string;
  type?: EmploymentType;
  login?: { email: string; roles: SystemRoleKey[]; mustChange?: boolean; password?: string };
};

// 4 levels: CEO → directors → managers/leads → staff
const PEOPLE: Person[] = [
  // Level 1
  { key: "ceo", first: "Khalid", last: "Al Mansoori", gender: "MALE", nationality: "Emirati", position: "CEO", dept: "EXEC", joined: "2012-03-01" },
  // Level 2
  { key: "ea", first: "Noura", last: "Al Ketbi", gender: "FEMALE", nationality: "Emirati", position: "EA", dept: "EXEC", manager: "ceo", joined: "2019-09-15" },
  { key: "dirFin", first: "Rajesh", last: "Menon", gender: "MALE", nationality: "Indian", position: "DIR-FIN", dept: "FIN", manager: "ceo", joined: "2014-01-12" },
  { key: "dirHr", first: "Layla", last: "Haddad", gender: "FEMALE", nationality: "Lebanese", position: "DIR-HR", dept: "HR", manager: "ceo", joined: "2015-06-01" },
  { key: "dirTech", first: "Daniel", last: "Whitmore", gender: "MALE", nationality: "British", position: "DIR-TECH", dept: "TECH", manager: "ceo", joined: "2016-02-20" },
  { key: "dirSam", first: "Hessa", last: "Al Suwaidi", gender: "FEMALE", nationality: "Emirati", position: "DIR-SAM", dept: "SAM", manager: "ceo", joined: "2015-11-03" },
  { key: "dirOps", first: "Tariq", last: "Farouk", gender: "MALE", nationality: "Egyptian", position: "DIR-OPS", dept: "OPS", manager: "ceo", location: "JAFZA", joined: "2013-08-18" },
  // Level 3
  { key: "mgrFin", first: "Priya", last: "Nair", gender: "FEMALE", nationality: "Indian", position: "MGR-FIN", dept: "FIN-ACC", manager: "dirFin", joined: "2017-04-09" },
  {
    key: "mgrPay", first: "Ahmed", last: "Siddiqui", gender: "MALE", nationality: "Pakistani", position: "MGR-PAY", dept: "FIN-PAY", manager: "dirFin", joined: "2018-01-07",
    login: { email: `payroll@${DOMAIN}`, roles: ["PAYROLL_ADMIN", "MANAGER", "EMPLOYEE"] },
  },
  {
    key: "mgrHr", first: "Mariam", last: "Al Zaabi", gender: "FEMALE", nationality: "Emirati", position: "MGR-HR", dept: "HR", manager: "dirHr", joined: "2018-05-13",
    login: { email: `hr@${DOMAIN}`, roles: ["HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  },
  { key: "leadTa", first: "Grace", last: "Santos", gender: "FEMALE", nationality: "Filipino", position: "LEAD-TA", dept: "HR-TA", manager: "dirHr", joined: "2020-02-02" },
  {
    key: "mgrEng", first: "Yousef", last: "Qasim", gender: "MALE", nationality: "Jordanian", position: "MGR-ENG", dept: "TECH-ENG", manager: "dirTech", joined: "2019-03-10",
    login: { email: `manager@${DOMAIN}`, roles: ["MANAGER", "EMPLOYEE"] },
  },
  { key: "leadIt", first: "Vikram", last: "Rao", gender: "MALE", nationality: "Indian", position: "LEAD-IT", dept: "TECH-IT", manager: "dirTech", joined: "2018-10-21" },
  { key: "mgrSal", first: "Omar", last: "Khalil", gender: "MALE", nationality: "Syrian", position: "MGR-SAL", dept: "SAM-SAL", manager: "dirSam", location: "AUH", joined: "2017-07-16" },
  { key: "mgrMkt", first: "Sophie", last: "Laurent", gender: "FEMALE", nationality: "French", position: "MGR-MKT", dept: "SAM-MKT", manager: "dirSam", joined: "2021-01-17" },
  { key: "mgrLog", first: "Imran", last: "Sheikh", gender: "MALE", nationality: "Pakistani", position: "MGR-LOG", dept: "OPS-LOG", manager: "dirOps", location: "JAFZA", joined: "2016-09-04" },
  // Level 4
  { key: "acc1", first: "Anjali", last: "Pillai", gender: "FEMALE", nationality: "Indian", position: "ACCT", dept: "FIN-ACC", manager: "mgrFin", joined: "2020-06-14" },
  { key: "acc2", first: "Mohammed", last: "Rafiq", gender: "MALE", nationality: "Bangladeshi", position: "ACCT", dept: "FIN-ACC", manager: "mgrFin", joined: "2021-09-05" },
  { key: "acc3", first: "Hana", last: "Yousif", gender: "FEMALE", nationality: "Sudanese", position: "ACCT", dept: "FIN-ACC", manager: "mgrFin", joined: "2023-02-19" },
  { key: "pay1", first: "Joseph", last: "Mathew", gender: "MALE", nationality: "Indian", position: "PAY-SPEC", dept: "FIN-PAY", manager: "mgrPay", joined: "2022-04-03" },
  { key: "hr1", first: "Aisha", last: "Bakr", gender: "FEMALE", nationality: "Egyptian", position: "HR-GEN", dept: "HR", manager: "mgrHr", joined: "2021-03-21" },
  { key: "hr2", first: "Ryan", last: "Dsouza", gender: "MALE", nationality: "Indian", position: "HR-GEN", dept: "HR", manager: "mgrHr", joined: "2024-08-11" },
  { key: "ta1", first: "Maricel", last: "Reyes", gender: "FEMALE", nationality: "Filipino", position: "TA-SPEC", dept: "HR-TA", manager: "leadTa", joined: "2022-11-06" },
  { key: "ta2", first: "Karim", last: "Benali", gender: "MALE", nationality: "Moroccan", position: "TA-SPEC", dept: "HR-TA", manager: "leadTa", joined: "2025-01-12" },
  { key: "swe1", first: "Elena", last: "Petrova", gender: "FEMALE", nationality: "Russian", position: "SWE-SR", dept: "TECH-ENG", manager: "mgrEng", joined: "2020-10-04" },
  {
    key: "swe2", first: "Sara", last: "Al Hammadi", gender: "FEMALE", nationality: "Emirati", position: "SWE", dept: "TECH-ENG", manager: "mgrEng", joined: "2022-07-17",
    login: { email: `employee@${DOMAIN}`, roles: ["EMPLOYEE"] },
  },
  { key: "swe3", first: "Arjun", last: "Kapoor", gender: "MALE", nationality: "Indian", position: "SWE", dept: "TECH-ENG", manager: "mgrEng", joined: "2023-05-28" },
  { key: "swe4", first: "Lucas", last: "Moreau", gender: "MALE", nationality: "Canadian", position: "SWE", dept: "TECH-ENG", manager: "swe1", joined: "2024-02-04", type: "CONTRACT" },
  { key: "swe5", first: "Fatima", last: "Zahra", gender: "FEMALE", nationality: "Moroccan", position: "SWE", dept: "TECH-ENG", manager: "swe1", joined: "2025-09-07" },
  { key: "it1", first: "Paolo", last: "Cruz", gender: "MALE", nationality: "Filipino", position: "IT-ENG", dept: "TECH-IT", manager: "leadIt", joined: "2021-06-27" },
  {
    key: "it2", first: "Hamdan", last: "Al Falasi", gender: "MALE", nationality: "Emirati", position: "SYSADMIN", dept: "TECH-IT", manager: "leadIt", joined: "2019-12-01",
    login: { email: `admin@${DOMAIN}`, roles: ["SUPER_ADMIN", "EMPLOYEE"] },
  },
  { key: "sal1", first: "Nadia", last: "Aziz", gender: "FEMALE", nationality: "Jordanian", position: "AE", dept: "SAM-SAL", manager: "mgrSal", location: "AUH", joined: "2020-01-26" },
  { key: "sal2", first: "Christopher", last: "Lee", gender: "MALE", nationality: "Australian", position: "AE", dept: "SAM-SAL", manager: "mgrSal", location: "AUH", joined: "2022-03-13" },
  { key: "sal3", first: "Mansoor", last: "Al Nuaimi", gender: "MALE", nationality: "Emirati", position: "AE", dept: "SAM-SAL", manager: "mgrSal", joined: "2023-10-01" },
  { key: "sal4", first: "Rania", last: "Saleh", gender: "FEMALE", nationality: "Lebanese", position: "AE", dept: "SAM-SAL", manager: "mgrSal", joined: "2024-06-16", type: "PART_TIME" },
  { key: "mkt1", first: "Zainab", last: "Hussain", gender: "FEMALE", nationality: "Pakistani", position: "MKT-SPEC", dept: "SAM-MKT", manager: "mgrMkt", joined: "2022-09-18" },
  { key: "mkt2", first: "Tom", last: "Fischer", gender: "MALE", nationality: "German", position: "MKT-SPEC", dept: "SAM-MKT", manager: "mgrMkt", joined: "2025-04-06" },
  { key: "log1", first: "Suresh", last: "Kumar", gender: "MALE", nationality: "Indian", position: "LOG-COORD", dept: "OPS-LOG", manager: "mgrLog", location: "JAFZA", joined: "2018-02-11" },
  { key: "log2", first: "Abdullah", last: "Noor", gender: "MALE", nationality: "Yemeni", position: "LOG-COORD", dept: "OPS-LOG", manager: "mgrLog", location: "JAFZA", joined: "2021-11-14" },
  { key: "log3", first: "Bilal", last: "Chaudhry", gender: "MALE", nationality: "Pakistani", position: "LOG-COORD", dept: "OPS-LOG", manager: "mgrLog", location: "JAFZA", joined: "2024-12-08" },
];

// 2026–2027 UAE public holidays (lunar dates are estimates — editable in Phase 2).
const HOLIDAYS: [string, string][] = [
  ["2026-01-01", "New Year's Day"],
  ["2026-03-19", "Eid Al Fitr"],
  ["2026-03-20", "Eid Al Fitr"],
  ["2026-03-21", "Eid Al Fitr"],
  ["2026-05-26", "Arafat Day"],
  ["2026-05-27", "Eid Al Adha"],
  ["2026-05-28", "Eid Al Adha"],
  ["2026-05-29", "Eid Al Adha"],
  ["2026-06-16", "Islamic New Year"],
  ["2026-08-25", "Prophet Mohammed's Birthday"],
  ["2026-12-01", "Commemoration Day"],
  ["2026-12-02", "UAE National Day"],
  ["2026-12-03", "UAE National Day"],
  ["2027-01-01", "New Year's Day"],
  ["2027-03-09", "Eid Al Fitr"],
  ["2027-03-10", "Eid Al Fitr"],
  ["2027-03-11", "Eid Al Fitr"],
  ["2027-05-15", "Arafat Day"],
  ["2027-05-16", "Eid Al Adha"],
  ["2027-05-17", "Eid Al Adha"],
  ["2027-05-18", "Eid Al Adha"],
];

async function reset() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations') AND tablename NOT LIKE 'pgboss%'`;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} CASCADE`);
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error("Refusing to reset a production database. Set ALLOW_PRODUCTION_SEED=true to override.");
  }
  if (process.argv.includes("--if-empty") && (await db.company.count()) > 0) {
    console.log("Data already present — skipping seed (--if-empty).");
    return;
  }
  console.log("Resetting data…");
  await reset();
  await syncPermissions(db);

  const today = todayDubai();
  const company = await db.company.create({
    data: {
      name: "Falcon Gulf Trading",
      legalName: "Falcon Gulf Trading LLC",
      addressLine1: "Office 1204, Business Bay Tower",
      addressLine2: "Business Bay",
      city: "Dubai",
      emirate: "Dubai",
      country: "AE",
      phone: "+971 4 555 0100",
      email: `hr@${DOMAIN}`,
      website: `https://www.${DOMAIN}`,
      tradeLicenseNumber: "DED-845213",
      currency: "AED",
      timezone: "Asia/Dubai",
      workWeek: [1, 2, 3, 4, 5],
      fiscalYearStartMonth: 1,
      employeeNumberPrefix: "FGT-",
      employeeNumberPadding: 4,
    },
  });

  // Roles
  const permissions = await db.permission.findMany();
  const permId = new Map(permissions.map((p) => [p.key, p.id]));
  const roleIds = {} as Record<SystemRoleKey, string>;
  for (const [key, def] of Object.entries(DEFAULT_ROLES) as [SystemRoleKey, (typeof DEFAULT_ROLES)[SystemRoleKey]][]) {
    const role = await db.role.create({
      data: {
        companyId: company.id,
        key,
        name: def.name,
        description: def.description,
        isSystem: true,
        permissions: { create: def.permissions.map((p) => ({ permissionId: permId.get(p)! })) },
      },
    });
    roleIds[key] = role.id;
  }

  // Locations, positions, departments
  const locationIds: Record<string, string> = {};
  for (const l of LOCATIONS) {
    locationIds[l.code] = (await db.location.create({ data: { ...l, companyId: company.id, country: "AE" } })).id;
  }
  const positionIds: Record<string, string> = {};
  for (const p of POSITIONS) {
    positionIds[p.code] = (await db.position.create({ data: { ...p, companyId: company.id } })).id;
  }
  const departmentIds: Record<string, string> = {};
  for (const dep of DEPARTMENTS) {
    departmentIds[dep.code] = (
      await db.department.create({
        data: { companyId: company.id, code: dep.code, name: dep.name, costCenterCode: dep.cc, parentId: dep.parent ? departmentIds[dep.parent] : null },
      })
    ).id;
  }

  // Employees (+ a login per employee; demo users get a password)
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const employeeIds: Record<string, string> = {};
  const managersWithReports = new Set(PEOPLE.map((p) => p.manager).filter(Boolean));
  let seq = 1;

  for (const p of PEOPLE) {
    const number = `FGT-${String(seq++).padStart(4, "0")}`;
    const email = p.login?.email ?? `${p.first}.${p.last}`.toLowerCase().replace(/[^a-z.]/g, "") + `@${DOMAIN}`;
    const joinDate = d(p.joined);
    const birthYear = joinDate.getUTCFullYear() - int(24, 38);
    const dob = d(`${birthYear}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`);
    const bank = pick(BANKS);
    // A handful of documents expire soon so the HR dashboard has something to show.
    const expiryOffset = seq % 9 === 0 ? int(5, 55) : int(120, 900);
    const roles = new Set<SystemRoleKey>(p.login?.roles ?? ["EMPLOYEE"]);
    if (managersWithReports.has(p.key)) roles.add("MANAGER");

    const user = await db.user.create({
      data: {
        companyId: company.id,
        email,
        name: `${p.first} ${p.last}`,
        passwordHash: p.login ? demoHash : null,
        passwordChangedAt: p.login ? new Date() : null,
        roles: { create: [...roles].map((r) => ({ roleId: roleIds[r] })) },
      },
    });

    const emp = await db.employee.create({
      data: {
        companyId: company.id,
        userId: user.id,
        employeeNumber: number,
        firstName: p.first,
        lastName: p.last,
        workEmail: email,
        personalEmail: `${p.first.toLowerCase()}.${int(10, 99)}@mail.example`,
        phone: `+971 5${int(0, 8)} ${digits(3)} ${digits(4)}`,
        dateOfBirth: dob,
        gender: p.gender,
        nationality: p.nationality,
        maritalStatus: pick(["Single", "Married", "Married", "Single"]),
        address: `${pick(["Al Barsha", "JLT", "Dubai Marina", "Al Nahda", "Mirdif", "Khalifa City", "Al Reem Island"])}, ${p.location === "AUH" ? "Abu Dhabi" : "Dubai"}`,
        joinDate,
        probationEndDate: addDays(joinDate, 180),
        employmentType: p.type ?? "FULL_TIME",
        departmentId: departmentIds[p.dept],
        positionId: positionIds[p.position],
        managerId: p.manager ? employeeIds[p.manager] : null,
        locationId: locationIds[p.location ?? "DXB-HQ"],
        emiratesIdNumber: `784-${birthYear}-${digits(7)}-${int(0, 9)}`,
        emiratesIdExpiry: addDays(today, expiryOffset),
        passportNumber: `${pick(["N", "P", "K", "A"])}${digits(7)}`,
        passportExpiry: addDays(today, int(200, 2500)),
        visaNumber: p.nationality === "Emirati" ? null : `201/${joinDate.getUTCFullYear()}/${digits(7)}`,
        visaExpiry: p.nationality === "Emirati" ? null : addDays(today, seq % 7 === 0 ? int(10, 50) : int(100, 700)),
        labourCardNumber: p.nationality === "Emirati" ? null : digits(8),
        labourCardExpiry: p.nationality === "Emirati" ? null : addDays(today, int(100, 700)),
        bankName: bank.name,
        iban: uaeIban(bank.code),
        bankAccountName: `${p.first} ${p.last}`.toUpperCase(),
        emergencyContacts: {
          create: [
            {
              companyId: company.id,
              name: `${pick(["Ali", "Maria", "John", "Huda", "Ravi", "Leila"])} ${p.last}`,
              relationship: pick(["Spouse", "Parent", "Sibling"]),
              phone: `+971 5${int(0, 8)} ${digits(3)} ${digits(4)}`,
            },
          ],
        },
      },
    });
    employeeIds[p.key] = emp.id;
  }

  // Department heads
  const heads: Record<string, string> = {
    EXEC: "ceo", FIN: "dirFin", "FIN-ACC": "mgrFin", "FIN-PAY": "mgrPay", HR: "dirHr", "HR-TA": "leadTa",
    TECH: "dirTech", "TECH-ENG": "mgrEng", "TECH-IT": "leadIt", SAM: "dirSam", "SAM-SAL": "mgrSal",
    "SAM-MKT": "mgrMkt", OPS: "dirOps", "OPS-LOG": "mgrLog",
  };
  for (const [code, key] of Object.entries(heads)) {
    await db.department.update({ where: { id: departmentIds[code] }, data: { headId: employeeIds[key] } });
  }

  // Lifecycle variety: two joiners this month, one leaving at month end, one already terminated.
  const monthStart = d(`${iso(today).slice(0, 8)}01`);
  const monthEnd = addDays(d(`${today.getUTCMonth() === 11 ? today.getUTCFullYear() + 1 : today.getUTCFullYear()}-${String(((today.getUTCMonth() + 1) % 12) + 1).padStart(2, "0")}-01`), -1);

  const newJoiner = await createExtra({
    first: "Omar", last: "Bin Rashid", gender: "MALE", nationality: "Emirati", position: "SWE", dept: "TECH-ENG", manager: employeeIds.mgrEng,
    joinDate: monthStart, email: `new.joiner@${DOMAIN}`, passwordHash: await bcrypt.hash(NEW_JOINER_PASSWORD, 10), mustChange: true,
  });
  await createExtra({
    first: "Leena", last: "Thomas", gender: "FEMALE", nationality: "Indian", position: "HR-GEN", dept: "HR", manager: employeeIds.mgrHr,
    joinDate: addDays(monthStart, 3), email: `leena.thomas@${DOMAIN}`, passwordHash: null,
  });
  await db.employee.update({
    where: { id: employeeIds.log3 },
    data: { lastWorkingDay: monthEnd < today ? today : monthEnd, terminationReason: "Resignation", terminatedAt: new Date() },
  });
  const leaver = await createExtra({
    first: "George", last: "Abraham", gender: "MALE", nationality: "Indian", position: "ACCT", dept: "FIN-ACC", manager: employeeIds.mgrFin,
    joinDate: d("2019-05-05"), email: `george.abraham@${DOMAIN}`, passwordHash: demoHash,
  });
  await db.employee.update({
    where: { id: leaver.employeeId },
    data: { status: "TERMINATED", lastWorkingDay: d(`${today.getUTCFullYear() - 1}-08-31`), terminationReason: "End of contract", terminatedAt: d(`${today.getUTCFullYear() - 1}-08-01`) },
  });
  await db.user.update({ where: { id: leaver.userId }, data: { isActive: false } });

  await db.company.update({ where: { id: company.id }, data: { employeeNumberNextSeq: seq } });

  // Public holidays
  await db.publicHoliday.createMany({
    data: HOLIDAYS.map(([date, name]) => ({ companyId: company.id, name, date: d(date), year: Number(date.slice(0, 4)) })),
  });

  const adminUser = await db.user.findUniqueOrThrow({ where: { email: `admin@${DOMAIN}` } });
  await db.auditLog.create({
    data: { companyId: company.id, actorUserId: adminUser.id, action: "system.seed", entityType: "Company", entityId: company.id, summary: "Demo data seeded" },
  });

  const counts = { employees: await db.employee.count(), departments: await db.department.count(), users: await db.user.count() };
  console.log(`Seeded ${company.name}:`, counts, `new joiner: ${newJoiner.employeeId}`);
  console.log(`Demo password for admin@, hr@, payroll@, manager@, employee@${DOMAIN}: ${DEMO_PASSWORD}`);
  console.log(`First-login demo: new.joiner@${DOMAIN} / ${NEW_JOINER_PASSWORD} (forced password change)`);

  async function createExtra(x: {
    first: string; last: string; gender: Gender; nationality: string; position: string; dept: string; manager: string;
    joinDate: Date; email: string; passwordHash: string | null; mustChange?: boolean;
  }) {
    const user = await db.user.create({
      data: {
        companyId: company.id, email: x.email, name: `${x.first} ${x.last}`, passwordHash: x.passwordHash, mustChangePassword: !!x.mustChange,
        roles: { create: [{ roleId: roleIds.EMPLOYEE }] },
      },
    });
    const emp = await db.employee.create({
      data: {
        companyId: company.id, userId: user.id, employeeNumber: `FGT-${String(seq++).padStart(4, "0")}`,
        firstName: x.first, lastName: x.last, workEmail: x.email, gender: x.gender, nationality: x.nationality,
        joinDate: x.joinDate, probationEndDate: addDays(x.joinDate, 180), employmentType: "FULL_TIME",
        departmentId: departmentIds[x.dept], positionId: positionIds[x.position], managerId: x.manager, locationId: locationIds["DXB-HQ"],
        phone: `+971 5${int(0, 8)} ${digits(3)} ${digits(4)}`,
      },
    });
    return { employeeId: emp.id, userId: user.id };
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

