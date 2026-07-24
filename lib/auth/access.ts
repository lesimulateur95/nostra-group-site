import { headers } from "next/headers";
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
  citoyens: "citizen",
  member: "citizen",
  membre: "citizen",
  membres: "citizen",

  employee: "employee",
  employe: "employee",
  employes: "employee",
  staff: "employee",
  administrator: "employee",

  commercial: "commercial",
  commerciale: "commercial",
  commerciaux: "commercial",
  vendeur: "commercial",
  vendeurs: "commercial",

  commissioner: "commissioner",
  commissioners: "commissioner",
  commissaire: "commissioner",
  commissaires: "commissioner",
  "commissaire de course": "commissioner",
  "commissaires de course": "commissioner",
  steward: "commissioner",
  stewards: "commissioner",

  manager: "manager",
  gerant: "manager",
  gerants: "manager",
  direction: "manager",
};

const ROLE_OBJECT_KEYS = new Set([
  "role",
  "roles",
  "role_key",
  "role_keys",
  "role_name",
  "role_names",
  "key",
  "name",
  "label",
  "value",
]);

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
  const exact = ROLE_ALIASES[normalized];
  if (exact) return exact;

  // Les rôles Discord ou Supabase peuvent contenir un intitulé plus long,
  // par exemple « Commissaire Nostra Circuit » ou « Employé Nostra Motors ».
  if (
    normalized.includes("commissaire") ||
    normalized.includes("commissioner") ||
    normalized.includes("steward")
  ) {
    return "commissioner";
  }

  if (
    normalized.includes("gerant") ||
    normalized.includes("manager") ||
    normalized.includes("direction")
  ) {
    return "manager";
  }

  if (
    normalized.includes("commercial") ||
    normalized.includes("vendeur")
  ) {
    return "commercial";
  }

  if (
    normalized.includes("employe") ||
    normalized.includes("employee") ||
    normalized.includes("staff")
  ) {
    return "employee";
  }

  return "citizen";
}

function addRoleString(result: Set<RoleKey>, value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;

  // Certaines anciennes fonctions renvoient du JSON encodé en texte.
  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      collectRoleKeys(result, JSON.parse(trimmed), 1);
      return;
    } catch {
      // Le texte n'est pas du JSON valide : traitement classique ci-dessous.
    }
  }

  // Accepte les listes séparées par virgule, point-virgule ou barre verticale.
  const parts = trimmed.split(/[,;|]/g).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    for (const part of parts) addRoleString(result, part);
    return;
  }

  const role = normalizeRoleKey(trimmed);
  if (role !== "citizen" || normalizedText(trimmed).match(/citoyen|citizen|membre|member/)) {
    result.add(role);
  }
}

function collectRoleKeys(
  result: Set<RoleKey>,
  value: unknown,
  depth = 0,
): void {
  if (depth > 5 || value === null || value === undefined) return;

  if (typeof value === "string") {
    addRoleString(result, value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectRoleKeys(result, item, depth + 1);
    return;
  }

  if (typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  let matchedKnownKey = false;

  for (const [key, entry] of Object.entries(record)) {
    if (!ROLE_OBJECT_KEYS.has(normalizedText(key))) continue;
    matchedKnownKey = true;
    collectRoleKeys(result, entry, depth + 1);
  }

  // Les RPC PostgreSQL peuvent renvoyer une ligne sous la forme
  // { nostra_roles: [...] } ou { get_roles: [...] }.
  if (!matchedKnownKey) {
    for (const [key, entry] of Object.entries(record)) {
      const normalizedKey = normalizedText(key);
      if (normalizedKey.includes("role")) {
        collectRoleKeys(result, entry, depth + 1);
      }
    }
  }
}

export function normalizeRoleKeys(
  values: unknown,
  fallback?: unknown,
): RoleKey[] {
  const result = new Set<RoleKey>();

  collectRoleKeys(result, values);
  if (result.size === 0) collectRoleKeys(result, fallback);

  if (result.size === 0) result.add("citizen");
  if (result.size > 1) result.delete("citizen");

  return ROLE_PRIORITY.filter((role) => result.has(role));
}

function mergeRoleSources(...sources: unknown[]): RoleKey[] {
  const merged = new Set<RoleKey>();

  for (const source of sources) {
    for (const role of normalizeRoleKeys(source)) {
      merged.add(role);
    }
  }

  if (merged.size > 1) merged.delete("citizen");
  if (merged.size === 0) merged.add("citizen");

  return ROLE_PRIORITY.filter((role) => merged.has(role));
}

export async function getUserRoleKeys(
  user: User | null | undefined,
): Promise<RoleKey[]> {
  const discordId = getDiscordId(user);
  if (!user) return ["citizen"];

  try {
    const supabase = await createClient();

    // Important : on ne dépend plus uniquement de nostra_roles().
    // Une RPC peut réussir tout en renvoyant null, [] ou un format ancien.
    const [rpcResult, completeResult] = await Promise.all([
      supabase.rpc("nostra_roles"),
      supabase
        .from("member_profiles")
        .select("roles,role")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    let legacyRole: unknown = null;
    if (completeResult.error) {
      const legacyResult = await supabase
        .from("member_profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!legacyResult.error && legacyResult.data) {
        legacyRole = legacyResult.data.role;
      }
    }

    const roles = mergeRoleSources(
      !rpcResult.error ? rpcResult.data : null,
      !completeResult.error ? completeResult.data?.roles : null,
      !completeResult.error ? completeResult.data?.role : null,
      legacyRole,
      user.app_metadata?.roles,
      user.app_metadata?.role,
      user.user_metadata?.roles,
      user.user_metadata?.role,
    );

    if (
      discordId &&
      MANAGER_DISCORD_IDS.has(discordId) &&
      !roles.includes("manager")
    ) {
      return mergeRoleSources(roles, "manager");
    }

    return roles;
  } catch {
    const metadataRoles = mergeRoleSources(
      user.app_metadata?.roles,
      user.app_metadata?.role,
      user.user_metadata?.roles,
      user.user_metadata?.role,
    );

    if (discordId && MANAGER_DISCORD_IDS.has(discordId)) {
      return mergeRoleSources(metadataRoles, "manager");
    }

    return metadataRoles;
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
  return (await getUserRoleKeys(user)).map((role) => ROLE_LABELS[role]);
}

export async function getUserRoleLabel(
  user: User | null | undefined,
): Promise<string> {
  return (await getUserRoleLabels(user)).join(" · ");
}

const OPERATIONS_DASHBOARD_PREFIXES = [
  "/dashboard/catalogue",
  "/dashboard/commandes",
  "/dashboard/livraisons",
  "/dashboard/rendez-vous-motors",
  "/dashboard/stocks",
  "/dashboard/reservations",
  "/dashboard/homologations",
  "/dashboard/inscriptions-ecuries",
  "/dashboard/championnats",
] as const;

function isOperationsDashboardPath(pathname: string): boolean {
  return OPERATIONS_DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function getCurrentRequestPathname(): Promise<string> {
  try {
    const requestHeaders = await headers();
    const forwardedPathname = requestHeaders.get("x-nostra-pathname");
    if (forwardedPathname) return forwardedPathname;

    const referer = requestHeaders.get("referer");
    if (!referer) return "";

    return new URL(referer).pathname;
  } catch {
    return "";
  }
}

export async function hasDashboardAccess(
  user: User | null | undefined,
): Promise<boolean> {
  const roles = await getUserRoleKeys(user);

  if (roles.includes("manager")) return true;

  const operationsRole =
    roles.includes("employee") || roles.includes("commercial");
  if (!operationsRole) return false;

  return isOperationsDashboardPath(await getCurrentRequestPathname());
}

export async function hasStaffDashboardAccess(
  user: User | null | undefined,
): Promise<boolean> {
  const roles = await getUserRoleKeys(user);
  return roles.some((role) =>
    ["manager", "commissioner", "employee", "commercial"].includes(role),
  );
}

export async function hasCommissionerAccess(
  user: User | null | undefined,
): Promise<boolean> {
  const roles = await getUserRoleKeys(user);
  return roles.includes("manager") || roles.includes("commissioner");
}
