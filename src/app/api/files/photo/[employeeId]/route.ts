import { NextResponse } from "next/server";
import { getAuthContext } from "@/server/auth/context";
import { db } from "@/server/db";
import { storage } from "@/server/storage";

/** Profile photos are visible to anyone who can see the directory (same company only). */
export async function GET(_req: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { employeeId } = await params;
  if (!ctx.permissions.has("directory.read") && employeeId !== ctx.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const employee = await db.employee.findFirst({ where: { id: employeeId, companyId: ctx.companyId }, select: { photoPath: true } });
  const file = employee?.photoPath ? await storage.get(employee.photoPath) : null;
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
