import "server-only";
import { headers } from "next/headers";

/** Best-effort client IP and user agent for the current request (audit + rate limiting). */
export async function getRequestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded || h.get("x-real-ip") || null;
    return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
  } catch {
    // Outside a request (jobs, seed, tests)
    return { ip: null, userAgent: null };
  }
}
