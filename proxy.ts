import { NextResponse, type NextRequest } from "next/server";
import {
  bearerToken,
  isValidAccessToken,
  isValidSession,
  readAccessToken,
  SESSION_COOKIE,
} from "./lib/access-token";
import { RateLimiter, type RateLimitRule } from "./lib/rate-limit";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Reachable without a session: the health probe, the session exchange (which
// checks the token itself), and Google's cross-site OAuth redirect, which is
// bound to an authenticated start by its state cookie.
const publicApiPaths = new Set(["/api/health", "/api/session", "/api/auth/google/callback"]);
const crossSiteApiPaths = new Set(["/api/auth/google/callback"]);

const rateLimiter = new RateLimiter();
const refreshRule: RateLimitRule = { capacity: 6, refillPerMinute: 2 };
const modelListRule: RateLimitRule = { capacity: 10, refillPerMinute: 5 };
const sessionRule: RateLimitRule = { capacity: 10, refillPerMinute: 5 };

export function resetProxyRateLimits() {
  rateLimiter.reset();
}

function isLoopback(value: string) {
  try {
    return loopbackHosts.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isSameOrigin(value: string, request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    requestUrl.host = request.headers.get("host") || requestUrl.host;
    return new URL(value).origin === requestUrl.origin;
  } catch {
    return false;
  }
}

function error(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers });
}

export function contentSecurityPolicy(nonce: string, development = process.env.NODE_ENV === "development") {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // React style={{}} attributes need inline styles; scripts stay nonce-only.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${development ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
  ].join("; ");
}

function rateLimitRule(request: NextRequest): [string, RateLimitRule] | null {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith("/api/live/") && searchParams.get("refresh") === "1")
    return [`refresh:${pathname}`, refreshRule];
  if (pathname === "/api/ai/models" && request.method === "POST") return ["ai-models", modelListRule];
  if (pathname === "/api/session" && request.method === "POST") return ["session", sessionRule];
  return null;
}

function guardApi(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const bearer = bearerToken(request.headers.get("authorization"));

  if (origin && !isSameOrigin(origin, request))
    return error("Cross-site requests are blocked.", 403);
  // Browsers label every request; refuse anything another site initiated,
  // including GETs whose ?refresh=1 triggers collection or paid AI calls.
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none" && !crossSiteApiPaths.has(pathname))
    return error("Cross-site requests are blocked.", 403);
  // A mutating browser request must prove it is same-origin. Scripted callers
  // without browser headers must present the bearer token instead.
  if (mutatingMethods.has(request.method) && !origin && fetchSite !== "same-origin" && !bearer)
    return error("Requests that change data must come from the dashboard or carry the access token.", 403);

  const limited = rateLimitRule(request);
  if (limited) {
    const retryAfter = rateLimiter.take(...limited);
    if (retryAfter)
      return error("Too many requests. Wait a moment and try again.", 429, { "Retry-After": String(retryAfter) });
  }

  if (publicApiPaths.has(pathname)) return null;
  let token: string;
  try {
    token = readAccessToken();
  } catch {
    return error("The local access token could not be read. Run npm run doctor.", 500);
  }
  if (isValidAccessToken(bearer, token) || isValidSession(request.cookies.get(SESSION_COOKIE)?.value, token))
    return null;
  return error("Sign in with your Control Center access token.", 401);
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  if (!isLoopback(`http://${host}`)) {
    return NextResponse.json(
      { error: "Control Center only accepts requests from this computer." },
      { status: 403 },
    );
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const blocked = guardApi(request);
    if (blocked) return blocked;
    const response = NextResponse.next();
    response.headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  // Pages: a fresh nonce per request; Next.js applies it to its own scripts.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

// No `missing: [prefetch headers]` condition: any caller can send those headers,
// and skipping the proxy would skip the Host check and API authentication.
export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
