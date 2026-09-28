import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth check (Next.js 16 Proxy, formerly Middleware).
 * Only looks for the session cookie so signed-out visitors are bounced
 * quickly; the real verification happens server-side in `requireUser()`.
 */
const PUBLIC = ["/login", "/showcase", "/api/health"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authEnabled = Boolean(process.env.OWNER_PASSWORD);
  if (!authEnabled || PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return withSecurityHeaders(NextResponse.next());
  }
  if (!req.cookies.has("aios_session")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return withSecurityHeaders(NextResponse.next());
}

function withSecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
