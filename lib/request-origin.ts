import type { NextRequest } from "next/server";

/**
 * The origin the browser used. `request.url` reflects the server's bind
 * address, which is `0.0.0.0` inside the Docker image; the Host header is what
 * the browser sent, and proxy.ts has already restricted it to loopback.
 */
export function browserUrl(pathname: string, request: NextRequest) {
  const host = request.headers.get("host") || request.nextUrl.host;
  return new URL(pathname, `${request.nextUrl.protocol}//${host}`);
}
