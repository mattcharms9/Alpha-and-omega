const BUFFER_BASE = "https://api.bufferapp.com/1";

export interface BufferProfile {
  id: string;
  service: string;
  service_username: string;
  avatar: string;
}

export interface BufferUpdate {
  id: string;
  status: string;
  text: string;
  scheduled_at: string | null;
  profile_id: string;
}

async function bufferRequest<T>(
  path: string,
  method: "GET" | "POST",
  params?: Record<string, string | string[]>
): Promise<T> {
  const accessToken = process.env.BUFFER_ACCESS_TOKEN;
  if (!accessToken) throw new Error("BUFFER_ACCESS_TOKEN not configured");

  const url = `${BUFFER_BASE}${path}`;

  let fetchInit: RequestInit;
  if (method === "GET") {
    const qs = params
      ? "?" + new URLSearchParams(params as Record<string, string>).toString()
      : "";
    fetchInit = {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    };
    const res = await fetch(`${url}${qs}`, fetchInit);
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error((data.message as string | undefined) ?? "Buffer API error");
    return data as T;
  }

  const body = new URLSearchParams();
  body.set("access_token", accessToken);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) {
        v.forEach((item, i) => body.set(`${k}[${i}]`, item));
      } else {
        body.set(k, v);
      }
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok && !data.success) throw new Error((data.message as string | undefined) ?? "Buffer API error");
  return data as T;
}

export const buffer = {
  getProfiles: () =>
    bufferRequest<BufferProfile[]>("/profiles.json", "GET"),

  schedulePost: (profileIds: string[], text: string, scheduledAt: string) =>
    bufferRequest<{ success: boolean; updates: BufferUpdate[] }>("/updates/create.json", "POST", {
      "profile_ids[]": profileIds,
      text,
      scheduled_at: scheduledAt,
    }),

  schedulePostNow: (profileIds: string[], text: string) =>
    bufferRequest<{ success: boolean; updates: BufferUpdate[] }>("/updates/create.json", "POST", {
      "profile_ids[]": profileIds,
      text,
      now: "true",
    }),
};
