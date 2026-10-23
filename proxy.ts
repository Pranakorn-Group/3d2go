import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/session";

// Optimistic check that a signed session exists; pages and actions verify the ADMIN role with requireAdmin().
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = pathname === "/backstore/login";

  if (!session && !isLogin) return NextResponse.redirect(new URL("/backstore/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/backstore", "/backstore/:path*"],
};
