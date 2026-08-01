/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { cache } from "react";

import { getAvatarUrl, getRpName } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";
import type {
  CasinoConversion,
  CasinoAdminData,
  CasinoLeaderboardRow,
  CasinoProfile,
  CasinoSettings,
  CasinoWallet,
} from "@/lib/casino/types";

const DEFAULT_SETTINGS: CasinoSettings = {
  configured: false,
  publicEnabled: false,
  name: "Le Cercle Nostra",
  subtitle: "Maison de jeux privée",
  rpPerChip: 1_000,
  minConversion: 100,
  maxConversion: 100_000,
};

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export const getCasinoSettings = cache(async (): Promise<CasinoSettings> => {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("casino_settings")
      .select("public_enabled,name,subtitle,rp_per_chip,min_conversion,max_conversion")
      .eq("id", 1)
      .abortSignal(AbortSignal.timeout(1_500))
      .maybeSingle();

    if (error || !data) return DEFAULT_SETTINGS;

    return {
      configured: true,
      publicEnabled: data.public_enabled === true,
      name: stringValue(data.name, DEFAULT_SETTINGS.name),
      subtitle: stringValue(data.subtitle, DEFAULT_SETTINGS.subtitle),
      rpPerChip: Math.max(1, numberValue(data.rp_per_chip, 1_000)),
      minConversion: Math.max(1, numberValue(data.min_conversion, 100)),
      maxConversion: Math.max(1, numberValue(data.max_conversion, 100_000)),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export const getCasinoProfile = cache(async (): Promise<CasinoProfile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: member } = await supabase
    .from("member_profiles")
    .select("rp_first_name,rp_last_name,steam_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const memberName = [member?.rp_first_name, member?.rp_last_name]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
    .join(" ");

  return {
    userId: data.user.id,
    displayName: memberName || getRpName(data.user) || "Membre du Cercle",
    avatarUrl: getAvatarUrl(data.user),
    steamId:
      stringValue(member?.steam_id) ||
      stringValue(data.user.user_metadata?.steam_id) ||
      null,
  };
});

export const getCasinoWallet = cache(async (): Promise<CasinoWallet | null> => {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc("casino_my_wallet_v108");
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      balance: numberValue(row.balance),
      lifetimeWagered: numberValue(row.lifetime_wagered),
      lifetimeWon: numberValue(row.lifetime_won),
      gamesPlayed: numberValue(row.games_played),
      biggestWin: numberValue(row.biggest_win),
      level: Math.max(1, numberValue(row.level, 1)),
      xp: numberValue(row.xp),
    };
  } catch {
    return null;
  }
});

export async function getCasinoConversions(): Promise<CasinoConversion[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("casino_conversion_requests")
      .select("id,rp_amount,chip_amount,status,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({
      id: String(row.id),
      rpAmount: numberValue(row.rp_amount),
      chipAmount: numberValue(row.chip_amount),
      status: row.status as CasinoConversion["status"],
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}

export async function getCasinoLeaderboard(): Promise<CasinoLeaderboardRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc("casino_leaderboard_v108", {
      p_limit: 10,
    });
    if (error || !Array.isArray(data)) return [];
    return data.map((row: Record<string, unknown>) => ({
      userId: String(row.user_id),
      displayName: stringValue(row.display_name, "Joueur privé"),
      gamesPlayed: numberValue(row.games_played),
      lifetimeWon: numberValue(row.lifetime_won),
      biggestWin: numberValue(row.biggest_win),
      level: Math.max(1, numberValue(row.level, 1)),
    }));
  } catch {
    return [];
  }
}

export async function getCasinoAdminData(): Promise<CasinoAdminData> {
  try {
    const supabase = await createClient();
    const [overviewResult, citizensResult] = await Promise.all([
      (supabase as any).rpc("casino_admin_overview_v108"),
      (supabase as any).rpc("nostra_citizen_directory"),
    ]);
    const { data, error } = overviewResult;
    const citizenRows = Array.isArray(citizensResult.data)
      ? citizensResult.data
      : [];
    const citizens = citizenRows
      .map((row: Record<string, unknown>) => ({
        userId: stringValue(row.user_id),
        displayName: stringValue(row.name, "Compte citoyen"),
      }))
      .filter((citizen: { userId: string }) => Boolean(citizen.userId))
      .sort((a: { displayName: string }, b: { displayName: string }) =>
        a.displayName.localeCompare(b.displayName, "fr"),
      );
    if (error || !data) return { conversions: [], wallets: [], citizens };
    const source = data as Record<string, unknown>;
    const conversions = Array.isArray(source.conversions) ? source.conversions : [];
    const wallets = Array.isArray(source.wallets) ? source.wallets : [];
    return {
      conversions: conversions.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        userId: String(row.user_id),
        citizenName: stringValue(row.display_name, "Citoyen Nostra"),
        rpAmount: numberValue(row.rp_amount),
        chipAmount: numberValue(row.chip_amount),
        status: row.status as CasinoConversion["status"],
        createdAt: String(row.created_at),
      })),
      wallets: wallets.map((row: Record<string, unknown>) => ({
        userId: String(row.user_id),
        displayName: stringValue(row.display_name, "Citoyen Nostra"),
        balance: numberValue(row.balance),
        lifetimeWagered: numberValue(row.lifetime_wagered),
        lifetimeWon: numberValue(row.lifetime_won),
        gamesPlayed: numberValue(row.games_played),
        biggestWin: numberValue(row.biggest_win),
        level: Math.max(1, numberValue(row.level, 1)),
        xp: numberValue(row.xp),
      })),
      citizens,
    };
  } catch {
    return { conversions: [], wallets: [], citizens: [] };
  }
}
