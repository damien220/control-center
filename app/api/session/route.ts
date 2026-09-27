import { NextRequest, NextResponse } from "next/server";
import {
  bearerToken,
  isValidAccessToken,
  isValidSession,
  readAccessToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionValue,
} from "@/lib/access-token";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authenticated = isValidSession(request.cookies.get(SESSION_COOKIE)?.value, readAccessToken());
  return NextResponse.json({ authenticated });
}

// Exchanges the raw access token (sent as a bearer header, never in a URL the
// server sees) for an HttpOnly, SameSite=Strict session cookie.
export async function POST(request: NextRequest) {
  const token = readAccessToken();
  if (!isValidAccessToken(bearerToken(request.headers.get("authorization")), token))
    return NextResponse.json({ error: "That access token is not valid." }, { status: 401 });
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(SESSION_COOKIE, sessionValue(token), {
    httpOnly: true,
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
