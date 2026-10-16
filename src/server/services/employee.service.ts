import "server-only";
import { Prisma, type EmployeeStatus, type EmploymentType } from "@prisma/client";
import { db, type DbClient } from "@/server/db";
import { assertCan, type AuthContext } from "@/server/auth/permissions";
import { getEmployeeAccess, getVisibleEmployeeScope, type EmployeeAccess } from "@/server/rbac/scope";
import { writeAudit, diffSnapshots } from "@/server/audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { createsManagerCycle } from "@/server/hierarchy";
import { formatEmployeeNumber } from "@/lib/employee-number";
import { paginated, type ListParams } from "@/lib/list-params";
import { maskEmiratesId, maskTail } from "@/lib/mask";
import { maskIban } from "@/lib/iban";
import { todayInTimeZone } from "@/lib/dates";
import { SYSTEM_ROLES } from "@/server/rbac/catalogue";
import type { EmployeeCreateInput, EmployeeUpdateInput } from "@/lib/validation/employee";
import { sendInvite } from "./user.service";
import { serverT } from "@/server/i18n";

/** Translator for user-facing error messages (request locale; English outside requests). */
const tErr = () => serverT("employees");

// ───────────────────────────── Listing ─────────────────────────────

export const EMPLOYEE_SORTS = ["name", "number", "joinDate", "department", "status"] as const;
export type EmployeeSort = (typeof EMPLOYEE_SORTS)[number];

export type EmployeeFilters = {
  status?: EmployeeStatus;
  departmentId?: string;
  locationId?: string;
  positionId?: string;
  employmentType?: EmploymentType;
};

/** Every search term must match at least one field (so "sara eng" finds Sara in Engineering). */
function searchWhere(q: string, opts: { includeOrgFields?: boolean } = {}): Prisma.EmployeeWhereInput[] {
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 5);
  return terms.map((term) => ({
    OR: [
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { preferredName: { contains: term, mode: "insensitive" } },
      { workEmail: { contains: term, mode: "insensitive" } },
      ...(opts.includeOrgFields
        ? [
            { position: { title: { contains: term, mode: "insensitive" as const } } },
            { department: { name: { contains: term, mode: "insensitive" as const } } },
          ]
        : [{ employeeNumber: { contains: term, mode: "insensitive" as const } }]),
    ],
  }));
}

function orderBy(sort: EmployeeSort, dir: "asc" | "desc"): Prisma.EmployeeOrderByWithRelationInput[] {
  switch (sort) {
    case "number":
      return [{ employeeNumber: dir }];
    case "joinDate":
      return [{ joinDate: dir }, { lastName: "asc" }];
    case "department":
      return [{ department: { name: dir } }, { lastName: "asc" }];
    case "status":
      return [{ status: dir }, { lastName: "asc" }];
    default:
      return [{ firstName: dir }, { lastName: dir }];
  }
}

const listSelect = {
  id: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  workEmail: true,
  photoPath: true,
  status: true,
  employmentType: true,
  joinDate: true,
  lastWorkingDay: true,
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  location: { select: { id: true, name: true } },
  manager: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
} satisfies Prisma.EmployeeSelect;

export type EmployeeListRow = Prisma.EmployeeGetPayload<{ select: typeof listSelect }>;

/** HR / manager employee list, scoped to what the user may see. */
export async function listEmployees(ctx: AuthContext, params: ListParams<EmployeeSort>, filters: EmployeeFilters) {
  assertCan(ctx, ["employee.read.all", "employee.read.team"]);
  const scope = await getVisibleEmployeeScope(ctx);
  const where: Prisma.EmployeeWhereInput = {
    companyId: ctx.companyId,
    ...(scope !== "all" && { id: { in: scope } }),
    ...(filters.status && { status: filters.status }),
    ...(filters.departmentId && { departmentId: filters.departmentId }),
    ...(filters.locationId && { locationId: filters.locationId }),
    ...(filters.positionId && { positionId: filters.positionId }),
    ...(filters.employmentType && { employmentType: filters.employmentType }),
    AND: searchWhere(params.q),
  };
  const [items, total] = await Promise.all([
    db.employee.findMany({
      where,
      select: listSelect,
      orderBy: orderBy(params.sort, params.dir),
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.employee.count({ where }),
  ]);
  return paginated(items, total, params.page, params.pageSize);
}

/** Full (non-paginated) export rows, same scope rules as the list. */
export async function exportEmployees(ctx: AuthContext, filters: EmployeeFilters & { q?: string }) {
  assertCan(ctx, "employee.export");
  const scope = await getVisibleEmployeeScope(ctx);
  return db.employee.findMany({
    where: {
      companyId: ctx.companyId,
      ...(scope !== "all" && { id: { in: scope } }),
      ...(filters.status && { status: filters.status }),
      ...(filters.departmentId && { departmentId: filters.departmentId }),
      ...(filters.locationId && { locationId: filters.locationId }),
      ...(filters.employmentType && { employmentType: filters.employmentType }),
      AND: searchWhere(filters.q ?? ""),
    },
    select: { ...listSelect, phone: true, nationality: true, gender: true },
    orderBy: { employeeNumber: "asc" },
  });
}

// ───────────────────────────── Directory (non-sensitive) ─────────────────────────────

const directorySelect = {
  id: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  workEmail: true,
  photoPath: true,
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  location: { select: { id: true, name: true } },
  manager: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
} satisfies Prisma.EmployeeSelect;

export type DirectoryEntry = Prisma.EmployeeGetPayload<{ select: typeof directorySelect }>;

export const DIRECTORY_SORTS = ["name", "department"] as const;

/** Company directory: visible to every employee, only non-sensitive fields, active staff only. */
export async function listDirectory(
  ctx: AuthContext,
  params: ListParams<(typeof DIRECTORY_SORTS)[number]>,
  filters: { departmentId?: string; locationId?: string },
) {
  assertCan(ctx, "directory.read");
  const where: Prisma.EmployeeWhereInput = {
    companyId: ctx.companyId,
    status: { not: "TERMINATED" },
    ...(filters.departmentId && { departmentId: filters.departmentId }),
    ...(filters.locationId && { locationId: filters.locationId }),
    AND: searchWhere(params.q, { includeOrgFields: true }),
  };
  const [items, total] = await Promise.all([
    db.employee.findMany({
      where,
      select: directorySelect,
      orderBy: params.sort === "department" ? [{ department: { name: params.dir } }, { firstName: "asc" }] : [{ firstName: params.dir }, { lastName: params.dir }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.employee.count({ where }),
  ]);
  return paginated(items, total, params.page, params.pageSize);
}

export async function getDirectoryCard(ctx: AuthContext, id: string) {
  assertCan(ctx, "directory.read");
  const e = await db.employee.findFirst({
    where: { id, companyId: ctx.companyId, status: { not: "TERMINATED" } },
    select: { ...directorySelect, _count: { select: { directReports: { where: { status: { not: "TERMINATED" } } } } } },
  });
  if (!e) throw new NotFoundError((await tErr())("errors.employeeNotFound"));
  return e;
}

// ───────────────────────────── Org chart ─────────────────────────────

export type OrgChartPerson = {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  departmentId: string | null;
  managerId: string | null;
  photo: boolean;
  email: string;
};

export async function getOrgChartData(ctx: AuthContext) {
  assertCan(ctx, "orgchart.read");
  const [people, departments] = await Promise.all([
    db.employee.findMany({
      where: { companyId: ctx.companyId, status: { not: "TERMINATED" } },
      select: { id: true, firstName: true, lastName: true, preferredName: true, managerId: true, departmentId: true, photoPath: true, workEmail: true, position: { select: { title: true } }, department: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }],
    }),
    db.department.findMany({
      where: { companyId: ctx.companyId, isActive: true },
      select: { id: true, name: true, code: true, parentId: true, headId: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const persons: OrgChartPerson[] = people.map((p) => ({
    id: p.id,
    name: `${p.preferredName || p.firstName} ${p.lastName}`,
    title: p.position?.title ?? null,
    department: p.department?.name ?? null,
    departmentId: p.departmentId,
    managerId: p.managerId,
    photo: !!p.photoPath,
    email: p.workEmail,
  }));
  return { persons, departments };
}

// ───────────────────────────── Detail ─────────────────────────────

const detailInclude = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true, grade: true, level: true } },
  location: { select: { id: true, name: true } },
  manager: { select: { id: true, firstName: true, lastName: true, preferredName: true, position: { select: { title: true } } } },
  directReports: {
    where: { status: { not: "TERMINATED" as const } },
    select: { id: true, firstName: true, lastName: true, preferredName: true, position: { select: { title: true } } },
    orderBy: { firstName: "asc" as const },
  },
  emergencyContacts: { orderBy: { createdAt: "asc" as const } },
  user: { select: { id: true, email: true, isActive: true, lastLoginAt: true, passwordHash: true, roles: { select: { role: { select: { id: true, name: true, key: true } } } } } },
} satisfies Prisma.EmployeeInclude;

type EmployeeWithDetail = Prisma.EmployeeGetPayload<{ include: typeof detailInclude }>;

export type EmployeeDetail = Omit<EmployeeWithDetail, "user"> & {
  access: EmployeeAccess;
  canSeeSensitive: boolean;
  canEdit: boolean;
  canTerminate: boolean;
  account: { id: string; email: string; isActive: boolean; lastLoginAt: Date | null; activated: boolean; roles: { id: string; name: string; key: string }[] } | null;
};

/**
 * Load an employee for the detail page, shaped for the viewer: sensitive identifiers and bank details
 * are masked unless the viewer is the employee or holds `employee.sensitive.read` with full access.
 */
export async function getEmployeeDetail(ctx: AuthContext, id: string): Promise<EmployeeDetail> {
  const access = await getEmployeeAccess(ctx, id);
  if (access === "none") throw new ForbiddenError();
  const e = await db.employee.findFirst({ where: { id, companyId: ctx.companyId }, include: detailInclude });
  if (!e) throw new NotFoundError((await tErr())("errors.employeeNotFound"));

  const canSeeSensitive = access === "self" || (access === "all" && ctx.permissions.has("employee.sensitive.read"));
  const { user, ...rest } = e;
  const shaped: EmployeeDetail = {
    ...rest,
    access,
    canSeeSensitive,
    canEdit: access === "all" && ctx.permissions.has("employee.update"),
    canTerminate: access === "all" && ctx.permissions.has("employee.terminate") && e.status !== "TERMINATED",
    account: user
      ? {
          id: user.id,
          email: user.email,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          activated: !!user.passwordHash,
          roles: user.roles.map((r) => r.role),
        }
      : null,
  };
  if (!canSeeSensitive) {
    shaped.emiratesIdNumber = e.emiratesIdNumber ? maskEmiratesId(e.emiratesIdNumber) : null;
    shaped.passportNumber = e.passportNumber ? maskTail(e.passportNumber, 3) : null;
    shaped.visaNumber = e.visaNumber ? maskTail(e.visaNumber, 3) : null;
    shaped.labourCardNumber = e.labourCardNumber ? maskTail(e.labourCardNumber, 3) : null;
    shaped.iban = e.iban ? maskIban(e.iban) : null;
    shaped.bankAccountName = null;
    // Team managers don't need personal details of reports.
    if (access === "team") {
      shaped.dateOfBirth = null;
      shaped.personalEmail = null;
      shaped.address = null;
      shaped.maritalStatus = null;
      shaped.emergencyContacts = [];
    }
  }
  return shaped;
}

/** Raw record for edit forms (HR only). */
export async function getEmployeeForEdit(ctx: AuthContext, id: string) {
  assertCan(ctx, "employee.update");
  if ((await getEmployeeAccess(ctx, id)) !== "all") throw new ForbiddenError();
  const e = await db.employee.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!e) throw new NotFoundError((await tErr())("errors.employeeNotFound"));
  return e;
}

/** Management chain (manager, manager's manager …) for breadcrumbs. */
export async function getReportingChain(ctx: AuthContext, id: string) {
  const chain: { id: string; name: string; title: string | null }[] = [];
  let current = await db.employee.findFirst({ where: { id, companyId: ctx.companyId }, select: { managerId: true } });
  const seen = new Set<string>([id]);
  while (current?.managerId && !seen.has(current.managerId) && chain.length < 20) {
    seen.add(current.managerId);
    const m = await db.employee.findFirst({
      where: { id: current.managerId, companyId: ctx.companyId },
      select: { id: true, firstName: true, lastName: true, preferredName: true, managerId: true, position: { select: { title: true } } },
    });
    if (!m) break;
    chain.push({ id: m.id, name: `${m.preferredName || m.firstName} ${m.lastName}`, title: m.position?.title ?? null });
    current = m;
  }
  return chain;
}

// ───────────────────────────── Create / update ─────────────────────────────

async function assertReferences(tx: DbClient, companyId: string, input: { departmentId: string | null; positionId: string | null; locationId: string | null; managerId: string | null }) {
  const checks = await Promise.all([
    input.departmentId ? tx.department.count({ where: { id: input.departmentId, companyId } }) : 1,
    input.positionId ? tx.position.count({ where: { id: input.positionId, companyId } }) : 1,
    input.locationId ? tx.location.count({ where: { id: input.locationId, companyId } }) : 1,
    input.managerId ? tx.employee.count({ where: { id: input.managerId, companyId, status: { not: "TERMINATED" } } }) : 1,
  ]);
  const fieldErrors: Record<string, string[]> = {};
  const t = await tErr();
  if (!checks[0]) fieldErrors.departmentId = [t("errors.unknownDepartment")];
  if (!checks[1]) fieldErrors.positionId = [t("errors.unknownPosition")];
  if (!checks[2]) fieldErrors.locationId = [t("errors.unknownLocation")];
  if (!checks[3]) fieldErrors.managerId = [t("errors.managerInactive")];
  if (Object.keys(fieldErrors).length) throw new ValidationError(t("errors.correctFields"), fieldErrors);
}

/** Atomically reserve the next employee number (skipping any taken manually). */
export async function nextEmployeeNumber(tx: DbClient, companyId: string): Promise<string> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const company = await tx.company.update({
      where: { id: companyId },
      data: { employeeNumberNextSeq: { increment: 1 } },
      select: { employeeNumberPrefix: true, employeeNumberPadding: true, employeeNumberNextSeq: true },
    });
    const candidate = formatEmployeeNumber(company.employeeNumberPrefix, company.employeeNumberNextSeq - 1, company.employeeNumberPadding);
    const taken = await tx.employee.count({ where: { companyId, employeeNumber: candidate } });
    if (!taken) return candidate;
  }
  throw new ConflictError((await tErr())("errors.numberAllocation"));
}

/** Give the manager role to anyone who now has direct reports. */
async function ensureManagerRole(tx: DbClient, ctx: { companyId: string; userId: string | null }, managerEmployeeId: string | null) {
  if (!managerEmployeeId) return;
  const manager = await tx.employee.findUnique({ where: { id: managerEmployeeId }, select: { userId: true } });
  if (!manager?.userId) return;
  const role = await tx.role.findUnique({ where: { companyId_key: { companyId: ctx.companyId, key: SYSTEM_ROLES.MANAGER } } });
  if (!role) return;
  const existing = await tx.userRole.findUnique({ where: { userId_roleId: { userId: manager.userId, roleId: role.id } } });
  if (existing) return;
  await tx.userRole.create({ data: { userId: manager.userId, roleId: role.id } });
  await writeAudit(ctx, { action: "user.role.auto_grant", entityType: "User", entityId: manager.userId, summary: "Granted Manager role (has direct reports)", after: { role: role.key } }, tx);
}

function employeeData(input: Omit<EmployeeCreateInput, "employeeNumber" | "sendInvite"> | Omit<EmployeeUpdateInput, "id">) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    preferredName: input.preferredName,
    workEmail: input.workEmail,
    personalEmail: input.personalEmail,
    phone: input.phone,
    dateOfBirth: input.dateOfBirth,
    gender: input.gender,
    nationality: input.nationality,
    maritalStatus: input.maritalStatus,
    address: input.address,
    joinDate: input.joinDate,
    probationEndDate: input.probationEndDate,
    employmentType: input.employmentType,
    departmentId: input.departmentId,
    positionId: input.positionId,
    managerId: input.managerId,
    locationId: input.locationId,
    emiratesIdNumber: input.emiratesIdNumber,
    emiratesIdExpiry: input.emiratesIdExpiry,
    passportNumber: input.passportNumber,
    passportExpiry: input.passportExpiry,
    visaNumber: input.visaNumber,
    visaExpiry: input.visaExpiry,
    labourCardNumber: input.labourCardNumber,
    labourCardExpiry: input.labourCardExpiry,
    bankName: input.bankName,
    iban: input.iban,
    bankAccountName: input.bankAccountName,
    bankRoutingCode: input.bankRoutingCode,
  };
}

/**
 * Create an employee and their (not yet activated) login account with the Employee role.
 * Used by the form and by the CSV importer (pass a transaction client to batch).
 */
export async function createEmployee(ctx: AuthContext, input: EmployeeCreateInput, tx?: DbClient) {
  assertCan(ctx, "employee.create");
  const run = async (client: DbClient) => {
    await assertReferences(client, ctx.companyId, input);
    const emailTaken = await client.user.findUnique({ where: { email: input.workEmail } });
    const employeeEmailTaken = await client.employee.count({ where: { companyId: ctx.companyId, workEmail: input.workEmail } });
    if (emailTaken || employeeEmailTaken) {
      const t = await tErr();
      throw new ValidationError(t("errors.emailInUse"), { workEmail: [t("errors.emailInUseField")] });
    }

    let employeeNumber = input.employeeNumber;
    if (employeeNumber) {
      const taken = await client.employee.count({ where: { companyId: ctx.companyId, employeeNumber } });
      if (taken) {
        const t = await tErr();
        throw new ValidationError(t("errors.numberInUse"), { employeeNumber: [t("errors.alreadyInUse")] });
      }
    } else {
      employeeNumber = await nextEmployeeNumber(client, ctx.companyId);
    }

    const employeeRole = await client.role.findUnique({ where: { companyId_key: { companyId: ctx.companyId, key: SYSTEM_ROLES.EMPLOYEE } } });
    const user = await client.user.create({
      data: {
        companyId: ctx.companyId,
        email: input.workEmail,
        name: `${input.preferredName || input.firstName} ${input.lastName}`,
        roles: employeeRole ? { create: [{ roleId: employeeRole.id }] } : undefined,
      },
    });
    const employee = await client.employee.create({
      data: { companyId: ctx.companyId, employeeNumber, userId: user.id, ...employeeData(input) },
    });
    await ensureManagerRole(client, ctx, employee.managerId);
    await writeAudit(ctx, { action: "employee.create", entityType: "Employee", entityId: employee.id, summary: `Created ${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`, after: employee }, client);
    return { employee, userId: user.id };
  };
  const result = tx ? await run(tx) : await db.$transaction(run);
  if (input.sendInvite && !tx) await sendInvite(ctx, result.userId);
  return result.employee;
}

export async function updateEmployee(ctx: AuthContext, input: EmployeeUpdateInput) {
  assertCan(ctx, "employee.update");
  if ((await getEmployeeAccess(ctx, input.id)) !== "all") throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    const before = await tx.employee.findFirst({ where: { id: input.id, companyId: ctx.companyId } });
    if (!before) throw new NotFoundError((await tErr())("errors.employeeNotFound"));
    await assertReferences(tx, ctx.companyId, input);
    if (await createsManagerCycle(tx, ctx.companyId, input.id, input.managerId)) {
      const t = await tErr();
      throw new ValidationError(t("errors.invalidReportingLine"), { managerId: [t("errors.reportingLoop")] });
    }
    if (input.workEmail !== before.workEmail) {
      const conflict =
        (await tx.employee.count({ where: { companyId: ctx.companyId, workEmail: input.workEmail, id: { not: input.id } } })) ||
        (await tx.user.count({ where: { email: input.workEmail, ...(before.userId && { id: { not: before.userId } }) } }));
      if (conflict) {
      const t = await tErr();
      throw new ValidationError(t("errors.emailInUse"), { workEmail: [t("errors.emailInUseField")] });
    }
    }
    const after = await tx.employee.update({ where: { id: input.id }, data: employeeData(input) });
    if (before.userId) {
      await tx.user.update({
        where: { id: before.userId },
        data: { email: after.workEmail, name: `${after.preferredName || after.firstName} ${after.lastName}` },
      });
    }
    await ensureManagerRole(tx, ctx, after.managerId);
    const diff = diffSnapshots(before, after);
    if (diff.keys.length) {
      await writeAudit(ctx, { action: "employee.update", entityType: "Employee", entityId: after.id, summary: `Updated ${diff.keys.join(", ")}`, before: diff.before, after: diff.after }, tx);
    }
    return after;
  });
}

// ───────────────────────────── Termination ─────────────────────────────

export async function terminateEmployee(
  ctx: AuthContext,
  input: { id: string; lastWorkingDay: Date; reason: string; notes: string | null },
) {
  assertCan(ctx, "employee.terminate");
  if (input.id === ctx.employeeId) throw new ValidationError((await tErr())("errors.cannotTerminateSelf"));
  if ((await getEmployeeAccess(ctx, input.id)) !== "all") throw new ForbiddenError();
  const result = await db.$transaction(async (tx) => {
    const before = await tx.employee.findFirst({ where: { id: input.id, companyId: ctx.companyId } });
    if (!before) throw new NotFoundError((await tErr())("errors.employeeNotFound"));
    if (before.status === "TERMINATED") throw new ValidationError((await tErr())("errors.alreadyTerminated"));
    if (input.lastWorkingDay < before.joinDate) {
      const t = await tErr();
      throw new ValidationError(t("errors.invalidDate"), { lastWorkingDay: [t("errors.onOrAfterJoinDate")] });
    }
    const today = todayInTimeZone(ctx.timezone);
    const effectiveNow = input.lastWorkingDay < today;
    const after = await tx.employee.update({
      where: { id: input.id },
      data: {
        lastWorkingDay: input.lastWorkingDay,
        terminationReason: input.reason,
        terminationNotes: input.notes,
        terminatedAt: new Date(),
        terminatedById: ctx.userId,
        ...(effectiveNow && { status: "TERMINATED" }),
      },
    });
    if (effectiveNow && before.userId) {
      await tx.user.update({ where: { id: before.userId }, data: { isActive: false, sessionVersion: { increment: 1 } } });
    }
    const diff = diffSnapshots(before, after);
    await writeAudit(ctx, { action: "employee.terminate", entityType: "Employee", entityId: after.id, summary: `Termination (${input.reason}), last working day ${input.lastWorkingDay.toISOString().slice(0, 10)}`, before: diff.before, after: diff.after }, tx);
    return after;
  });
  return result;
}

/** Undo a scheduled (not yet effective) termination. */
export async function cancelTermination(ctx: AuthContext, id: string) {
  assertCan(ctx, "employee.terminate");
  if ((await getEmployeeAccess(ctx, id)) !== "all") throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    const before = await tx.employee.findFirst({ where: { id, companyId: ctx.companyId } });
    if (!before) throw new NotFoundError((await tErr())("errors.employeeNotFound"));
    if (before.status === "TERMINATED" || !before.lastWorkingDay) throw new ValidationError((await tErr())("errors.noScheduledTermination"));
    const after = await tx.employee.update({
      where: { id },
      data: { lastWorkingDay: null, terminationReason: null, terminationNotes: null, terminatedAt: null, terminatedById: null },
    });
    const diff = diffSnapshots(before, after);
    await writeAudit(ctx, { action: "employee.termination_cancel", entityType: "Employee", entityId: id, summary: "Cancelled scheduled termination", before: diff.before, after: diff.after }, tx);
    return after;
  });
}

// ───────────────────────────── Self-service ─────────────────────────────

export async function updateOwnProfile(
  ctx: AuthContext,
  input: { preferredName: string | null; personalEmail: string | null; phone: string | null; address: string | null; maritalStatus: string | null },
) {
  if (!ctx.employeeId) throw new ValidationError((await tErr())("errors.accountNotLinked"));
  return db.$transaction(async (tx) => {
    const before = await tx.employee.findUniqueOrThrow({ where: { id: ctx.employeeId! } });
    const after = await tx.employee.update({ where: { id: ctx.employeeId! }, data: input });
    if (before.userId) await tx.user.update({ where: { id: before.userId }, data: { name: `${after.preferredName || after.firstName} ${after.lastName}` } });
    const diff = diffSnapshots(before, after);
    if (diff.keys.length) await writeAudit(ctx, { action: "employee.self_update", entityType: "Employee", entityId: after.id, summary: `Updated own ${diff.keys.join(", ")}`, before: diff.before, after: diff.after }, tx);
    return after;
  });
}

/** Self (own record) or HR (employee.update) may maintain emergency contacts. */
async function assertCanManageContacts(ctx: AuthContext, employeeId: string) {
  if (employeeId === ctx.employeeId) return;
  assertCan(ctx, "employee.update");
  if ((await getEmployeeAccess(ctx, employeeId)) !== "all") throw new ForbiddenError();
}

export async function upsertEmergencyContact(
  ctx: AuthContext,
  input: { id: string | null; employeeId: string; name: string; relationship: string; phone: string; email: string | null },
) {
  await assertCanManageContacts(ctx, input.employeeId);
  const employee = await db.employee.findFirst({ where: { id: input.employeeId, companyId: ctx.companyId }, select: { id: true } });
  if (!employee) throw new NotFoundError((await tErr())("errors.employeeNotFound"));
  const data = { name: input.name, relationship: input.relationship, phone: input.phone, email: input.email };
  return db.$transaction(async (tx) => {
    if (input.id) {
      const before = await tx.emergencyContact.findFirst({ where: { id: input.id, employeeId: input.employeeId } });
      if (!before) throw new NotFoundError((await tErr())("errors.contactNotFound"));
      const after = await tx.emergencyContact.update({ where: { id: input.id }, data });
      await writeAudit(ctx, { action: "emergency_contact.update", entityType: "Employee", entityId: input.employeeId, before, after }, tx);
      return after;
    }
    const count = await tx.emergencyContact.count({ where: { employeeId: input.employeeId } });
    if (count >= 5) throw new ValidationError((await tErr())("errors.maxContacts", { max: 5 }));
    const after = await tx.emergencyContact.create({ data: { ...data, employeeId: input.employeeId, companyId: ctx.companyId } });
    await writeAudit(ctx, { action: "emergency_contact.create", entityType: "Employee", entityId: input.employeeId, after }, tx);
    return after;
  });
}

export async function deleteEmergencyContact(ctx: AuthContext, contactId: string) {
  const contact = await db.emergencyContact.findFirst({ where: { id: contactId, companyId: ctx.companyId } });
  if (!contact) throw new NotFoundError((await tErr())("errors.contactNotFound"));
  await assertCanManageContacts(ctx, contact.employeeId);
  await db.$transaction(async (tx) => {
    await tx.emergencyContact.delete({ where: { id: contactId } });
    await writeAudit(ctx, { action: "emergency_contact.delete", entityType: "Employee", entityId: contact.employeeId, before: contact }, tx);
  });
}

export async function setEmployeePhoto(ctx: AuthContext, employeeId: string, photoPath: string | null) {
  if (employeeId !== ctx.employeeId) {
    assertCan(ctx, "employee.update");
    if ((await getEmployeeAccess(ctx, employeeId)) !== "all") throw new ForbiddenError();
  }
  return db.$transaction(async (tx) => {
    const before = await tx.employee.findFirst({ where: { id: employeeId, companyId: ctx.companyId }, select: { photoPath: true } });
    if (!before) throw new NotFoundError((await tErr())("errors.employeeNotFound"));
    await tx.employee.update({ where: { id: employeeId }, data: { photoPath } });
    await writeAudit(ctx, { action: "employee.photo", entityType: "Employee", entityId: employeeId, before, after: { photoPath } }, tx);
    return before.photoPath;
  });
}

/** Options for select inputs (managers etc.). */
export async function listEmployeeOptions(ctx: AuthContext) {
  assertCan(ctx, ["employee.read.all", "employee.read.team", "org.manage"]);
  const rows = await db.employee.findMany({
    where: { companyId: ctx.companyId, status: { not: "TERMINATED" } },
    select: { id: true, firstName: true, lastName: true, preferredName: true, employeeNumber: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return rows.map((r) => ({ value: r.id, label: `${r.preferredName || r.firstName} ${r.lastName} (${r.employeeNumber})` }));
}

export function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
