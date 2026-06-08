import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { pinterest } from "@/lib/integrations/pinterest";
import { toSafeErrorMessage } from "@/lib/errors";
import { z } from "zod";
import crypto from "crypto";

const APP_ID = process.env.PINTEREST_APP_ID ?? "";
const APP_SECRET = process.env.PINTEREST_APP_SECRET ?? "";
const REDIRECT_URI = process.env.PINTEREST_REDIRECT_URI ?? "http://localhost:3090/api/pinterest/callback";

const SetBoardSchema = z.object({ boardId: z.string().min(1) });

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "status";

  try {
    if (action === "connect") {
      if (!APP_ID) return NextResponse.json({ success: false, error: "Pinterest app not configured" }, { status: 503 });
      const state = crypto.randomBytes(16).toString("hex");
      const url = new URL("https://www.pinterest.com/oauth/");
      url.searchParams.set("client_id", APP_ID);
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "boards:read,pins:write,user_accounts:read");
      url.searchParams.set("state", state);
      return NextResponse.redirect(url.toString());
    }

    if (action === "callback") {
      const code = searchParams.get("code");
      if (!code) return NextResponse.redirect("/publishing?pinterest=error");

      const tokenRes = await fetch("https://api.pinterest.com/v5/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }),
      });

      if (!tokenRes.ok) return NextResponse.redirect("/publishing?pinterest=error");

      const tokens = await tokenRes.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      const account = await pinterest.getAccount(tokens.access_token);
      const tokenExpiry = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;

      const boards = await pinterest.getBoards(tokens.access_token);
      const defaultBoard = boards.items[0];

      await prisma.pinterestConnection.deleteMany({});
      await prisma.pinterestConnection.create({
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? null,
          tokenExpiry,
          pinterestUserId: account.id,
          username: account.username,
          boardId: process.env.PINTEREST_BOARD_ID ?? defaultBoard?.id ?? "",
        },
      });

      return NextResponse.redirect("/publishing?pinterest=connected");
    }

    if (action === "status") {
      const conn = await prisma.pinterestConnection.findFirst();
      if (!conn) return NextResponse.json({ success: true, data: { connected: false } });
      return NextResponse.json({
        success: true,
        data: {
          connected: true,
          username: conn.username,
          boardId: conn.boardId,
          tokenExpiry: conn.tokenExpiry,
        },
      });
    }

    if (action === "boards") {
      const conn = await prisma.pinterestConnection.findFirst();
      if (!conn) return NextResponse.json({ success: false, error: "Pinterest not connected" }, { status: 400 });
      const boards = await pinterest.getBoards(conn.accessToken);
      return NextResponse.json({ success: true, data: boards.items });
    }

    if (action === "disconnect") {
      await prisma.pinterestConnection.deleteMany({});
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const body = await req.json() as unknown;

    if (action === "set-board") {
      const { boardId } = SetBoardSchema.parse(body);
      const conn = await prisma.pinterestConnection.findFirst();
      if (!conn) return NextResponse.json({ success: false, error: "Pinterest not connected" }, { status: 400 });
      await prisma.pinterestConnection.update({ where: { id: conn.id }, data: { boardId } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request", details: error.issues }, { status: 400 });
    }
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
