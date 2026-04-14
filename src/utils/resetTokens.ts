import crypto from "crypto";
import { resetTokenSigningKey } from "../config/env";

// Self-contained HMAC tokens for password-less key-reset flow.
// Format: base64url(payload).base64url(hmac)
// Payload: { email, iat, exp }
// No DB table needed — expiry is baked into the signed payload, and rotation
// naturally invalidates the old key on the receiving side.

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

interface TokenPayload {
  email: string;
  iat: number; // issued-at, ms since epoch
  exp: number; // expires-at, ms since epoch
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function sign(payloadB64: string): string {
  const mac = crypto
    .createHmac("sha256", resetTokenSigningKey)
    .update(payloadB64)
    .digest();
  return b64url(mac);
}

export function createResetToken(email: string): string {
  const now = Date.now();
  const payload: TokenPayload = {
    email,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export interface VerifyResult {
  ok: boolean;
  email?: string;
  reason?: "malformed" | "bad_signature" | "expired";
}

export function verifyResetToken(token: string): VerifyResult {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed" };
  }

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return { ok: false, reason: "malformed" };

  // Constant-time signature check
  const expected = sign(payloadB64);
  const a = fromB64url(sig);
  const b = fromB64url(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(fromB64url(payloadB64).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    typeof payload.email !== "string" ||
    typeof payload.exp !== "number" ||
    typeof payload.iat !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  if (Date.now() > payload.exp) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, email: payload.email };
}
