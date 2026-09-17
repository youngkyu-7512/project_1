import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "vdl_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days (spec: "며칠" assumption)

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Constant-time compare so a shared password can't be brute-forced faster
 * via response-time differences. Low stakes at this scale, but cheap. */
export function passwordMatches(candidate: string, expected: string): boolean {
  if (!candidate || !expected) return false;
  return safeEqual(candidate, expected);
}

/** A session token is "<issuedAt>.<hmac(issuedAt)>" — self-contained, no
 * server-side session store needed for a single shared credential. */
export function createSessionToken(secret: string): string {
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${sign(issuedAt, secret)}`;
}

export function isValidSessionToken(token: string | undefined | null, secret: string): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const issuedAt = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!issuedAt || !signature || !safeEqual(sign(issuedAt, secret), signature)) return false;
  const issuedAtMs = Number(issuedAt);
  const age = Date.now() - issuedAtMs;
  return Number.isFinite(issuedAtMs) && age >= 0 && age <= SESSION_MAX_AGE_SECONDS * 1000;
}
