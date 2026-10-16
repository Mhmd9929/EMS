import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth/context";
import { exportBankCsv, exportRegister, exportSif } from "@/server/services/payroll/export.service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { csvResponse, xlsxResponse } from "@/server/export";
import { serverT } from "@/server/i18n";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const type = req.nextUrl.searchParams.get("type");
  try {
    if (type === "register") {
      const { period, sheets } = await exportRegister(ctx, id);
      return xlsxResponse(`payroll-register-${period}`, sheets);
    }
    if (type === "bank") {
      const sheet = await exportBankCsv(ctx, id);
      return csvResponse(`bank-transfer-${sheet.period}`, sheet);
    }
    if (type === "sif") {
      const sif = await exportSif(ctx, id);
      // Problems (missing routing code, labour card …) are shown instead of producing a file the bank would reject.
      if (sif.errors.length && req.nextUrl.searchParams.get("force") !== "1") {
        const t = await serverT("payroll");
        const problems = sif.problems.map((p) => t(`sif.${p.code}`, { employee: p.employee ?? "" }));
        const body = `${t("export.sifBlocked", { count: sif.problems.length })}\n\n${problems.map((e) => `- ${e}`).join("\n")}\n\n${t("export.sifHint")}`;
        return new NextResponse(body, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
      }
      return new NextResponse(sif.content, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${sif.fileName}"`, "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (e instanceof ValidationError) return new NextResponse(e.message, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    throw e;
  }
}
