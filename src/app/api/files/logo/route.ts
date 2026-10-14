import { NextResponse } from "next/server";
import { getAuthContext } from "@/server/auth/context";
import { db } from "@/server/db";
import { storage } from "@/server/storage";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const company = await db.company.findUnique({ where: { id: ctx.companyId }, select: { logoPath: true } });
  const file = company?.logoPath ? await storage.get(company.logoPath) : null;
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}
