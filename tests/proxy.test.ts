import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { contentSecurityPolicy, proxy, resetProxyRateLimits } from "../proxy";
import { accessTokenPath, readAccessToken, SESSION_COOKIE, sessionValue } from "../lib/access-token";

const token = "t".repeat(43);
const dataDirectory = mkdtempSync(path.join(os.tmpdir(), "control-center-proxy-"));
process.env.CONTROL_CENTER_DATA_DIR = dataDirectory;
process.env.CONTROL_CENTER_ACCESS_TOKEN = token;
test.after(() => rmSync(dataDirectory, { recursive: true, force: true }));
test.beforeEach(() => resetProxyRateLimits());

function request(
  pathname: string,
  { method = "GET", headers = {} as Record<string, string> } = {},
) {
  return new NextRequest(`http://127.0.0.1:3000${pathname}`, {
    method,
    headers: { host: "127.0.0.1:3000", ...headers },
  });
}

const session = { cookie: `${SESSION_COOKIE}=${sessionValue(token)}` };
const bearer = { authorization: `Bearer ${token}` };

test("proxy allows browser requests only from the exact API origin", () => {
  const withOrigin = (origin: string) => proxy(request("/api/brief", { headers: { ...session, origin } })).status;
  assert.equal(withOrigin("http://127.0.0.1:3000"), 200);
  assert.equal(withOrigin("http://127.0.0.1:3001"), 403);
  assert.equal(withOrigin("http://localhost:3000"), 403);
  assert.equal(withOrigin("https://127.0.0.1:3000"), 403);
});

test("proxy rejects foreign Host headers on pages and APIs", () => {
  assert.equal(proxy(request("/", { headers: { host: "attacker.example" } })).status, 403);
  assert.equal(proxy(request("/api/health", { headers: { host: "attacker.example" } })).status, 403);
});

test("proxy requires the access token or a session cookie for the API", () => {
  assert.equal(proxy(request("/api/brief")).status, 401);
  assert.equal(proxy(request("/api/brief", { headers: { authorization: "Bearer wrong" } })).status, 401);
  assert.equal(proxy(request("/api/brief", { headers: { cookie: `${SESSION_COOKIE}=${token}` } })).status, 401);
  assert.equal(proxy(request("/api/brief", { headers: bearer })).status, 200);
  assert.equal(proxy(request("/api/brief", { headers: session })).status, 200);
});

test("proxy leaves health, session exchange, and the OAuth callback reachable", () => {
  assert.equal(proxy(request("/api/health")).status, 200);
  assert.equal(proxy(request("/api/session")).status, 200);
  assert.equal(proxy(request("/api/auth/google/callback?code=x&state=y", { headers: { "sec-fetch-site": "cross-site" } })).status, 200);
});

test("proxy requires same-origin proof or the bearer token for writes", () => {
  assert.equal(proxy(request("/api/settings", { method: "PUT", headers: session })).status, 403);
  assert.equal(proxy(request("/api/settings", { method: "PUT", headers: { ...session, "sec-fetch-site": "same-origin" } })).status, 200);
  assert.equal(proxy(request("/api/settings", { method: "PUT", headers: { ...session, origin: "http://127.0.0.1:3000" } })).status, 200);
  assert.equal(proxy(request("/api/brief", { method: "POST", headers: bearer })).status, 200);
});

test("proxy blocks cross-site and same-site browser requests, including side-effecting GETs", () => {
  for (const site of ["cross-site", "same-site"])
    assert.equal(proxy(request("/api/live/industry?refresh=1", { headers: { ...session, "sec-fetch-site": site } })).status, 403);
  assert.equal(proxy(request("/api/live/industry?refresh=1", { headers: { ...session, "sec-fetch-site": "same-origin" } })).status, 200);
});

test("proxy rate-limits forced refreshes and session attempts", () => {
  const refresh = () => proxy(request("/api/live/mentions?refresh=1", { headers: session }));
  for (let index = 0; index < 6; index += 1) assert.equal(refresh().status, 200);
  const limited = refresh();
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) >= 1);
  // Cached reads of the same collector are not limited.
  assert.equal(proxy(request("/api/live/mentions", { headers: session })).status, 200);

  for (let index = 0; index < 10; index += 1) proxy(request("/api/session", { method: "POST", headers: { authorization: "Bearer guess", origin: "http://127.0.0.1:3000" } }));
  assert.equal(proxy(request("/api/session", { method: "POST", headers: { authorization: "Bearer guess", origin: "http://127.0.0.1:3000" } })).status, 429);
});

test("proxy sends a per-request nonce CSP on pages and a locked-down CSP on APIs", () => {
  const first = proxy(request("/")).headers.get("content-security-policy") || "";
  const second = proxy(request("/")).headers.get("content-security-policy") || "";
  assert.match(first, /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  assert.match(first, /frame-ancestors 'none'/);
  assert.notEqual(first, second);
  assert.doesNotMatch(contentSecurityPolicy("n", false), /unsafe-eval/);
  const api = proxy(request("/api/health"));
  assert.equal(api.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
  assert.equal(api.headers.get("cache-control"), "no-store");
});

test("access token file is generated once with owner-only permissions", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "control-center-token-"));
  const configured = process.env.CONTROL_CENTER_ACCESS_TOKEN;
  delete process.env.CONTROL_CENTER_ACCESS_TOKEN;
  try {
    const created = readAccessToken(directory);
    assert.ok(created.length >= 32);
    assert.equal(readAccessToken(directory), created);
    if (process.platform !== "win32")
      assert.equal(statSync(accessTokenPath(directory)).mode & 0o777, 0o600);
  } finally {
    process.env.CONTROL_CENTER_ACCESS_TOKEN = configured;
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a short CONTROL_CENTER_ACCESS_TOKEN is refused", () => {
  process.env.CONTROL_CENTER_ACCESS_TOKEN = "too-short";
  try {
    assert.throws(() => readAccessToken(dataDirectory), /at least 32/);
    assert.equal(proxy(request("/api/brief", { headers: bearer })).status, 500);
  } finally {
    process.env.CONTROL_CENTER_ACCESS_TOKEN = token;
  }
});
