
import type { User } from "@supabase/supabase-js";
import {
  getDiscordId,
  MANAGER_DISCORD_IDS,
} from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

export const ROLE_LABELS = {
  citizen: "Citoyen",
  employee: "Employé",
  commercial: "Commercial",
  commissioner: "Commissaire",
  manager: "Gérant",
} as const;

export type RoleKey = keyof typeof ROLE_LABELS;

const ROLE_PRIORITY: RoleKey[] = [
  "manager",
  "commissioner",
  "commercial",
  "employee",
  "citizen",
];

const ROLE_ALIASES: Record<string, RoleKey> = {
  citizen: "citizen",
  citoyen: "citizen",
  member: "citizen",
  membre: "citizen",

  employee: "employee",
  employe: "employee",
  staff: "employee",
  administrator: "employee",

  commercial: "commercial",
  vendeur: "commercial",

  commissioner: "commissioner",
  commissaire: "commissioner",

  manager: "manager",
  gerant: "manager",
  direction: "manager",
};

function normalizedText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isRoleKey(value: string): value is RoleKey {
  return Object.prototype.hasOwnProperty.call(ROLE_LABELS, value);
}

export function normalizeRoleKey(value: unknown): RoleKey {
  if (typeof value !== "string") return "citizen";

  const normalized = normalizedText(value);
  return ROLE_ALIASES[normalized] ?? "citizen";
}

export function normalizeRoleKeys(
  values: unknown,
  fallback?: unknown,
): RoleKey[] {
  const result = new Set<RoleKey>();

  if (Array.isArray(values)) {
    for (const value of values) {
      if (typeof value !== "string") continue;
      result.add(normalizeRoleKey(value));
    }
  } else if (typeof values === "string") {
    for (const value of values.split(",")) {
      if (!value.trim()) continue;
      result.add(normalizeRoleKey(value));
    }
  }

  if (
    result.size === 0 &&
    fallback !== undefined &&
    fallback !== null
  ) {
    result.add(normalizeRoleKey(fallback));
  }

  if (result.size === 0) result.add("citizen");

  if (result.size > 1) {
    result.delete("citizen");
  }

  return ROLE_PRIORITY.filter((role) => result.has(role));
}

export async function getUserRoleKeys(
  user: User | null | undefined,
): Promise<RoleKey[]> {
  const discordId = getDiscordId(user);
  if (!user) return ["citizen"];

  try {
    const supabase = await createClient();

    // La fonction SQL nostra_roles() est SECURITY DEFINER :
    // elle peut lire les rôles du compte même lorsque les règles RLS
    // empêchent une lecture directe de member_profiles.
    const rpcResult = await supabase.rpc("nostra_roles");

    let roles: RoleKey[] =
      !rpcResult.error && rpcResult.data
        ? normalizeRoleKeys(rpcResult.data)
        : ["citizen"];

    // Compatibilité avec les installations plus anciennes où
    // nostra_roles() n'existe pas encore.
    if (rpcResult.error) {
      const completeResult = await supabase
        .from("member_profiles")
        .select("roles,role")
        .eq("user_id", user.id)
        .maybeSingle();

      roles =
        !completeResult.error && completeResult.data
          ? normalizeRoleKeys(
              completeResult.data.roles,
              completeResult.data.role,
            )
          : ["citizen"];

      if (completeResult.error) {
        const legacyResult = await supabase
          .from("member_profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!legacyResult.error && legacyResult.data) {
          roles = normalizeRoleKeys(
            null,
            legacyResult.data.role,
          );
        }
      }
    }

    if (
      discordId &&
      MANAGER_DISCORD_IDS.has(discordId) &&
      !roles.includes("manager")
    ) {
      return normalizeRoleKeys([...roles, "manager"]);
    }

    return roles;
  } catch {
    return discordId && MANAGER_DISCORD_IDS.has(discordId)
      ? ["manager"]
      : ["citizen"];
  }
}

export async function getUserRoleKey(
  user: User | null | undefined,
): Promise<RoleKey> {
  return (await getUserRoleKeys(user))[0] ?? "citizen";
}

export async function getUserRoleLabels(
  user: User | null | undefined,
): Promise<string[]> {
  return (await getUserRoleKeys(user)).map(
    (role) => ROLE_LABELS[role],
  );
}

export async function getUserRoleLabel(
  user: User | null | undefined,
): Promise<string> {
  return (await getUserRoleLabels(user)).join(" · ");
}

export async function hasDashboardAccess(
  user: User | null | undefined,
): Promise<boolean> {
  return (await getUserRoleKeys(user)).includes("manager");
}

export async function hasStaffDashboardAccess(
  user: User | null | undefined,
): Promise<boolean> {
  const roles = await getUserRoleKeys(user);

  return roles.some((role) =>
    [
      "manager",
      "commissioner",
      "employee",
      "commercial",
    ].includes(role),
  );
}

export async function hasCommissionerAccess(
  user: User | null | undefined,
): Promise<boolean> {
  const roles = await getUserRoleKeys(user);

  return (
    roles.includes("manager") ||
    roles.includes("commissioner")
  );
}
