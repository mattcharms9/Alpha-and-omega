// OAuth callback removed — this app uses Personal Access Token authentication.
// This file is kept as a placeholder to avoid 404s on old cached redirect URIs.
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const base = new URL(req.url).origin;
  return NextResponse.redirect(`${base}/publishing?etsy_error=${encodeURIComponent("OAuth not used — configure ETSY_API_KEY and ETSY_SHOP_ID in Vercel env vars")}`);
}
