const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

const CLIENT_TIMEOUT_MS = 60_000;

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { "Content-Type": "application/json", "x-api-key": API_KEY, ...extra };
}

export async function apiFetch(
  url: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = CLIENT_TIMEOUT_MS, ...fetchOptions } = options ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        ...authHeaders(),
        ...(fetchOptions.headers as Record<string, string> | undefined),
      },
    });
    return res;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out — the AI is taking longer than expected. Please try again.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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
