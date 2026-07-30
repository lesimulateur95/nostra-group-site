import { createClient } from "@/lib/supabase/server";

export const MEMBER_ROLE_OPTIONS = [
  "citizen",
  "member",
  "employee",
  "commercial",
  "commissioner",
  "staff",
  "manager",
  "administrator",
] as const;

export type MemberRoleKey = (typeof MEMBER_ROLE_OPTIONS)[number];

export const MEMBER_ROLE_LABELS: Record<MemberRoleKey, string> = {
  citizen: "Citoyen",
  member: "Membre",
  employee: "Employé",
  commercial: "Commercial",
  commissioner: "Commissaire",
  staff: "Staff",
  manager: "Gérant",
  administrator: "Administrateur",
};

export type MemberRoleRow = {
  user_id: string;
  discord_name: string | null;
  email: string | null;
  rp_first_name: string | null;
  rp_last_name: string | null;
  role: string | null;
  roles: string[];
};

function normalizeRoles(value: unknown, primary?: string | null): string[] {
  const source = Array.isArray(value) ? value.map(String) : [];
  if (primary) source.push(primary);
  source.push("citizen");
  return [...new Set(source.map((role) => role.trim().toLowerCase()).filter(Boolean))];
}

export async function getMembersWithRoles(): Promise<{
  configured: boolean;
  members: MemberRoleRow[];
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_profiles")
    .select(
      "user_id,discord_name,email,rp_first_name,rp_last_name,role,roles",
    )
    .order("rp_last_name")
    .order("rp_first_name");

  return {
    configured: !error,
    members: (data ?? []).map((row) => ({
      ...row,
      user_id: String(row.user_id),
      role: row.role ? String(row.role) : null,
      roles: normalizeRoles(row.roles, row.role ? String(row.role) : null),
    })) as MemberRoleRow[],
  };
}

export async function getOwnMemberRoles(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_profiles")
    .select("role,roles")
    .eq("user_id", userId)
    .maybeSingle();

  return normalizeRoles(data?.roles, data?.role ? String(data.role) : null);
}
