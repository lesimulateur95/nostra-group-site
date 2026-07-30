import { NextResponse } from "next/server";
import {
  buildSteamOpenIdUrl,
  createSteamState,
  STEAM_STATE_COOKIE,
} from "@/lib/auth/steam";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const state = createSteamState();
  const destination = buildSteamOpenIdUrl(requestUrl.origin, state);
  const response = NextResponse.redirect(destination);

  response.cookies.set(STEAM_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
