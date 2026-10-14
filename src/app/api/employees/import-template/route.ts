import { NextResponse } from "next/server";
import { getAuthContext } from "@/server/auth/context";
import { importTemplateCsv } from "@/lib/import/employee-csv";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.permissions.has("employee.import")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return new NextResponse(importTemplateCsv(), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="employee-import-template.csv"' },
  });
}
