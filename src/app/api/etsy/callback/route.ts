import { NextRequest, NextResponse } from "next/server";

// Callback is now handled at /api/etsy?action=callback
// This redirect handles any stale bookmarks or cached old redirect URIs
export async function GET(req: NextRequest) {
  const { searchParams, protocol, host } = new URL(req.url);
  const params = new URLSearchParams({ action: "callback" });
  searchParams.forEach((v, k) => params.set(k, v));
  return NextResponse.redirect(`${protocol}//${host}/api/etsy?${params.toString()}`);
}
