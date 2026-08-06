import { createClient } from "@/lib/supabase/server";

export type MoneyDropStatus =
  | "setup"
  | "question_open"
  | "allocations_locked"
  | "revealed"
  | "finished"
  | "cancelled";

export type MoneyDropOptionKey = "A" | "B" | "C" | "D";

export type MoneyDropSettings = {
  enabled: boolean;
  starting_amount: number;
  total_rounds: number;
  answer_seconds: number;
};

export type MoneyDropOption = {
  key: MoneyDropOptionKey;
  label: string;
};

export type MoneyDropQuestion = {
  id: number;
  category: string;
  question: string;
  options: MoneyDropOption[];
  correct_option: MoneyDropOptionKey | null;
  active?: boolean;
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

export type MoneyDropState = {
  configured: boolean;
  settings: MoneyDropSettings;
  game: MoneyDropGame | null;
  players: MoneyDropPlayer[];
  question: MoneyDropQuestion | null;
  allocations: Record<MoneyDropOptionKey, number>;
  history: MoneyDropRoundHistory[];
  current_user_is_player: boolean;
  current_user_is_captain: boolean;
};

export type MoneyDropCitizen = {
  user_id: string;
  name: string;
};

const emptyAllocations: Record<MoneyDropOptionKey, number> = {
  A: 0,
  B: 0,
  C: 0,
  D: 0,
};

const emptyState: MoneyDropState = {
  configured: false,
  settings: {
    enabled: false,
    starting_amount: 250_000,
    total_rounds: 8,
    answer_seconds: 60,
  },
  game: null,
  players: [],
  question: null,
  allocations: emptyAllocations,
  history: [],
  current_user_is_player: false,
  current_user_is_captain: false,
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function optionKey(value: unknown): MoneyDropOptionKey | null {
  return value === "A" || value === "B" || value === "C" || value === "D"
    ? value
    : null;
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
    if (!key || !label) return [];
    return [{ key, label }];
  });
}

function parseQuestion(value: unknown): MoneyDropQuestion | null {
  const row = record(value);
  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;

  return {
    id,
    category: String(row.category ?? "Question"),
    question: String(row.question ?? ""),
    options: parseOptions(row.options),
    correct_option: optionKey(row.correct_option),
    active: row.active !== false,
    created_at:
      typeof row.created_at === "string" ? row.created_at : undefined,
  };
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
        return [
          {
            position,
            user_id: userId,
            player_name: String(row.player_name ?? "Joueur"),
            is_captain: row.is_captain === true,
          },
        ];
      })
    : [];

  const history: MoneyDropRoundHistory[] = Array.isArray(source.history)
    ? source.history.flatMap((entry) => {
        const row = record(entry);
        const correct = optionKey(row.correct_option);
        if (!correct) return [];
        const allocations = record(row.allocations);
        return [
          {
            round_number: numberValue(row.round_number, 1),
            category: String(row.category ?? ""),
            question: String(row.question ?? ""),
            correct_option: correct,
            lost_amount: numberValue(row.lost_amount),
            remaining_amount: numberValue(row.remaining_amount),
            allocations: {
              A: numberValue(allocations.A),
              B: numberValue(allocations.B),
              C: numberValue(allocations.C),
              D: numberValue(allocations.D),
            },
          },
        ];
      })
    : [];

  const game: MoneyDropGame | null =
    source.game && Object.keys(gameRow).length > 0
      ? {
          id: String(gameRow.id ?? ""),
          status: String(gameRow.status ?? "setup") as MoneyDropStatus,
          team_name: String(gameRow.team_name ?? "Équipe Nostra"),
          starting_amount: numberValue(gameRow.starting_amount),
          current_amount: numberValue(gameRow.current_amount),
          current_round: Math.max(1, numberValue(gameRow.current_round, 1)),
          total_rounds: Math.max(1, numberValue(gameRow.total_rounds, 8)),
          current_question_id:
            gameRow.current_question_id == null
              ? null
              : Number(gameRow.current_question_id),
          round_deadline:
            typeof gameRow.round_deadline === "string"
              ? gameRow.round_deadline
              : null,
          created_at: String(gameRow.created_at ?? ""),
        }
      : null;

  return {
    configured: true,
    settings: {
      enabled: settingsRow.enabled === true,
      starting_amount: numberValue(settingsRow.starting_amount, 250_000),
      total_rounds: Math.min(
        12,
        Math.max(1, numberValue(settingsRow.total_rounds, 8)),
      ),
      answer_seconds: Math.min(
        600,
        Math.max(10, numberValue(settingsRow.answer_seconds, 60)),
      ),
    },
    game,
    players,
    question: parseQuestion(source.question),
    allocations: {
      A: numberValue(allocationRow.A),
      B: numberValue(allocationRow.B),
      C: numberValue(allocationRow.C),
      D: numberValue(allocationRow.D),
    },
    history,
    current_user_is_player: source.current_user_is_player === true,
    current_user_is_captain: source.current_user_is_captain === true,
  };
}

export async function getMoneyDropPublicState(): Promise<MoneyDropState> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc(
      "money_drop_get_public_state",
    );
    if (error || !data) return emptyState;
    return parseState(data);
  } catch {
    return emptyState;
  }
}

export async function getMoneyDropManagerState(): Promise<MoneyDropState> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc(
      "money_drop_get_manager_state",
    );
    if (error || !data) return emptyState;
    return parseState(data);
  } catch {
    return emptyState;
  }
}

export async function getMoneyDropQuestions(): Promise<MoneyDropQuestion[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("money_drop_questions")
      .select(
        "id,category,question,option_a,option_b,option_c,option_d,correct_option,active,created_at",
      )
      .order("active", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300);

    if (error || !Array.isArray(data)) return [];

    return data.flatMap((entry: Record<string, unknown>) => {
      const correct = optionKey(entry.correct_option);
      const id = Number(entry.id);
      if (!correct || !Number.isFinite(id)) return [];

      const options = (["A", "B", "C", "D"] as MoneyDropOptionKey[]).flatMap(
        (key) => {
          const label = String(entry[`option_${key.toLowerCase()}`] ?? "").trim();
          return label ? [{ key, label }] : [];
        },
      );

      return [
        {
          id,
          category: String(entry.category ?? "Question"),
          question: String(entry.question ?? ""),
          options,
          correct_option: correct,
          active: entry.active !== false,
          created_at: String(entry.created_at ?? ""),
        },
      ];
    });
  } catch {
    return [];
  }
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
        .filter(Boolean)
        .join(" ");

      return [
        {
          user_id: userId,
          name: name || String(row.discord_name ?? "Citoyen Nostra"),
        },
      ];
    });
  } catch {
    return [];
  }
}
