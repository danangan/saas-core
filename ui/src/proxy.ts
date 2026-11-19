import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, USER_SESSION_COOKIE } from "@saas-core/shared";

/** Signed-in user pages; everything else is public. */
const USER_PAGES = ["/home", "/settings", "/team", "/company"];

/**
 * Optimistic check only: sends visitors without a session cookie to the right login
 * page. Sessions are validated by the backend on every request, never here.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login" || request.cookies.has(ADMIN_SESSION_COOKIE)) return NextResponse.next();
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (USER_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !request.cookies.has(USER_SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/home/:path*", "/settings/:path*", "/team/:path*", "/company/:path*"],
};
