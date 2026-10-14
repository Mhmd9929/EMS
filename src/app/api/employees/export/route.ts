import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import { getAuthContext } from "@/server/auth/context";
import { exportEmployees } from "@/server/services/employee.service";
import { writeAudit } from "@/server/audit";
import { ForbiddenError } from "@/server/errors";
import { employeeStatusSchema, employmentTypeSchema } from "@/lib/validation/employee";
import { toDateInput } from "@/lib/dates";

/** CSV export of the (filtered) employee list. Non-sensitive columns only. */
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  try {
    const rows = await exportEmployees(ctx, {
      q: sp.get("q") ?? undefined,
      status: employeeStatusSchema.safeParse(sp.get("status")).data,
      employmentType: employmentTypeSchema.safeParse(sp.get("type")).data,
      departmentId: sp.get("department") ?? undefined,
      locationId: sp.get("location") ?? undefined,
    });
    // Neutralise spreadsheet formula injection.
    const safe = (v: string | null | undefined) => (v && /^[=+\-@\t\r]/.test(v) ? `'${v}` : (v ?? ""));
    const csv = Papa.unparse(
      rows.map((r) => ({
        employeeNumber: r.employeeNumber,
        firstName: safe(r.firstName),
        lastName: safe(r.lastName),
        workEmail: safe(r.workEmail),
        phone: safe(r.phone),
        gender: r.gender ?? "",
        nationality: safe(r.nationality),
        department: safe(r.department?.name),
        position: safe(r.position?.title),
        location: safe(r.location?.name),
        manager: r.manager ? safe(`${r.manager.firstName} ${r.manager.lastName}`) : "",
        employmentType: r.employmentType,
        status: r.status,
        joinDate: toDateInput(r.joinDate),
        lastWorkingDay: toDateInput(r.lastWorkingDay),
      })),
    );
    await writeAudit(ctx, { action: "employee.export", entityType: "Employee", summary: `Exported ${rows.length} employees to CSV` });
    return new NextResponse(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="employees-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }
}
