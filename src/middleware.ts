import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/server/auth/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/invite"];

/**
 * Coarse gate: unauthenticated requests are sent to /login. Fine-grained checks (revoked sessions,
 * permissions, termination) happen server-side in getAuthContext() on every page and action.
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (req.auth?.user) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL("/login", req.nextUrl.origin);
  if (pathname !== "/" && pathname !== "/dashboard") url.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|robots.txt|brand/).*)"],
};
