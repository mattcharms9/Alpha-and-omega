import { createHmac } from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "fallback-dev-secret";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function generateEmailActionToken(cardId: string): string {
  const expiry = Date.now() + TTL_MS;
  const payload = `${cardId}:${expiry}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyEmailActionToken(token: string, cardId: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;
    const [tokenCardId, expiryStr, sig] = parts as [string, string, string];
    if (tokenCardId !== cardId) return false;
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) return false;
    const payload = `${tokenCardId}:${expiryStr}`;
    const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
    return sig === expected;
  } catch {
    return false;
  }
}
