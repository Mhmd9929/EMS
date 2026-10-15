import { NextResponse } from "next/server";
import { getAuthContext } from "@/server/auth/context";
import { getPayslip, payslipPdfPassword } from "@/server/services/payroll/payslip.service";
import { encryptPdf, renderPayslipPdf } from "@/server/pdf/payslip-pdf";
import { writeAudit } from "@/server/audit";

/** Payslip PDF. Visibility is decided by getPayslip (owner + released, or payslip.read.all) — anything else is a 404. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const data = await getPayslip(ctx, id).catch(() => null);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const password = await payslipPdfPassword(ctx.companyId, data.employee.id);
  const pdf = password ? await encryptPdf(await renderPayslipPdf(data), password) : await renderPayslipPdf(data);
  if (data.employee.id !== ctx.employeeId) {
    await writeAudit(ctx, { action: "payslip.download", entityType: "Payslip", entityId: data.id, summary: `Downloaded payslip ${data.number} of ${data.employee.name}` });
  }
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${data.number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
