import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearPendingSteamCookies,
  decodePendingCookie,
  linkSteamIdentityToUser,
  STEAM_PENDING_AVATAR_COOKIE,
  STEAM_PENDING_ID_COOKIE,
  STEAM_PENDING_NAME_COOKIE,
  STEAM_PENDING_PROFILE_COOKIE,
  type SteamIdentity,
} from "@/lib/auth/steam";
import {
  getAvatarUrl,
  getDiscordId,
  getDiscordName,
  hasRpProfile,
} from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let destination = "/accueil";
  let steamLinkAttempted = false;

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return NextResponse.redirect(
        new URL("/?steam_error=discord", request.url),
      );
    }

    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (user) {
      const metadata = user.user_metadata ?? {};
      const discordId = getDiscordId(user);

      await supabase.from("member_profiles").upsert(
        {
          user_id: user.id,
          discord_id: discordId,
          discord_name: getDiscordName(user),
          email: user.email ?? null,
          avatar_url: getAvatarUrl(user),
          rp_first_name:
            typeof metadata.rp_first_name === "string"
              ? metadata.rp_first_name
              : null,
          rp_last_name:
            typeof metadata.rp_last_name === "string"
              ? metadata.rp_last_name
              : null,
          role:
            discordId === "331843410962939908"
              ? "manager"
              : undefined,
          roles:
            discordId === "331843410962939908"
              ? ["manager"]
              : undefined,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      const cookieStore = await cookies();
      const pendingSteamId =
        cookieStore.get(STEAM_PENDING_ID_COOKIE)?.value ?? "";
      const steamLinkRequested =
        url.searchParams.get("steam_link") === "1";

      if (steamLinkRequested && /^\d{17}$/.test(pendingSteamId)) {
        steamLinkAttempted = true;
        const identity: SteamIdentity = {
          steamId: pendingSteamId,
          personaName:
            decodePendingCookie(
              cookieStore.get(STEAM_PENDING_NAME_COOKIE)?.value,
            ) || `Compte Steam ${pendingSteamId.slice(-6)}`,
          avatarUrl:
            decodePendingCookie(
              cookieStore.get(STEAM_PENDING_AVATAR_COOKIE)?.value,
            ) || null,
          profileUrl:
            decodePendingCookie(
              cookieStore.get(STEAM_PENDING_PROFILE_COOKIE)?.value,
            ) ||
            `https://steamcommunity.com/profiles/${pendingSteamId}`,
        };

        try {
          await linkSteamIdentityToUser(user.id, identity);
          destination = hasRpProfile(user)
            ? "/accueil?steam_lie=1"
            : "/profil?steam_lie=1";
        } catch (error) {
          console.error("Steam account linking error", error);
          const message =
            error instanceof Error ? error.message.toLowerCase() : "";
          destination = message.includes("déjà lié")
            ? "/?steam_error=already-linked"
            : "/?steam_error=configuration";
        }
      } else {
        destination = hasRpProfile(user) ? "/accueil" : "/profil";
      }
    }
  }

  const response = NextResponse.redirect(
    new URL(destination, request.url),
  );

  if (steamLinkAttempted) clearPendingSteamCookies(response);
  return response;
}
