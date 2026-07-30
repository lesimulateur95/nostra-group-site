import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearPendingSteamCookies,
  createSteamOnlyUser,
  createSupabaseSessionForUser,
  decodePendingCookie,
  STEAM_PENDING_AVATAR_COOKIE,
  STEAM_PENDING_ID_COOKIE,
  STEAM_PENDING_NAME_COOKIE,
  STEAM_PENDING_PROFILE_COOKIE,
  type SteamIdentity,
} from "@/lib/auth/steam";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const steamId = cookieStore.get(STEAM_PENDING_ID_COOKIE)?.value ?? "";

  if (!/^\d{17}$/.test(steamId)) {
    return NextResponse.redirect(
      new URL("/?steam_error=pending-expired", request.url),
      { status: 303 },
    );
  }

  const identity: SteamIdentity = {
    steamId,
    personaName:
      decodePendingCookie(
        cookieStore.get(STEAM_PENDING_NAME_COOKIE)?.value,
      ) || `Compte Steam ${steamId.slice(-6)}`,
    avatarUrl:
      decodePendingCookie(
        cookieStore.get(STEAM_PENDING_AVATAR_COOKIE)?.value,
      ) || null,
    profileUrl:
      decodePendingCookie(
        cookieStore.get(STEAM_PENDING_PROFILE_COOKIE)?.value,
      ) || `https://steamcommunity.com/profiles/${steamId}`,
  };

  try {
    const userId = await createSteamOnlyUser(identity);
    const supabase = await createClient();
    await createSupabaseSessionForUser(supabase, userId);

    const response = NextResponse.redirect(new URL("/profil", request.url), {
      status: 303,
    });
    clearPendingSteamCookies(response);
    return response;
  } catch (error) {
    console.error("Steam account creation error", error);
    return NextResponse.redirect(
      new URL("/?steam_error=creation", request.url),
      { status: 303 },
    );
  }
}
