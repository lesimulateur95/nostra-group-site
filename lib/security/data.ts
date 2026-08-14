import { createClient } from "@/lib/supabase/server";
import type { SecurityOverview } from "@/lib/security/types";
import { getSecurityExtensionsV156 } from "@/lib/v156/data";

export async function getSecurityOverview(): Promise<{
  configured: boolean;
  data: SecurityOverview | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const [result, extensions] = await Promise.all([
    supabase.rpc("nostra_security_overview"),
    getSecurityExtensionsV156().catch(() => null),
  ]);

  if (result.error) {
    return { configured: false, data: null, error: result.error.message };
  }

  const overview = result.data as SecurityOverview;
  if (extensions) {
    const assignmentMap = new Map<string, string[]>();
    for (const assignment of extensions.assignments) {
      const list = assignmentMap.get(assignment.userId) ?? [];
      list.push(assignment.roleKey);
      assignmentMap.set(assignment.userId, list);
    }
    type PresenceEntry = (typeof extensions.presence)[number];
    const presenceMap = new Map<string, PresenceEntry>(
      extensions.presence.map((entry: PresenceEntry) => [entry.userId, entry]),
    );
    overview.members = (overview.members ?? []).map((member) => {
      const presence = presenceMap.get(member.user_id);
      return {
        ...member,
        custom_roles: assignmentMap.get(member.user_id) ?? [],
        online: presence?.online ?? false,
        last_seen_at: presence?.lastSeenAt ?? null,
        current_path: presence?.currentPath ?? null,
      };
    });
    overview.customRoles = extensions.roles;
    overview.customPermissions = extensions.permissions;
    overview.blacklist = extensions.blacklist;
    overview.emergency = extensions.emergency;
  }

  return { configured: true, data: overview, error: null };
}
