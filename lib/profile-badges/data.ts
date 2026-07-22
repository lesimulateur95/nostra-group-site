import { createClient } from "@/lib/supabase/server";
import type {
  BadgeAdministrationData,
  BadgeAward,
  BadgeCatalogItem,
  BadgeMember,
  ProfileBadge,
} from "@/lib/profile-badges/types";

type RawCatalog = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  is_active: boolean | null;
  sort_order: number | null;
};

type RawAward = {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_at: string;
  award_source: string | null;
  note: string | null;
};

type RawMember = {
  user_id: string;
  name?: string | null;
  rp_first_name?: string | null;
  rp_last_name?: string | null;
  discord_name?: string | null;
  email: string | null;
};

function message(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Erreur inconnue");
  }
  return "Erreur inconnue";
}

function memberName(member: RawMember): string {
  const rpName = [member.rp_first_name, member.rp_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return member.name?.trim() || rpName || member.discord_name || member.email || "Compte Nostra";
}

export async function getMyProfileBadges(): Promise<{
  configured: boolean;
  error: string | null;
  badges: ProfileBadge[];
}> {
  const supabase = await createClient();

  await supabase.rpc("refresh_my_profile_badges");

  const [catalogResult, awardsResult] = await Promise.all([
    supabase
      .from("profile_badge_catalog")
      .select("id,code,label,description,icon,category,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order")
      .order("label"),
    supabase
      .from("profile_badge_awards")
      .select("id,user_id,badge_id,awarded_at,award_source,note")
      .order("awarded_at", { ascending: false }),
  ]);

  if (catalogResult.error || awardsResult.error) {
    return {
      configured: false,
      error: message(catalogResult.error ?? awardsResult.error),
      badges: [],
    };
  }

  const awards = (awardsResult.data ?? []) as RawAward[];
  const awardsByBadge = new Map(awards.map((award) => [award.badge_id, award]));

  const badges = ((catalogResult.data ?? []) as RawCatalog[]).map((badge) => {
    const award = awardsByBadge.get(badge.id);
    return {
      id: badge.id,
      code: badge.code,
      label: badge.label,
      description: badge.description ?? "",
      icon: badge.icon ?? "🏅",
      category: badge.category ?? "Général",
      sort_order: Number(badge.sort_order) || 0,
      earned: Boolean(award),
      awarded_at: award?.awarded_at ?? null,
      award_source: award?.award_source ?? null,
      note: award?.note ?? null,
    } satisfies ProfileBadge;
  });

  return { configured: true, error: null, badges };
}

export async function getBadgeAdministrationData(): Promise<BadgeAdministrationData> {
  const supabase = await createClient();

  const [catalogResult, membersResult, awardsResult] = await Promise.all([
    supabase
      .from("profile_badge_catalog")
      .select("id,code,label,description,icon,category,is_active,sort_order")
      .order("sort_order")
      .order("label"),
    supabase.rpc("nostra_citizen_directory"),
    supabase
      .from("profile_badge_awards")
      .select("id,user_id,badge_id,awarded_at,award_source,note")
      .order("awarded_at", { ascending: false })
      .limit(250),
  ]);

  const firstError = catalogResult.error ?? membersResult.error ?? awardsResult.error;
  if (firstError) {
    return {
      configured: false,
      error: message(firstError),
      catalog: [],
      members: [],
      awards: [],
    };
  }

  const catalog = ((catalogResult.data ?? []) as RawCatalog[]).map(
    (badge): BadgeCatalogItem => ({
      id: badge.id,
      code: badge.code,
      label: badge.label,
      description: badge.description ?? "",
      icon: badge.icon ?? "🏅",
      category: badge.category ?? "Général",
      is_active: badge.is_active !== false,
      sort_order: Number(badge.sort_order) || 0,
    }),
  );

  const rawMembers = (membersResult.data ?? []) as RawMember[];
  const members = rawMembers
    .map(
      (member): BadgeMember => ({
        user_id: member.user_id,
        display_name: memberName(member),
        email: member.email,
      }),
    )
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "fr"));

  const badgesById = new Map(catalog.map((badge) => [badge.id, badge]));
  const membersById = new Map(members.map((member) => [member.user_id, member]));

  const awards = ((awardsResult.data ?? []) as RawAward[]).map(
    (award): BadgeAward => {
      const badge = badgesById.get(award.badge_id);
      const member = membersById.get(award.user_id);
      return {
        id: award.id,
        user_id: award.user_id,
        badge_id: award.badge_id,
        badge_label: badge?.label ?? "Badge supprimé",
        badge_icon: badge?.icon ?? "🏅",
        member_name: member?.display_name ?? "Compte Nostra",
        awarded_at: award.awarded_at,
        award_source: award.award_source ?? "manual",
        note: award.note,
      };
    },
  );

  return {
    configured: true,
    error: null,
    catalog,
    members,
    awards,
  };
}
