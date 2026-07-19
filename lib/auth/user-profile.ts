import type { User } from "@supabase/supabase-js";

export const MANAGER_DISCORD_IDS = new Set(["331843410962939908"]);

export type SiteRole = "Gérant" | "Citoyen";

function asNumericDiscordId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^\d{16,22}$/.test(normalized) ? normalized : null;
}

export function getDiscordId(user: User | null | undefined): string | null {
  if (!user) return null;

  const metadata = user.user_metadata ?? {};
  const directCandidates = [
    metadata.provider_id,
    metadata.sub,
    metadata.id,
    metadata.discord_id,
  ];

  for (const candidate of directCandidates) {
    const id = asNumericDiscordId(candidate);
    if (id) return id;
  }

  for (const identity of user.identities ?? []) {
    if (identity.provider !== "discord") continue;
    const identityData = identity.identity_data ?? {};
    const candidates = [
      identityData.provider_id,
      identityData.sub,
      identityData.id,
      identity.id,
    ];

    for (const candidate of candidates) {
      const id = asNumericDiscordId(candidate);
      if (id) return id;
    }
  }

  return null;
}

export function getSiteRole(user: User | null | undefined): SiteRole {
  const discordId = getDiscordId(user);
  return discordId && MANAGER_DISCORD_IDS.has(discordId) ? "Gérant" : "Citoyen";
}

export function isManager(user: User | null | undefined): boolean {
  return getSiteRole(user) === "Gérant";
}

export function hasRpProfile(user: User | null | undefined): boolean {
  const metadata = user?.user_metadata ?? {};
  return Boolean(
    typeof metadata.rp_first_name === "string" &&
      metadata.rp_first_name.trim().length >= 2 &&
      typeof metadata.rp_last_name === "string" &&
      metadata.rp_last_name.trim().length >= 2,
  );
}

export function getRpName(user: User | null | undefined): string {
  const metadata = user?.user_metadata ?? {};
  const firstName = typeof metadata.rp_first_name === "string" ? metadata.rp_first_name.trim() : "";
  const lastName = typeof metadata.rp_last_name === "string" ? metadata.rp_last_name.trim() : "";
  return [firstName, lastName].filter(Boolean).join(" ");
}

export function getDiscordName(user: User | null | undefined): string {
  const metadata = user?.user_metadata ?? {};
  const candidates = [metadata.full_name, metadata.name, metadata.user_name, metadata.preferred_username];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "Compte Discord";
}

export function getAvatarUrl(user: User | null | undefined): string | null {
  const metadata = user?.user_metadata ?? {};
  const candidate = metadata.avatar_url ?? metadata.picture;
  return typeof candidate === "string" && candidate.startsWith("http") ? candidate : null;
}
