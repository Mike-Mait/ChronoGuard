import crypto from "crypto";
import { resetTokenSigningKey } from "../config/env";

// Self-contained HMAC tokens for password-less email-verification flows
// (key reset, subscription management). No DB table needed — expiry is
// baked into the signed payload, and for reset tokens, rotation naturally
// invalidates the old key on the receiving side.
//
// Format: base64url(payload).base64url(hmac)
// Payload (current): { email, iat, exp, purpose: "reset" | "billing" }
// Payload (legacy):  { email, iat, exp }                    — treated as "reset"
//
// The purpose field prevents cross-flow reuse — a billing-portal token
// cannot be replayed at /api/keys/reset-confirm and vice versa, even
// though they share the same HMAC signing key. Legacy reset tokens
// issued before this field existed (still possibly in-flight in user
// inboxes at deploy time) are accepted for reset only.

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export type TokenPurpose = "reset" | "billing";

interface TokenPayload {
  email: string;
  iat: number; // issued-at, ms since epoch
  exp: number; // expires-at, ms since epoch
  purpose?: TokenPurpose; // optional for backward compat with legacy reset tokens
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

function createToken(email: string, purpose: TokenPurpose): string {
  const now = Date.now();
  const payload: TokenPayload = {
    email,
    iat: now,
    exp: now + TOKEN_TTL_MS,
    purpose,
  };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function createResetToken(email: string): string {
  return createToken(email, "reset");
}

export function createBillingToken(email: string): string {
  return createToken(email, "billing");
}

export interface VerifyResult {
  ok: boolean;
  email?: string;
  reason?: "malformed" | "bad_signature" | "expired" | "wrong_purpose";
}

function verifyToken(token: string, expectedPurpose: TokenPurpose): VerifyResult {
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

  // Purpose gate: legacy reset tokens (no purpose field) are accepted for
  // reset verification only — that matches the pre-purpose behavior. Any
  // other flow (billing) requires an explicit matching purpose, so a reset
  // token cannot be replayed at the billing endpoint even if it leaks.
  const tokenPurpose: TokenPurpose = payload.purpose ?? "reset";
  if (tokenPurpose !== expectedPurpose) {
    return { ok: false, reason: "wrong_purpose" };
  }

  return { ok: true, email: payload.email };
}

export function verifyResetToken(token: string): VerifyResult {
  return verifyToken(token, "reset");
}

export function verifyBillingToken(token: string): VerifyResult {
  return verifyToken(token, "billing");
}
