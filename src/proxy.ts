import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC_API_PATHS = [
  "/api/auth/",
  "/api/cron/",
  "/api/gumroad/webhook",
  "/api/etsy?action=connect",
  "/api/etsy?action=callback",
  "/api/etsy?action=status",
  "/api/etsy/callback",
  "/api/etsy/webhook",
  "/api/billing?action=webhook",
  "/api/pinterest?action=connect",
  "/api/pinterest?action=callback",
];

const PUBLIC_PAGE_PATHS = ["/login", "/signup", "/pricing", "/privacy-policy"];

const SKIP_PREFIXES = ["/_next/", "/favicon", "/product-pdfs/", "/product-images/", "/sw.js"];

export const proxy = auth(async (req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (pathname.startsWith("/api/v1/")) {
    const rewritten = req.nextUrl.clone();
    rewritten.pathname = "/api/" + pathname.slice("/api/v1/".length);
    return NextResponse.rewrite(rewritten);
  }

  if (pathname.startsWith("/api/")) {
    // Match against full path+query so entries like "/api/billing?action=webhook" work correctly
    const fullPath = `${pathname}${req.nextUrl.search}`;
    if (PUBLIC_API_PATHS.some((p) => fullPath.startsWith(p) || pathname.startsWith(p))) return NextResponse.next();
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = process.env.API_SECRET_KEY;
    if (!expectedKey) return NextResponse.json({ success: false, error: "Server misconfigured" }, { status: 500 });
    if (!apiKey || apiKey !== expectedKey) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  if (PUBLIC_PAGE_PATHS.includes(pathname)) {
    if (isAuthenticated) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
