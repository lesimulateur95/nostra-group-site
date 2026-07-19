import type { User } from "@supabase/supabase-js";
import { getDiscordId, MANAGER_DISCORD_IDS } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

export const ROLE_LABELS = {
  citizen: "Citoyen",
  employee: "Employé",
  commercial: "Commercial",
  commissioner: "Commissaire",
  manager: "Gérant",
} as const;

export type RoleKey = keyof typeof ROLE_LABELS;

const LEGACY_ROLE_MAP: Record<string, RoleKey> = {
  member: "citizen",
  staff: "employee",
  administrator: "employee",
};

const ROLE_PRIORITY: RoleKey[] = [
  "manager",
  "commissioner",
  "commercial",
  "employee",
  "citizen",
];

export function isRoleKey(value: string): value is RoleKey {
  return Object.prototype.hasOwnProperty.call(ROLE_LABELS, value);
}

export function normalizeRoleKey(value: unknown): RoleKey {
  if (typeof value !== "string") return "citizen";
  if (isRoleKey(value)) return value;
  return LEGACY_ROLE_MAP[value] ?? "citizen";
}

export function normalizeRoleKeys(values: unknown, fallback?: unknown): RoleKey[] {
  const result = new Set<RoleKey>();
  if (Array.isArray(values)) {
    for (const value of values) {
      if (typeof value !== "string") continue;
      result.add(normalizeRoleKey(value));
    }
  }

  if (result.size === 0 && fallback !== undefined && fallback !== null) {
    result.add(normalizeRoleKey(fallback));
  }

  if (result.size === 0) result.add("citizen");
  return ROLE_PRIORITY.filter((role) => result.has(role));
}

export async function getUserRoleKeys(user: User | null | undefined): Promise<RoleKey[]> {
  const discordId = getDiscordId(user);
  if (!user) return ["citizen"];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("member_profiles")
      .select("roles,role")
      .eq("user_id", user.id)
      .maybeSingle();

    const roles: RoleKey[] = !error && data ? normalizeRoleKeys(data.roles, data.role) : ["citizen"];
    if (discordId && MANAGER_DISCORD_IDS.has(discordId) && !roles.includes("manager")) {
      return normalizeRoleKeys([...roles, "manager"]);
    }
    return roles;
  } catch {
    return discordId && MANAGER_DISCORD_IDS.has(discordId) ? ["manager"] : ["citizen"];
  }
}

export async function getUserRoleKey(user: User | null | undefined): Promise<RoleKey> {
  return (await getUserRoleKeys(user))[0] ?? "citizen";
}

export async function getUserRoleLabels(user: User | null | undefined): Promise<string[]> {
  return (await getUserRoleKeys(user)).map((role) => ROLE_LABELS[role]);
}

export async function getUserRoleLabel(user: User | null | undefined): Promise<string> {
  return (await getUserRoleLabels(user)).join(" · ");
}

export async function hasDashboardAccess(user: User | null | undefined): Promise<boolean> {
  return (await getUserRoleKeys(user)).includes("manager");
}

export async function hasCommissionerAccess(user: User | null | undefined): Promise<boolean> {
  const roles = await getUserRoleKeys(user);
  return roles.includes("manager") || roles.includes("commissioner");
}
