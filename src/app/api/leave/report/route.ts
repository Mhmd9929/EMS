import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth/context";
import { leaveTakenDetail, leaveTakenReport } from "@/server/services/leave/report.service";
import { writeAudit } from "@/server/audit";
import { ForbiddenError } from "@/server/errors";
import { csvResponse, xlsxResponse, type Sheet } from "@/server/export";
import { parseDateOnly, todayInTimeZone, toDateInput } from "@/lib/dates";
import { serverT } from "@/server/i18n";

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
  const t = await serverT("leave");
  try {
    let sheet: Sheet;
    if (sp.get("kind") === "summary") {
      const r = await leaveTakenReport(ctx, filters);
      sheet = {
        name: t("export.sheetSummary"),
        columns: [
          { header: t("export.department"), key: "department", width: 22 },
          { header: t("export.leaveType"), key: "leaveType", width: 20 },
          { header: t("export.paid"), key: "paid" },
          { header: t("export.days"), key: "days", numFmt: "0.00" },
          { header: t("export.employees"), key: "people" },
          { header: t("export.requests"), key: "requests" },
        ],
        rows: r.rows.map((x) => ({ ...x, paid: x.isPaid ? t("export.yes") : t("export.no") })),
      };
    } else {
      const rows = await leaveTakenDetail(ctx, filters);
      sheet = {
        name: t("export.sheetDetail"),
        columns: [
          { header: t("export.employeeNumber"), key: "employeeNumber" },
          { header: t("export.name"), key: "name", width: 26 },
          { header: t("export.department"), key: "department", width: 20 },
          { header: t("export.leaveType"), key: "leaveType", width: 18 },
          { header: t("export.paid"), key: "paid" },
          { header: t("export.from"), key: "from" },
          { header: t("export.to"), key: "to" },
          { header: t("export.daysInPeriod"), key: "days", numFmt: "0.00" },
          { header: t("export.status"), key: "status" },
        ],
        rows: rows.map((r) => ({ ...r, department: r.department ?? "", paid: r.isPaid ? t("export.yes") : t("export.no"), from: toDateInput(r.startDate), to: toDateInput(r.endDate) })),
      };
    }
    await writeAudit(ctx, { action: "leave.report.export", entityType: "LeaveRequest", summary: `Exported ${name} (${format})` });
    return format === "csv" ? csvResponse(name, sheet) : xlsxResponse(name, [sheet]);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }
}
