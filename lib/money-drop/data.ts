import { createClient } from "@/lib/supabase/server";

export type MoneyDropStatus =
  | "setup"
  | "question_open"
  | "allocations_locked"
  | "revealed"
  | "finished"
  | "cancelled";

export type MoneyDropOptionKey = "A" | "B" | "C" | "D";
export type MoneyDropGameMode = "classic" | "express" | "event";
export type MoneyDropDifficulty = "Facile" | "Moyenne" | "Difficile" | "Expert" | "Finale";

export type MoneyDropSettings = {
  enabled: boolean;
  starting_amount: number;
  total_rounds: number;
  answer_seconds: number;
  public_registration_enabled: boolean;
  spectator_enabled: boolean;
  sounds_enabled: boolean;
  jokers_enabled: boolean;
};

export type MoneyDropOption = {
  key: MoneyDropOptionKey;
  label: string;
};

export type MoneyDropQuestion = {
  id: number;
  category: string;
  difficulty: MoneyDropDifficulty;
  question: string;
  options: MoneyDropOption[];
  correct_option: MoneyDropOptionKey | null;
  active?: boolean;
  is_final?: boolean;
  created_at?: string;
};

export type MoneyDropPlayer = {
  position: number;
  user_id: string;
  player_name: string;
  is_captain: boolean;
};

export type MoneyDropGame = {
  id: string;
  status: MoneyDropStatus;
  team_name: string;
  starting_amount: number;
  current_amount: number;
  current_round: number;
  total_rounds: number;
  current_question_id: number | null;
  round_deadline: string | null;
  created_at: string;
  finished_at?: string | null;
  game_mode: MoneyDropGameMode;
  answer_seconds: number;
  join_code: string | null;
  joker_time_used: boolean;
  joker_hint_used: boolean;
  joker_change_used: boolean;
  hint_removed_option: MoneyDropOptionKey | null;
};

export type MoneyDropRoundHistory = {
  round_number: number;
  category: string;
  question: string;
  correct_option: MoneyDropOptionKey;
  lost_amount: number;
  remaining_amount: number;
  allocations: Record<MoneyDropOptionKey, number>;
};

export type MoneyDropRegistration = {
  user_id: string;
  player_name: string;
  created_at: string;
};

export type MoneyDropLeaderboardEntry = {
  id: string;
  team_name: string;
  final_amount: number;
  starting_amount: number;
  game_mode: MoneyDropGameMode;
  finished_at: string | null;
  players: string;
};

export type MoneyDropState = {
  configured: boolean;
  settings: MoneyDropSettings;
  game: MoneyDropGame | null;
  players: MoneyDropPlayer[];
  question: MoneyDropQuestion | null;
  allocations: Record<MoneyDropOptionKey, number>;
  history: MoneyDropRoundHistory[];
  registrations: MoneyDropRegistration[];
  leaderboard: MoneyDropLeaderboardEntry[];
  recent_games: MoneyDropLeaderboardEntry[];
  current_user_is_registered: boolean;
  current_user_is_player: boolean;
  current_user_is_captain: boolean;
};

export type MoneyDropCitizen = {
  user_id: string;
  name: string;
};

const emptyAllocations: Record<MoneyDropOptionKey, number> = { A: 0, B: 0, C: 0, D: 0 };

const emptyState: MoneyDropState = {
  configured: false,
  settings: {
    enabled: false,
    starting_amount: 250_000,
    total_rounds: 8,
    answer_seconds: 60,
    public_registration_enabled: false,
    spectator_enabled: true,
    sounds_enabled: true,
    jokers_enabled: true,
  },
  game: null,
  players: [],
  question: null,
  allocations: emptyAllocations,
  history: [],
  registrations: [],
  leaderboard: [],
  recent_games: [],
  current_user_is_registered: false,
  current_user_is_player: false,
  current_user_is_captain: false,
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function optionKey(value: unknown): MoneyDropOptionKey | null {
  return value === "A" || value === "B" || value === "C" || value === "D" ? value : null;
}

function difficulty(value: unknown): MoneyDropDifficulty {
  if (value === "Facile" || value === "Moyenne" || value === "Difficile" || value === "Expert" || value === "Finale") return value;
  return "Moyenne";
}

function gameMode(value: unknown): MoneyDropGameMode {
  return value === "express" || value === "event" ? value : "classic";
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function parseOptions(value: unknown): MoneyDropOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = record(entry);
    const key = optionKey(row.key);
    const label = String(row.label ?? "").trim();
    return key && label ? [{ key, label }] : [];
  });
}

function parseQuestion(value: unknown): MoneyDropQuestion | null {
  const row = record(value);
  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    category: String(row.category ?? "Question"),
    difficulty: difficulty(row.difficulty),
    question: String(row.question ?? ""),
    options: parseOptions(row.options),
    correct_option: optionKey(row.correct_option),
    active: row.active !== false,
    is_final: row.is_final === true,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

function parseLeaderboard(value: unknown): MoneyDropLeaderboardEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = record(entry);
    const id = String(row.id ?? "");
    if (!id) return [];
    return [{
      id,
      team_name: String(row.team_name ?? "Équipe Nostra"),
      final_amount: numberValue(row.final_amount),
      starting_amount: numberValue(row.starting_amount),
      game_mode: gameMode(row.game_mode),
      finished_at: typeof row.finished_at === "string" ? row.finished_at : null,
      players: String(row.players ?? ""),
    }];
  });
}

function parseState(value: unknown): MoneyDropState {
  const source = record(value);
  if (source.configured !== true) return emptyState;
  const settingsRow = record(source.settings);
  const gameRow = record(source.game);
  const allocationRow = record(source.allocations);

  const players: MoneyDropPlayer[] = Array.isArray(source.players)
    ? source.players.flatMap((entry) => {
        const row = record(entry);
        const position = Number(row.position);
        const userId = String(row.user_id ?? "");
        if (!Number.isFinite(position) || !userId) return [];
        return [{ position, user_id: userId, player_name: String(row.player_name ?? "Joueur"), is_captain: row.is_captain === true }];
      })
    : [];

  const history: MoneyDropRoundHistory[] = Array.isArray(source.history)
    ? source.history.flatMap((entry) => {
        const row = record(entry);
        const correct = optionKey(row.correct_option);
        if (!correct) return [];
        const allocations = record(row.allocations);
        return [{
          round_number: numberValue(row.round_number, 1),
          category: String(row.category ?? ""),
          question: String(row.question ?? ""),
          correct_option: correct,
          lost_amount: numberValue(row.lost_amount),
          remaining_amount: numberValue(row.remaining_amount),
          allocations: {
            A: numberValue(allocations.A), B: numberValue(allocations.B),
            C: numberValue(allocations.C), D: numberValue(allocations.D),
          },
        }];
      })
    : [];

  const registrations: MoneyDropRegistration[] = Array.isArray(source.registrations)
    ? source.registrations.flatMap((entry) => {
        const row = record(entry);
        const userId = String(row.user_id ?? "");
        if (!userId) return [];
        return [{ user_id: userId, player_name: String(row.player_name ?? "Citoyen Nostra"), created_at: String(row.created_at ?? "") }];
      })
    : [];

  const game: MoneyDropGame | null = source.game && Object.keys(gameRow).length > 0
    ? {
        id: String(gameRow.id ?? ""),
        status: String(gameRow.status ?? "setup") as MoneyDropStatus,
        team_name: String(gameRow.team_name ?? "Équipe Nostra"),
        starting_amount: numberValue(gameRow.starting_amount),
        current_amount: numberValue(gameRow.current_amount),
        current_round: Math.max(1, numberValue(gameRow.current_round, 1)),
        total_rounds: Math.max(1, numberValue(gameRow.total_rounds, 8)),
        current_question_id: gameRow.current_question_id == null ? null : Number(gameRow.current_question_id),
        round_deadline: typeof gameRow.round_deadline === "string" ? gameRow.round_deadline : null,
        created_at: String(gameRow.created_at ?? ""),
        finished_at: typeof gameRow.finished_at === "string" ? gameRow.finished_at : null,
        game_mode: gameMode(gameRow.game_mode),
        answer_seconds: Math.max(10, numberValue(gameRow.answer_seconds, 60)),
        join_code: typeof gameRow.join_code === "string" ? gameRow.join_code : null,
        joker_time_used: gameRow.joker_time_used === true,
        joker_hint_used: gameRow.joker_hint_used === true,
        joker_change_used: gameRow.joker_change_used === true,
        hint_removed_option: optionKey(gameRow.hint_removed_option),
      }
    : null;

  return {
    configured: true,
    settings: {
      enabled: settingsRow.enabled === true,
      starting_amount: numberValue(settingsRow.starting_amount, 250_000),
      total_rounds: Math.min(12, Math.max(1, numberValue(settingsRow.total_rounds, 8))),
      answer_seconds: Math.min(600, Math.max(10, numberValue(settingsRow.answer_seconds, 60))),
      public_registration_enabled: settingsRow.public_registration_enabled === true,
      spectator_enabled: settingsRow.spectator_enabled !== false,
      sounds_enabled: settingsRow.sounds_enabled !== false,
      jokers_enabled: settingsRow.jokers_enabled !== false,
    },
    game,
    players,
    question: parseQuestion(source.question),
    allocations: {
      A: numberValue(allocationRow.A), B: numberValue(allocationRow.B),
      C: numberValue(allocationRow.C), D: numberValue(allocationRow.D),
    },
    history,
    registrations,
    leaderboard: parseLeaderboard(source.leaderboard),
    recent_games: parseLeaderboard(source.recent_games),
    current_user_is_registered: source.current_user_is_registered === true,
    current_user_is_player: source.current_user_is_player === true,
    current_user_is_captain: source.current_user_is_captain === true,
  };
}

export async function getMoneyDropPublicState(): Promise<MoneyDropState> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc("money_drop_get_public_state");
    if (error || !data) return emptyState;
    return parseState(data);
  } catch { return emptyState; }
}

export async function getMoneyDropManagerState(): Promise<MoneyDropState> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc("money_drop_get_manager_state");
    if (error || !data) return emptyState;
    return parseState(data);
  } catch { return emptyState; }
}

export async function getMoneyDropQuestions(): Promise<MoneyDropQuestion[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("money_drop_questions")
      .select("id,category,difficulty,question,option_a,option_b,option_c,option_d,correct_option,active,is_final,created_at")
      .order("active", { ascending: false })
      .order("category", { ascending: true })
      .order("question", { ascending: true })
      .limit(1000);
    if (error || !Array.isArray(data)) return [];
    return data.flatMap((entry: Record<string, unknown>) => {
      const correct = optionKey(entry.correct_option);
      const id = Number(entry.id);
      if (!correct || !Number.isFinite(id)) return [];
      const options = (["A", "B", "C", "D"] as MoneyDropOptionKey[]).flatMap((key) => {
        const label = String(entry[`option_${key.toLowerCase()}`] ?? "").trim();
        return label ? [{ key, label }] : [];
      });
      return [{
        id,
        category: String(entry.category ?? "Question"),
        difficulty: difficulty(entry.difficulty),
        question: String(entry.question ?? ""),
        options,
        correct_option: correct,
        active: entry.active !== false,
        is_final: entry.is_final === true,
        created_at: String(entry.created_at ?? ""),
      }];
    });
  } catch { return []; }
}

export async function getMoneyDropCitizens(): Promise<MoneyDropCitizen[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("member_profiles")
      .select("user_id,rp_first_name,rp_last_name,discord_name")
      .order("rp_first_name", { ascending: true })
      .order("rp_last_name", { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.flatMap((row: Record<string, unknown>) => {
      const userId = String(row.user_id ?? "");
      if (!userId) return [];
      const name = [row.rp_first_name, row.rp_last_name]
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean).join(" ");
      return [{ user_id: userId, name: name || String(row.discord_name ?? "Citoyen Nostra") }];
    });
  } catch { return []; }
}
