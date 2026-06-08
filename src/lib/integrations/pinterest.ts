const PINTEREST_BASE = "https://api.pinterest.com/v5";

export interface CreatePinInput {
  boardId: string;
  title: string;
  description: string;
  altText: string;
  destinationUrl: string;
  imageUrl: string;
}

export interface PinterestPinResponse {
  id: string;
  link: string;
  title: string;
  description: string;
  board_id: string;
  media: {
    images: {
      "1200x": { url: string; width: number; height: number };
    };
  };
}

export interface PinterestPinAnalytics {
  pin_id: string;
  date_range: { start: string; end: string };
  metrics: {
    IMPRESSION: number;
    SAVE: number;
    PIN_CLICK: number;
    OUTBOUND_CLICK: number;
  };
}

export interface PinterestBoard {
  id: string;
  name: string;
  description: string;
}

export interface PinterestAccount {
  username: string;
  id: string;
}

async function pinterestRequest<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>,
  accessToken?: string
): Promise<T> {
  const token = accessToken ?? process.env.PINTEREST_ACCESS_TOKEN;
  if (!token) throw new Error("Pinterest access token not configured");

  const res = await fetch(`${PINTEREST_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Pinterest API ${res.status}: ${JSON.stringify(errorBody)}`);
  }

  return res.json() as Promise<T>;
}

function getDateString(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

// ── Token auto-refresh ────────────────────────────────────────────────────────

interface TokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function refreshPinterestToken(refreshToken: string): Promise<TokenRefreshResponse | null> {
  try {
    const res = await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.PINTEREST_APP_ID ?? "",
        client_secret: process.env.PINTEREST_APP_SECRET ?? "",
      }),
    });
    if (!res.ok) return null;
    return res.json() as Promise<TokenRefreshResponse>;
  } catch {
    return null;
  }
}

export async function getValidPinterestToken(): Promise<string> {
  const { prisma } = await import("@/lib/db/prisma");
  const connection = await prisma.pinterestConnection.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!connection) throw new Error("Pinterest not connected — connect in Settings");

  const expiresAt = connection.tokenExpiry ? new Date(connection.tokenExpiry) : null;
  const expiresWithinOneHour = expiresAt
    ? expiresAt.getTime() - Date.now() < 60 * 60 * 1000
    : false;

  if (expiresWithinOneHour && connection.refreshToken) {
    const refreshed = await refreshPinterestToken(connection.refreshToken);
    if (refreshed) {
      await prisma.pinterestConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token,
          tokenExpiry: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
      return refreshed.access_token;
    }
    // Refresh failed — create alert
    try {
      await prisma.strategicAlert.create({
        data: {
          type: "warning",
          title: "Pinterest Token Expired",
          body: "Pinterest connection needs renewal. Auto-promotion will fail until you reconnect.",
          actionLabel: "Reconnect in Settings",
          actionHref: "/settings",
        },
      });
    } catch { /* non-critical */ }
  }

  return connection.accessToken;
}

export const pinterest = {
  createPin: (input: CreatePinInput, accessToken?: string): Promise<PinterestPinResponse> =>
    pinterestRequest<PinterestPinResponse>(
      "/pins",
      "POST",
      {
        board_id: input.boardId,
        title: input.title,
        description: input.description,
        alt_text: input.altText,
        link: input.destinationUrl,
        media_source: { source_type: "image_url", url: input.imageUrl },
      },
      accessToken
    ),

  getPinAnalytics: (pinId: string, accessToken?: string): Promise<PinterestPinAnalytics> =>
    pinterestRequest<PinterestPinAnalytics>(
      `/pins/${pinId}/analytics?start_date=${getDateString(-30)}&end_date=${getDateString(0)}&metric_types=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK`,
      "GET",
      undefined,
      accessToken
    ),

  getBoards: (accessToken?: string): Promise<{ items: PinterestBoard[] }> =>
    pinterestRequest<{ items: PinterestBoard[] }>("/boards", "GET", undefined, accessToken),

  getAccount: (accessToken?: string): Promise<PinterestAccount> =>
    pinterestRequest<PinterestAccount>("/user_account", "GET", undefined, accessToken),
};
