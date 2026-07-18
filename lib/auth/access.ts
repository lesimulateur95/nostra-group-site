import type { User } from "@supabase/supabase-js";
import { getDiscordId, MANAGER_DISCORD_IDS } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

export const ROLE_LABELS = {
  member: "Membre",
  staff: "Staff",
  administrator: "Administrateur",
  manager: "Gérant",
} as const;

export type RoleKey = keyof typeof ROLE_LABELS;

export function isRoleKey(value: string): value is RoleKey {
  return Object.prototype.hasOwnProperty.call(ROLE_LABELS, value);
}

export async function getUserRoleKey(user: User | null | undefined): Promise<RoleKey> {
  const discordId = getDiscordId(user);
  if (discordId && MANAGER_DISCORD_IDS.has(discordId)) return "manager";
  if (!user) return "member";

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("member_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error && data && typeof data.role === "string" && isRoleKey(data.role)) return data.role;
  } catch {
    // La table peut ne pas encore être installée lors du premier déploiement.
  }

  return "member";
}

export async function getUserRoleLabel(user: User | null | undefined): Promise<string> {
  return ROLE_LABELS[await getUserRoleKey(user)];
}

export async function hasDashboardAccess(user: User | null | undefined): Promise<boolean> {
  const role = await getUserRoleKey(user);
  return role === "manager" || role === "administrator";
}
