import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearPendingSteamCookies,
  createSupabaseSessionForUser,
  findUserIdBySteamId,
  getSteamIdentity,
  setPendingSteamCookies,
  statesMatch,
  STEAM_STATE_COOKIE,
  verifySteamOpenIdCallback,
} from "@/lib/auth/steam";
import { createClient } from "@/lib/supabase/server";

function redirectWithError(request: Request, code: string) {
  return NextResponse.redirect(new URL(`/?steam_error=${code}`, request.url));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STEAM_STATE_COOKIE)?.value;
  const receivedState = requestUrl.searchParams.get("state");

  if (!statesMatch(expectedState, receivedState)) {
    return redirectWithError(request, "state");
  }

  cookieStore.delete(STEAM_STATE_COOKIE);

  try {
    const steamId = await verifySteamOpenIdCallback(requestUrl);
    if (!steamId) return redirectWithError(request, "verification");

    const identity = await getSteamIdentity(steamId);
    const userId = await findUserIdBySteamId(steamId);

    if (!userId) {
      const response = NextResponse.redirect(
        new URL("/auth/steam/associer", request.url),
      );
      clearPendingSteamCookies(response);
      setPendingSteamCookies(response, identity);
      return response;
    }

    const supabase = await createClient();
    await createSupabaseSessionForUser(supabase, userId);
    return NextResponse.redirect(new URL("/accueil", request.url));
  } catch (error) {
    console.error("Steam authentication error", error);
    return redirectWithError(request, "configuration");
  }
}
