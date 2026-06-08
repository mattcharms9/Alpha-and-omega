import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_API_PATHS = [
  "/api/auth/",
  "/api/cron/",
  "/api/gumroad/webhook",
  "/api/etsy/callback",
  "/api/etsy/webhook",
  "/api/billing?action=webhook",
  "/api/pinterest?action=callback",
  "/api/pinterest?action=connect",
];

// Pages that don't require a session
const PUBLIC_PAGE_PATHS = ["/login", "/signup", "/pricing"];

// Pages the middleware handles (exclude Next.js internals)
const SKIP_PREFIXES = ["/_next/", "/favicon", "/product-pdfs/", "/product-images/", "/sw.js"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static assets and Next.js internals
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Rewrite /api/v1/* → /api/*
  if (pathname.startsWith("/api/v1/")) {
    const rewritten = req.nextUrl.clone();
    rewritten.pathname = "/api/" + pathname.slice("/api/v1/".length);
    return NextResponse.rewrite(rewritten);
  }

  // ── API auth (x-api-key) ──────────────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

    const apiKey = req.headers.get("x-api-key");
    const expectedKey = process.env.API_SECRET_KEY;

    if (!expectedKey) {
      return NextResponse.json({ success: false, error: "Server misconfigured" }, { status: 500 });
    }
    if (!apiKey || apiKey !== expectedKey) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── Page auth (JWT session) ───────────────────────────────────────────────
  // Auth required for all pages except the public ones
  if (PUBLIC_PAGE_PATHS.includes(pathname)) {
    // Redirect already-signed-in users away from auth pages
    const token = await getToken({ req, secret: process.env.AUTH_SECRET });
    if (token) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // All other pages require a session
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
