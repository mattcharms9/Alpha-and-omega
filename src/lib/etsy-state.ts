import { createHmac, createCipheriv, createDecipheriv, randomBytes } from "crypto";

function secret(): string {
  return process.env.AUTH_SECRET ?? "dev-etsy-oauth-fallback-secret-32x";
}

function deriveKey(): Buffer {
  return createHmac("sha256", secret()).update("etsy-pkce-aes-key").digest();
}

function encryptVerifier(verifier: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(verifier, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decryptVerifier(payload: string): string | null {
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function hmacSign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("hex").slice(0, 24);
}

/** Builds a state token that carries the PKCE verifier encrypted inside it. No cookie needed. */
export function buildOAuthState(verifier: string): string {
  const nonce = randomBytes(8).toString("hex");
  const ev = encryptVerifier(verifier);
  const sig = hmacSign(nonce + ev);
  return `${nonce}.${sig}.${ev}`;
}

/** Returns the decrypted verifier if the state is valid, or null if tampered. */
export function extractVerifierFromState(state: string): string | null {
  const first = state.indexOf(".");
  const second = state.indexOf(".", first + 1);
  if (first < 1 || second < first + 1) return null;

  const nonce = state.slice(0, first);
  const sig = state.slice(first + 1, second);
  const ev = state.slice(second + 1);

  const expected = hmacSign(nonce + ev);
  if (sig.length !== expected.length || sig !== expected) return null;

  return decryptVerifier(ev);
}
