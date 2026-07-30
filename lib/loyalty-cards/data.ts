import { createClient } from "@/lib/supabase/server";

export type LoyaltyTier = "Silver" | "Gold" | "Black Signature";

export type LoyaltyCardTemplate = {
  tier: LoyaltyTier;
  label: string;
  image_url: string | null;
  enabled: boolean;
  updated_at: string;
};

export type LoyaltyCard = {
  id: number;
  user_id: string;
  card_number: string;
  tier: LoyaltyTier;
  first_name: string;
  last_name: string;
  template_image_url: string | null;
  active: boolean;
  issued_at: string;
  deactivated_at: string | null;
  deactivation_reason: string | null;
};

export type LoyaltyCitizenRow = {
  user_id: string;
  rp_first_name: string | null;
  rp_last_name: string | null;
  discord_name: string | null;
  tier: string | null;
  purchases_count: number;
  discount_percent: number;
  active_card: LoyaltyCard | null;
};

export async function getActiveLoyaltyCard(
  userId: string,
): Promise<LoyaltyCard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loyalty_cards")
    .select(
      "id,user_id,card_number,tier,first_name,last_name,template_image_url,active,issued_at,deactivated_at,deactivation_reason",
    )
    .eq("user_id", userId)
    .eq("active", true)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data ?? null) as LoyaltyCard | null;
}

export async function getLoyaltyCardTemplates(): Promise<{
  configured: boolean;
  templates: LoyaltyCardTemplate[];
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("loyalty_card_templates")
    .select("tier,label,image_url,enabled,updated_at")
    .order("tier");

  return {
    configured: !error,
    templates: (data ?? []) as LoyaltyCardTemplate[],
  };
}

export async function getLoyaltyCitizens(): Promise<{
  configured: boolean;
  citizens: LoyaltyCitizenRow[];
  templates: LoyaltyCardTemplate[];
}> {
  const supabase = await createClient();
  const [profiles, loyalty, cards, templates] = await Promise.all([
    supabase
      .from("member_profiles")
      .select("user_id,rp_first_name,rp_last_name,discord_name")
      .order("rp_last_name")
      .order("rp_first_name"),
    supabase
      .from("loyalty_profiles")
      .select("user_id,tier,purchases_count,discount_percent"),
    supabase
      .from("loyalty_cards")
      .select(
        "id,user_id,card_number,tier,first_name,last_name,template_image_url,active,issued_at,deactivated_at,deactivation_reason",
      )
      .eq("active", true)
      .order("issued_at", { ascending: false }),
    supabase
      .from("loyalty_card_templates")
      .select("tier,label,image_url,enabled,updated_at")
      .order("tier"),
  ]);

  const loyaltyByUser = new Map<string, Record<string, unknown>>(
    (loyalty.data ?? []).map((row) => [
      String((row as Record<string, unknown>).user_id),
      row as Record<string, unknown>,
    ]),
  );
  const cardByUser = new Map<string, LoyaltyCard>();
  for (const row of cards.data ?? []) {
    const key = String(row.user_id);
    if (!cardByUser.has(key)) cardByUser.set(key, row as LoyaltyCard);
  }

  const citizens = (profiles.data ?? []).map((profile) => {
    const loyaltyProfile = loyaltyByUser.get(String(profile.user_id));
    return {
      user_id: String(profile.user_id),
      rp_first_name: profile.rp_first_name,
      rp_last_name: profile.rp_last_name,
      discord_name: profile.discord_name,
      tier: loyaltyProfile?.tier ? String(loyaltyProfile.tier) : null,
      purchases_count: Number(loyaltyProfile?.purchases_count ?? 0),
      discount_percent: Number(loyaltyProfile?.discount_percent ?? 0),
      active_card: cardByUser.get(String(profile.user_id)) ?? null,
    } satisfies LoyaltyCitizenRow;
  });

  return {
    configured:
      !profiles.error && !loyalty.error && !cards.error && !templates.error,
    citizens,
    templates: (templates.data ?? []) as LoyaltyCardTemplate[],
  };
}
