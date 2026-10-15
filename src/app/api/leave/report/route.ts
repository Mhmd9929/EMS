import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth/context";
import { leaveTakenDetail, leaveTakenReport } from "@/server/services/leave/report.service";
import { writeAudit } from "@/server/audit";
import { ForbiddenError } from "@/server/errors";
import { csvResponse, xlsxResponse, type Sheet } from "@/server/export";
import { parseDateOnly, todayInTimeZone, toDateInput } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const year = todayInTimeZone(ctx.timezone).getUTCFullYear();
  const filters = {
    from: parseDateOnly(sp.get("from")) ?? new Date(Date.UTC(year, 0, 1)),
    to: parseDateOnly(sp.get("to")) ?? new Date(Date.UTC(year, 11, 31)),
    departmentId: sp.get("department") || undefined,
    leaveTypeId: sp.get("type") || undefined,
  };
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";
  const name = `leave-${sp.get("kind") === "summary" ? "summary" : "detail"}-${toDateInput(filters.from)}-to-${toDateInput(filters.to)}`;
  try {
    let sheet: Sheet;
    if (sp.get("kind") === "summary") {
      const r = await leaveTakenReport(ctx, filters);
      sheet = {
        name: "Summary",
        columns: [
          { header: "Department", key: "department", width: 22 },
          { header: "Leave type", key: "leaveType", width: 20 },
          { header: "Paid", key: "paid" },
          { header: "Days", key: "days", numFmt: "0.00" },
          { header: "Employees", key: "people" },
          { header: "Requests", key: "requests" },
        ],
        rows: r.rows.map((x) => ({ ...x, paid: x.isPaid ? "Yes" : "No" })),
      };
    } else {
      const rows = await leaveTakenDetail(ctx, filters);
      sheet = {
        name: "Detail",
        columns: [
          { header: "Employee no.", key: "employeeNumber" },
          { header: "Name", key: "name", width: 26 },
          { header: "Department", key: "department", width: 20 },
          { header: "Leave type", key: "leaveType", width: 18 },
          { header: "Paid", key: "paid" },
          { header: "From", key: "from" },
          { header: "To", key: "to" },
          { header: "Days in period", key: "days", numFmt: "0.00" },
          { header: "Status", key: "status" },
        ],
        rows: rows.map((r) => ({ ...r, department: r.department ?? "", paid: r.isPaid ? "Yes" : "No", from: toDateInput(r.startDate), to: toDateInput(r.endDate) })),
      };
    }
    await writeAudit(ctx, { action: "leave.report.export", entityType: "LeaveRequest", summary: `Exported ${name} (${format})` });
    return format === "csv" ? csvResponse(name, sheet) : xlsxResponse(name, [sheet]);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }
}
