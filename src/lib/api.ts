const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { "Content-Type": "application/json", "x-api-key": API_KEY, ...extra };
}

export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  return res.json() as Promise<T>;
}
