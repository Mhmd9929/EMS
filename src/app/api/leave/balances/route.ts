import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth/context";
import { exportBalances } from "@/server/services/leave/balance.service";
import { writeAudit } from "@/server/audit";
import { ForbiddenError } from "@/server/errors";
import { csvResponse, xlsxResponse, type Sheet } from "@/server/export";
import { todayInTimeZone } from "@/lib/dates";
import { serverT } from "@/server/i18n";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const year = Number(req.nextUrl.searchParams.get("year")) || todayInTimeZone(ctx.timezone).getUTCFullYear();
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const t = await serverT("leave");
  try {
    const { employees, types, balances } = await exportBalances(ctx, year);
    const tracked = types.filter((t) => t.accrualMethod !== "NONE");
    const sheet: Sheet = {
      name: t("export.sheetBalances", { year: String(year) }),
      columns: [
        { header: t("export.employeeNumber"), key: "number" },
        { header: t("export.name"), key: "name", width: 26 },
        { header: t("export.department"), key: "department", width: 20 },
        { header: t("export.leaveType"), key: "type", width: 18 },
        { header: t("export.entitled"), key: "entitled", numFmt: "0.00" },
        { header: t("export.accrued"), key: "accrued", numFmt: "0.00" },
        { header: t("export.carriedForward"), key: "cf", numFmt: "0.00" },
        { header: t("export.adjustments"), key: "adj", numFmt: "0.00" },
        { header: t("export.expired"), key: "expired", numFmt: "0.00" },
        { header: t("export.taken"), key: "taken", numFmt: "0.00" },
        { header: t("export.pending"), key: "pending", numFmt: "0.00" },
        { header: t("export.available"), key: "available", numFmt: "0.00" },
      ],
      rows: employees.flatMap((e) =>
        balances
          .get(e.id)!
          .filter((b) => b.eligible && tracked.some((t) => t.id === b.leaveType.id))
          .map((b) => ({
            number: e.employeeNumber,
            name: `${e.firstName} ${e.lastName}`,
            department: e.department?.name ?? "",
            type: b.leaveType.name,
            entitled: b.entitled,
            accrued: b.accrued,
            cf: b.carriedForward,
            adj: b.adjustments,
            expired: b.expired,
            taken: b.taken,
            pending: b.pending,
            available: b.available,
          })),
      ),
    };
    await writeAudit(ctx, { action: "leave.balances.export", entityType: "LeaveBalance", summary: `Exported ${year} balances (${format})` });
    return format === "csv" ? csvResponse(`leave-balances-${year}`, sheet) : xlsxResponse(`leave-balances-${year}`, [sheet]);
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }
}
