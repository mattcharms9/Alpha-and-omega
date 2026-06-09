import crypto from "crypto";

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET not set");
  return crypto.createHash("sha256").update(secret).digest();
}

export function buildOAuthState(codeVerifier: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const payload = JSON.stringify({
    codeVerifier,
    exp: Date.now() + 10 * 60 * 1000,
  });
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function extractVerifierFromState(state: string): string | null {
  try {
    const key = getKey();
    const buf = Buffer.from(state, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const payload = JSON.parse(decrypted) as { codeVerifier: string; exp: number };
    if (payload.exp < Date.now()) return null;
    return payload.codeVerifier;
  } catch {
    return null;
  }
}
