import { NextResponse } from "next/server";
import { getAuthContext } from "@/server/auth/context";
import { getLeaveRequest } from "@/server/services/leave/request.service";
import { storage } from "@/server/storage";

/** Leave attachments: visible to whoever may view the request (employee, approvers, HR). */
export async function GET(_req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { requestId } = await params;
  const data = await getLeaveRequest(ctx, requestId).catch(() => null);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const file = data.request.attachmentPath ? await storage.get(data.request.attachmentPath) : null;
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename="leave-attachment.${data.request.attachmentPath!.split(".").pop()}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; object-src 'self'",
    },
  });
}
