import type { User } from "@supabase/supabase-js";
import { getDiscordId, MANAGER_DISCORD_IDS } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

export const ROLE_LABELS = {
  member: "Membre",
  employee: "Employé",
  commercial: "Commercial",
  commissioner: "Commissaire",
  manager: "Gérant",
} as const;

export type RoleKey = keyof typeof ROLE_LABELS;

const LEGACY_ROLE_MAP: Record<string, RoleKey> = {
  staff: "employee",
  administrator: "employee",
};

export function isRoleKey(value: string): value is RoleKey {
  return Object.prototype.hasOwnProperty.call(ROLE_LABELS, value);
}

export function normalizeRoleKey(value: unknown): RoleKey {
  if (typeof value !== "string") return "member";
  if (isRoleKey(value)) return value;
  return LEGACY_ROLE_MAP[value] ?? "member";
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
    if (!error && data) return normalizeRoleKey(data.role);
  } catch {
    // La table peut ne pas encore être installée lors du premier déploiement.
  }

  return "member";
}

export async function getUserRoleLabel(user: User | null | undefined): Promise<string> {
  return ROLE_LABELS[await getUserRoleKey(user)];
}

export async function hasDashboardAccess(user: User | null | undefined): Promise<boolean> {
  return (await getUserRoleKey(user)) === "manager";
}

export async function hasCommissionerAccess(user: User | null | undefined): Promise<boolean> {
  const role = await getUserRoleKey(user);
  return role === "manager" || role === "commissioner";
}
