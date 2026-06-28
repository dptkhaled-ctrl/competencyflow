import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const ADMIN_COOKIE = "cf_admin_session";

const PUBLIC_PATHS = ["/", "/login", "/contact", "/auth/callback", "/admin/login"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/invite/")) return true;
  if (pathname.startsWith("/api/invites/")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api/platform") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session = request.cookies.get(ADMIN_COOKIE);
    if (session?.value !== "authenticated") {
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("from", pathname);
      return NextResponse.redirect(login);
    }
  }

  if (
    pathname.startsWith("/api/admin") &&
    !pathname.startsWith("/api/admin/login")
  ) {
    const session = request.cookies.get(ADMIN_COOKIE);
    if (session?.value !== "authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let response = await updateSession(request);

  if (!isSupabaseConfigured()) {
    return response;
  }

  if (isPublicPath(pathname)) {
    return response;
  }

  const protectedApp =
    pathname.startsWith("/staff") ||
    pathname.startsWith("/manager") ||
    pathname.startsWith("/api/manager") ||
    pathname.startsWith("/api/tutor") ||
    pathname.startsWith("/api/chat") ||
    pathname === "/api/platform/progress";

  if (!protectedApp) {
    return response;
  }

  const hasSupabaseSession = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));

  if (!hasSupabaseSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/staff/:path*",
    "/manager/:path*",
    "/login",
    "/contact",
    "/invite/:path*",
    "/api/invites/:path*",
    "/api/auth/:path*",
    "/api/manager/:path*",
    "/api/tutor/:path*",
    "/api/chat",
    "/api/platform/progress",
  ],
};