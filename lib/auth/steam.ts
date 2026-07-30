import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export const STEAM_OPENID_ENDPOINT =
  "https://steamcommunity.com/openid/login";
export const STEAM_STATE_COOKIE = "nostra_steam_state";
export const STEAM_PENDING_ID_COOKIE = "nostra_steam_pending_id";
export const STEAM_PENDING_NAME_COOKIE = "nostra_steam_pending_name";
export const STEAM_PENDING_AVATAR_COOKIE = "nostra_steam_pending_avatar";
export const STEAM_PENDING_PROFILE_COOKIE = "nostra_steam_pending_profile";

const STEAM_CLAIMED_ID_PATTERN =
  /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

export type SteamIdentity = {
  steamId: string;
  personaName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
};

export function createSteamState(): string {
  return randomBytes(32).toString("hex");
}

export function statesMatch(
  expected: string | undefined,
  received: string | null,
): boolean {
  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function buildSteamOpenIdUrl(
  origin: string,
  state: string,
): string {
  const returnTo = `${origin}/auth/steam/callback?state=${encodeURIComponent(state)}`;
  const url = new URL(STEAM_OPENID_ENDPOINT);

  url.searchParams.set(
    "openid.ns",
    "http://specs.openid.net/auth/2.0",
  );
  url.searchParams.set("openid.mode", "checkid_setup");
  url.searchParams.set("openid.return_to", returnTo);
  url.searchParams.set("openid.realm", origin);
  url.searchParams.set(
    "openid.identity",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );
  url.searchParams.set(
    "openid.claimed_id",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );

  return url.toString();
}

export async function verifySteamOpenIdCallback(
  requestUrl: URL,
): Promise<string | null> {
  const claimedId = requestUrl.searchParams.get("openid.claimed_id");
  const match = claimedId?.match(STEAM_CLAIMED_ID_PATTERN);
  if (!match) return null;

  const opEndpoint = requestUrl.searchParams.get("openid.op_endpoint");
  if (opEndpoint !== STEAM_OPENID_ENDPOINT) return null;

  const state = requestUrl.searchParams.get("state");
  const expectedReturnTo = state
    ? `${requestUrl.origin}/auth/steam/callback?state=${encodeURIComponent(state)}`
    : "";
  if (
    !expectedReturnTo ||
    requestUrl.searchParams.get("openid.return_to") !== expectedReturnTo
  ) {
    return null;
  }

  const verification = new URLSearchParams();
  requestUrl.searchParams.forEach((value, key) => {
    if (key.startsWith("openid.")) verification.set(key, value);
  });
  verification.set("openid.mode", "check_authentication");

  const response = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/plain",
    },
    body: verification.toString(),
    cache: "no-store",
  });

  if (!response.ok) return null;
  const body = await response.text();
  if (!/(?:^|\n)is_valid:true(?:\n|$)/.test(body)) return null;

  return match[1];
}

export async function getSteamIdentity(
  steamId: string,
): Promise<SteamIdentity> {
  const fallback: SteamIdentity = {
    steamId,
    personaName: `Compte Steam ${steamId.slice(-6)}`,
    avatarUrl: null,
    profileUrl: `https://steamcommunity.com/profiles/${steamId}`,
  };

  const apiKey = process.env.STEAM_WEB_API_KEY;
  if (!apiKey) return fallback;

  try {
    const url = new URL(
      "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/",
    );
    url.searchParams.set("key", apiKey);
    url.searchParams.set("steamids", steamId);

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return fallback;

    const payload = (await response.json()) as {
      response?: {
        players?: Array<{
          steamid?: string;
          personaname?: string;
          avatarfull?: string;
          profileurl?: string;
        }>;
      };
    };
    const player = payload.response?.players?.[0];
    if (!player || player.steamid !== steamId) return fallback;

    return {
      steamId,
      personaName:
        typeof player.personaname === "string" && player.personaname.trim()
          ? player.personaname.trim()
          : fallback.personaName,
      avatarUrl:
        typeof player.avatarfull === "string" &&
        player.avatarfull.startsWith("http")
          ? player.avatarfull
          : null,
      profileUrl:
        typeof player.profileurl === "string" &&
        player.profileurl.startsWith("http")
          ? player.profileurl
          : fallback.profileUrl,
    };
  } catch {
    return fallback;
  }
}

export function setPendingSteamCookies(
  response: NextResponse,
  identity: SteamIdentity,
): void {
  const common = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 15 * 60,
  };

  response.cookies.set(
    STEAM_PENDING_ID_COOKIE,
    identity.steamId,
    common,
  );
  response.cookies.set(
    STEAM_PENDING_NAME_COOKIE,
    encodeURIComponent(identity.personaName),
    common,
  );
  response.cookies.set(
    STEAM_PENDING_AVATAR_COOKIE,
    encodeURIComponent(identity.avatarUrl ?? ""),
    common,
  );
  response.cookies.set(
    STEAM_PENDING_PROFILE_COOKIE,
    encodeURIComponent(identity.profileUrl ?? ""),
    common,
  );
}

export function clearPendingSteamCookies(response: NextResponse): void {
  for (const name of [
    STEAM_PENDING_ID_COOKIE,
    STEAM_PENDING_NAME_COOKIE,
    STEAM_PENDING_AVATAR_COOKIE,
    STEAM_PENDING_PROFILE_COOKIE,
  ]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

export function decodePendingCookie(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

export async function createSupabaseSessionForUser(
  serverClient: SupabaseClient,
  userId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(userId);

  if (userError || !userData.user?.email) {
    throw new Error("Impossible de retrouver le compte Nostra Group lié.");
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    throw new Error("Impossible de créer la session Steam.");
  }

  const { error: verificationError } = await serverClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (verificationError) {
    throw new Error("La session Steam n’a pas pu être validée.");
  }
}

export async function findUserIdBySteamId(
  steamId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("member_profiles")
    .select("user_id")
    .eq("steam_id", steamId)
    .maybeSingle();

  if (error) {
    throw new Error(
      "La colonne Steam n’est pas encore configurée dans Supabase.",
    );
  }

  return typeof data?.user_id === "string" ? data.user_id : null;
}

export async function linkSteamIdentityToUser(
  userId: string,
  identity: SteamIdentity,
): Promise<void> {
  const admin = createAdminClient();
  const existingUserId = await findUserIdBySteamId(identity.steamId);

  if (existingUserId && existingUserId !== userId) {
    throw new Error("Ce compte Steam est déjà lié à un autre citoyen.");
  }

  const { data: currentUserData } =
    await admin.auth.admin.getUserById(userId);
  const currentMetadata = currentUserData.user?.user_metadata ?? {};

  const { error: authError } =
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...currentMetadata,
        steam_id: identity.steamId,
        steam_name: identity.personaName,
        steam_profile_url: identity.profileUrl,
        steam_avatar_url: identity.avatarUrl,
      },
    });
  if (authError) throw authError;

  const { error: profileError } = await admin
    .from("member_profiles")
    .upsert(
      {
        user_id: userId,
        steam_id: identity.steamId,
        steam_name: identity.personaName,
        steam_avatar_url: identity.avatarUrl,
        steam_profile_url: identity.profileUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (profileError) throw profileError;
}

export async function createSteamOnlyUser(
  identity: SteamIdentity,
): Promise<string> {
  const admin = createAdminClient();
  const existingUserId = await findUserIdBySteamId(identity.steamId);
  if (existingUserId) return existingUserId;

  const syntheticEmail = `steam-${identity.steamId}@steam.nostra.group`;
  const { data, error } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    email_confirm: true,
    user_metadata: {
      provider: "steam",
      steam_id: identity.steamId,
      steam_name: identity.personaName,
      steam_profile_url: identity.profileUrl,
      steam_avatar_url: identity.avatarUrl,
      full_name: identity.personaName,
      name: identity.personaName,
      avatar_url: identity.avatarUrl,
      picture: identity.avatarUrl,
    },
  });

  if (error || !data.user) {
    throw new Error("Le compte Nostra Group Steam n’a pas pu être créé.");
  }

  const { error: profileError } = await admin
    .from("member_profiles")
    .upsert(
      {
        user_id: data.user.id,
        email: syntheticEmail,
        discord_name: identity.personaName,
        steam_id: identity.steamId,
        steam_name: identity.personaName,
        steam_avatar_url: identity.avatarUrl,
        steam_profile_url: identity.profileUrl,
        role: "citizen",
        roles: ["citizen"],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error("Le profil citoyen Steam n’a pas pu être créé.");
  }

  return data.user.id;
}
