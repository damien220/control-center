// Local API access token. Kept free of "server-only" so proxy.ts can use it.
//
// The raw token lives in `<data dir>/access-token` (0600) or in
// CONTROL_CENTER_ACCESS_TOKEN. Browsers never store the raw token: they
// exchange it once for an HttpOnly cookie holding an HMAC of the token, so
// rotating the token also invalidates every existing browser session.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDirectory } from "./data-directory";

export const SESSION_COOKIE = "cc_session";
export const SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
export const MIN_ACCESS_TOKEN_LENGTH = 32;

export function accessTokenPath(directory = dataDirectory()) {
  return path.join(directory, "access-token");
}

function environmentToken() {
  const configured = process.env.CONTROL_CENTER_ACCESS_TOKEN?.trim();
  if (!configured) return "";
  if (configured.length < MIN_ACCESS_TOKEN_LENGTH)
    throw new Error(
      `CONTROL_CENTER_ACCESS_TOKEN must be at least ${MIN_ACCESS_TOKEN_LENGTH} characters.`,
    );
  return configured;
}

/**
 * Returns the configured token, creating the token file on first use. The
 * file is read on every call so `npm run token -- --rotate` takes effect
 * without a restart.
 */
export function readAccessToken(directory = dataDirectory()) {
  const configured = environmentToken();
  if (configured) return configured;
  const target = accessTokenPath(directory);
  try {
    const stored = readFileSync(target, "utf8").trim();
    if (stored.length >= MIN_ACCESS_TOKEN_LENGTH) return stored;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const created = randomBytes(32).toString("base64url");
  try {
    writeFileSync(target, `${created}\n`, { mode: 0o600, flag: "wx" });
  } catch (error) {
    // Another process created it first; use theirs.
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      return readFileSync(target, "utf8").trim();
    throw error;
  }
  chmodSync(target, 0o600);
  return created;
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionValue(token: string) {
  return createHmac("sha256", token)
    .update("control-center-session-v1")
    .digest("base64url");
}

export function isValidAccessToken(candidate: string | null | undefined, token: string) {
  return Boolean(candidate) && safeEqual(candidate!.trim(), token);
}

export function isValidSession(cookie: string | null | undefined, token: string) {
  return Boolean(cookie) && safeEqual(cookie!, sessionValue(token));
}

export function bearerToken(authorization: string | null | undefined) {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization?.trim() || "");
  return match ? match[1] : "";
}
