/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { cache } from "react";

import { getAvatarUrl, getRpName } from "@/lib/auth/user-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  CasinoConversion,
  CasinoAdminData,
  CasinoDifficulty,
  CasinoGameKey,
  CasinoGameSettings,
  CasinoLeaderboardRow,
  CasinoProfile,
  CasinoSettings,
  CasinoWallet,
} from "@/lib/casino/types";
import { CASINO_GAMES } from "@/lib/casino/types";

const DEFAULT_SETTINGS: CasinoSettings = {
  configured: false,
  publicEnabled: false,
  name: "Le Cercle Nostra",
  subtitle: "Maison de jeux privée",
  rpPerChip: 1_000,
  minConversion: 100,
  maxConversion: 100_000,
};

export const DEFAULT_GAME_SETTINGS: Record<CasinoGameKey, CasinoGameSettings> = {
  poker: { game: "poker", enabled: true, difficulty: "hard", winRatePercent: 30, minBet: 100, maxBet: 50_000, baseMultiplier: 4, jackpotMultiplier: 6, maxPayout: 250_000 },
  blackjack: { game: "blackjack", enabled: true, difficulty: "hard", winRatePercent: 34, minBet: 50, maxBet: 25_000, baseMultiplier: 2, jackpotMultiplier: 2.5, maxPayout: 100_000 },
  roulette: { game: "roulette", enabled: true, difficulty: "hard", winRatePercent: 38, minBet: 50, maxBet: 25_000, baseMultiplier: 2, jackpotMultiplier: 36, maxPayout: 250_000 },
  slots: { game: "slots", enabled: true, difficulty: "expert", winRatePercent: 20, minBet: 25, maxBet: 10_000, baseMultiplier: 2, jackpotMultiplier: 25, maxPayout: 250_000 },
  dice: { game: "dice", enabled: true, difficulty: "hard", winRatePercent: 40, minBet: 25, maxBet: 20_000, baseMultiplier: 1.9, jackpotMultiplier: 4, maxPayout: 100_000 },
  plinko: { game: "plinko", enabled: true, difficulty: "expert", winRatePercent: 28, minBet: 25, maxBet: 20_000, baseMultiplier: 1.6, jackpotMultiplier: 12, maxPayout: 150_000 },
  coinflip: { game: "coinflip", enabled: true, difficulty: "hard", winRatePercent: 40, minBet: 25, maxBet: 20_000, baseMultiplier: 1.9, jackpotMultiplier: 3, maxPayout: 100_000 },
};

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function gameSettingsRow(row: Record<string, unknown>): CasinoGameSettings | null {
  const game = stringValue(row.game) as CasinoGameKey;
  if (!CASINO_GAMES.includes(game)) return null;
  const fallback = DEFAULT_GAME_SETTINGS[game];
  const difficulty = stringValue(row.difficulty, fallback.difficulty) as CasinoDifficulty;
  return {
    game,
    enabled: row.enabled !== false,
    difficulty: ["balanced", "hard", "expert", "custom"].includes(difficulty) ? difficulty : fallback.difficulty,
    winRatePercent: Math.min(95, Math.max(1, numberValue(row.win_rate_percent, fallback.winRatePercent))),
    minBet: Math.max(1, numberValue(row.min_bet, fallback.minBet)),
    maxBet: Math.max(1, numberValue(row.max_bet, fallback.maxBet)),
    baseMultiplier: Math.max(0.1, numberValue(row.base_multiplier, fallback.baseMultiplier)),
    jackpotMultiplier: Math.max(0.1, numberValue(row.jackpot_multiplier, fallback.jackpotMultiplier)),
    maxPayout: Math.max(1, numberValue(row.max_payout, fallback.maxPayout)),
  };
}

export const getCasinoGameSettings = cache(async (): Promise<CasinoGameSettings[]> => {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc("casino_public_game_settings_v110");
    if (error || !Array.isArray(data)) return CASINO_GAMES.map((game) => DEFAULT_GAME_SETTINGS[game]);
    const parsed = data
      .map((row: Record<string, unknown>) => gameSettingsRow(row))
      .filter((row: CasinoGameSettings | null): row is CasinoGameSettings => Boolean(row));
    const byGame = new Map(parsed.map((row) => [row.game, row]));
    return CASINO_GAMES.map((game) => byGame.get(game) ?? DEFAULT_GAME_SETTINGS[game]);
  } catch {
    return CASINO_GAMES.map((game) => DEFAULT_GAME_SETTINGS[game]);
  }
});

export async function getCasinoServerGameSettings(game: CasinoGameKey): Promise<CasinoGameSettings> {
  try {
    const admin = createAdminClient();
    const { data, error } = await (admin as any)
      .from("casino_game_settings")
      .select("game,enabled,difficulty,win_rate_percent,min_bet,max_bet,base_multiplier,jackpot_multiplier,max_payout")
      .eq("game", game)
      .maybeSingle();
    const parsed = data && !error ? gameSettingsRow(data as Record<string, unknown>) : null;
    return parsed ?? DEFAULT_GAME_SETTINGS[game];
  } catch {
    return DEFAULT_GAME_SETTINGS[game];
  }
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
    const [overviewResult, citizensResult, controlResult] = await Promise.all([
      (supabase as any).rpc("casino_admin_overview_v108"),
      (supabase as any).rpc("nostra_citizen_directory"),
      (supabase as any).rpc("casino_admin_control_v110"),
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
    const control = controlResult.data && typeof controlResult.data === "object"
      ? controlResult.data as Record<string, unknown>
      : {};
    const settingsRows = Array.isArray(control.games) ? control.games : [];
    const statsRows = Array.isArray(control.stats) ? control.stats : [];
    const roundRows = Array.isArray(control.rounds) ? control.rounds : [];
    const parsedSettings = settingsRows
      .map((row: Record<string, unknown>) => gameSettingsRow(row))
      .filter((row: CasinoGameSettings | null): row is CasinoGameSettings => Boolean(row));
    const settingsByGame = new Map(parsedSettings.map((row) => [row.game, row]));
    const gameSettings = CASINO_GAMES.map((game) => settingsByGame.get(game) ?? DEFAULT_GAME_SETTINGS[game]);
    const gameStats = statsRows.map((row: Record<string, unknown>) => {
      const wagered = numberValue(row.wagered);
      const paid = numberValue(row.paid);
      return {
        game: stringValue(row.game) as CasinoGameKey,
        rounds: numberValue(row.rounds),
        wagered,
        paid,
        houseProfit: wagered - paid,
        rtpPercent: wagered > 0 ? Math.round((paid / wagered) * 10_000) / 100 : 0,
      };
    }).filter((row: { game: CasinoGameKey }) => CASINO_GAMES.includes(row.game));
    const recentRounds = roundRows.map((row: Record<string, unknown>) => ({
      id: stringValue(row.id),
      userId: stringValue(row.user_id),
      citizenName: stringValue(row.display_name, "Citoyen Nostra"),
      game: stringValue(row.game) as CasinoGameKey,
      wager: numberValue(row.wager),
      payout: numberValue(row.payout),
      status: stringValue(row.status, "settled") as "pending" | "settled" | "refunded",
      createdAt: stringValue(row.created_at),
    })).filter((row: { id: string; game: CasinoGameKey }) => Boolean(row.id) && CASINO_GAMES.includes(row.game));
    if (error || !data) return { conversions: [], wallets: [], citizens, gameSettings, gameStats, recentRounds };
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
      gameSettings,
      gameStats,
      recentRounds,
    };
  } catch {
    return {
      conversions: [],
      wallets: [],
      citizens: [],
      gameSettings: CASINO_GAMES.map((game) => DEFAULT_GAME_SETTINGS[game]),
      gameStats: [],
      recentRounds: [],
    };
  }
}
