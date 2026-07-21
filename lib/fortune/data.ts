import { createClient } from "@/lib/supabase/server";

export type FortuneWheelType = "normal" | "final" | "none";
export type FortuneGameStatus =
  | "setup"
  | "active"
  | "between_rounds"
  | "finale"
  | "finished"
  | "cancelled";
export type FortuneTurnPhase =
  | "waiting"
  | "must_spin"
  | "choose_consonant"
  | "can_act"
  | "final_spin"
  | "final_answer"
  | "finished";
export type FortuneSegmentType =
  | "cash"
  | "bankrupt"
  | "lose_turn"
  | "jackpot"
  | "free_turn"
  | "prize";

export type FortuneSettings = {
  enabled: boolean;
  visible_wheel: FortuneWheelType;
  jackpot_amount: number;
  jackpot_increment: number;
  vowel_cost: number;
};

export type FortuneSegment = {
  id: number;
  wheel_type: "normal" | "final";
  position: number;
  segment_type: FortuneSegmentType;
  label: string;
  value: number;
  color: string;
  active: boolean;
};

export type FortunePlayer = {
  position: number;
  user_id: string;
  player_name: string;
  round_bank: number;
  secured_bank: number;
  free_turns: number;
  is_active: boolean;
};

export type FortuneRound = {
  round_number: number;
  category: string;
  masked_puzzle: string;
  revealed_letters: string[];
  status: "waiting" | "active" | "won";
  starting_position: number | null;
  winner_position: number | null;
};

export type FortuneGame = {
  id: string;
  status: FortuneGameStatus;
  player_count: number;
  current_round: number;
  active_player_position: number | null;
  turn_phase: FortuneTurnPhase;
  last_spin_label: string | null;
  last_spin_type: FortuneSegmentType | null;
  last_spin_value: number;
  last_spin_position: number | null;
  spin_sequence: number;
  spin_started_at: string | null;
  spin_duration_ms: number;
  jackpot_armed: boolean;
  final_category: string | null;
  final_masked_puzzle: string | null;
  final_revealed_letters: string[];
  final_prize_label: string | null;
  final_prize_value: number;
  final_result: "waiting" | "won" | "lost";
};

export type FortuneState = {
  configured: boolean;
  settings: FortuneSettings;
  game: FortuneGame | null;
  players: FortunePlayer[];
  round: FortuneRound | null;
  normalWheel: FortuneSegment[];
  finalWheel: FortuneSegment[];
  currentUserPosition: number | null;
};

export type FortuneManagerRound = {
  round_number: number;
  category: string;
  solution: string;
  status: "waiting" | "active" | "won";
  starting_position: number | null;
  winner_position: number | null;
};

export type FortuneCitizen = {
  user_id: string;
  name: string;
};

const emptyState: FortuneState = {
  configured: false,
  settings: {
    enabled: false,
    visible_wheel: "none",
    jackpot_amount: 0,
    jackpot_increment: 100,
    vowel_cost: 250,
  },
  game: null,
  players: [],
  round: null,
  normalWheel: [],
  finalWheel: [],
  currentUserPosition: null,
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function segment(value: unknown): FortuneSegment | null {
  const row = record(value);
  const id = Number(row.id);
  const position = Number(row.position);

  if (!Number.isFinite(id) || !Number.isFinite(position)) {
    return null;
  }

  const allowed: FortuneSegmentType[] = [
    "cash",
    "bankrupt",
    "lose_turn",
    "jackpot",
    "free_turn",
    "prize",
  ];

  const kind = allowed.includes(
    row.segment_type as FortuneSegmentType,
  )
    ? (row.segment_type as FortuneSegmentType)
    : "cash";

  return {
    id,
    wheel_type: row.wheel_type === "final" ? "final" : "normal",
    position,
    segment_type: kind,
    label: String(row.label ?? ""),
    value: Math.max(0, Number(row.value) || 0),
    color: String(row.color ?? "#c49a26"),
    active: row.active !== false,
  };
}

export async function getFortunePublicState(): Promise<FortuneState> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc(
      "fortune_get_public_state",
    );

    if (error || !data) return emptyState;

    const source = record(data);
    const settingsSource = record(source.settings);
    const gameSource = record(source.game);
    const roundSource = record(source.round);

    const visibleWheel: FortuneWheelType =
      settingsSource.visible_wheel === "normal" ||
      settingsSource.visible_wheel === "final"
        ? settingsSource.visible_wheel
        : "none";

    const settings: FortuneSettings = {
      enabled: settingsSource.enabled === true,
      visible_wheel: visibleWheel,
      jackpot_amount: Math.max(
        0,
        Number(settingsSource.jackpot_amount) || 0,
      ),
      jackpot_increment: Math.max(
        0,
        Number(settingsSource.jackpot_increment) || 100,
      ),
      vowel_cost: Math.max(
        0,
        Number(settingsSource.vowel_cost) || 250,
      ),
    };

    const players: FortunePlayer[] = Array.isArray(source.players)
      ? source.players.flatMap((value) => {
          const row = record(value);
          const position = Number(row.position);

          if (!Number.isFinite(position)) return [];

          return [
            {
              position,
              user_id: String(row.user_id ?? ""),
              player_name: String(row.player_name ?? "Joueur"),
              round_bank: Math.max(
                0,
                Number(row.round_bank) || 0,
              ),
              secured_bank: Math.max(
                0,
                Number(row.secured_bank) || 0,
              ),
              free_turns: Math.max(
                0,
                Number(row.free_turns) || 0,
              ),
              is_active: row.is_active === true,
            },
          ];
        })
      : [];

    const normalWheel = Array.isArray(source.normal_wheel)
      ? source.normal_wheel
          .map(segment)
          .filter(
            (value): value is FortuneSegment => value !== null,
          )
          .sort((a, b) => a.position - b.position)
      : [];

    const finalWheel = Array.isArray(source.final_wheel)
      ? source.final_wheel
          .map(segment)
          .filter(
            (value): value is FortuneSegment => value !== null,
          )
          .sort((a, b) => a.position - b.position)
      : [];

    const game: FortuneGame | null =
      source.game && Object.keys(gameSource).length > 0
        ? {
            id: String(gameSource.id ?? ""),
            status: String(
              gameSource.status ?? "setup",
            ) as FortuneGameStatus,
            player_count: Math.min(
              6,
              Math.max(
                1,
                Number(gameSource.player_count) ||
                  players.length ||
                  1,
              ),
            ),
            current_round: Math.max(
              1,
              Number(gameSource.current_round) || 1,
            ),
            active_player_position:
              gameSource.active_player_position == null
                ? null
                : Number(gameSource.active_player_position),
            turn_phase: String(
              gameSource.turn_phase ?? "waiting",
            ) as FortuneTurnPhase,
            last_spin_label:
              typeof gameSource.last_spin_label === "string"
                ? gameSource.last_spin_label
                : null,
            last_spin_type:
              typeof gameSource.last_spin_type === "string"
                ? (gameSource.last_spin_type as FortuneSegmentType)
                : null,
            last_spin_value: Math.max(
              0,
              Number(gameSource.last_spin_value) || 0,
            ),
            last_spin_position:
              gameSource.last_spin_position == null
                ? null
                : Number(gameSource.last_spin_position),
            spin_sequence: Math.max(
              0,
              Number(gameSource.spin_sequence) || 0,
            ),
            spin_started_at:
              typeof gameSource.spin_started_at === "string"
                ? gameSource.spin_started_at
                : null,
            spin_duration_ms: Math.max(
              500,
              Number(gameSource.spin_duration_ms) || 3600,
            ),
            jackpot_armed: gameSource.jackpot_armed === true,
            final_category:
              typeof gameSource.final_category === "string"
                ? gameSource.final_category
                : null,
            final_masked_puzzle:
              typeof gameSource.final_masked_puzzle === "string"
                ? gameSource.final_masked_puzzle
                : null,
            final_revealed_letters: Array.isArray(
              gameSource.final_revealed_letters,
            )
              ? gameSource.final_revealed_letters.map(String)
              : [],
            final_prize_label:
              typeof gameSource.final_prize_label === "string"
                ? gameSource.final_prize_label
                : null,
            final_prize_value: Math.max(
              0,
              Number(gameSource.final_prize_value) || 0,
            ),
            final_result:
              gameSource.final_result === "won" ||
              gameSource.final_result === "lost"
                ? gameSource.final_result
                : "waiting",
          }
        : null;

    const round: FortuneRound | null =
      source.round && Object.keys(roundSource).length > 0
        ? {
            round_number: Math.max(
              1,
              Number(roundSource.round_number) || 1,
            ),
            category: String(roundSource.category ?? ""),
            masked_puzzle: String(
              roundSource.masked_puzzle ?? "",
            ),
            revealed_letters: Array.isArray(
              roundSource.revealed_letters,
            )
              ? roundSource.revealed_letters.map(String)
              : [],
            status:
              roundSource.status === "active" ||
              roundSource.status === "won"
                ? roundSource.status
                : "waiting",
            starting_position:
              roundSource.starting_position == null
                ? null
                : Number(roundSource.starting_position),
            winner_position:
              roundSource.winner_position == null
                ? null
                : Number(roundSource.winner_position),
          }
        : null;

    return {
      configured: source.configured === true,
      settings,
      game,
      players,
      round,
      normalWheel,
      finalWheel,
      currentUserPosition:
        source.current_user_position == null
          ? null
          : Number(source.current_user_position),
    };
  } catch {
    return emptyState;
  }
}

export async function getFortuneManagerRounds(
  gameId: string | null,
): Promise<FortuneManagerRound[]> {
  if (!gameId) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("fortune_rounds")
      .select(
        "round_number,category,solution,status,starting_position,winner_position",
      )
      .eq("game_id", gameId)
      .order("round_number", { ascending: true });

    if (error || !data) return [];

    return data.map(
      (row: Record<string, unknown>): FortuneManagerRound => ({
        round_number: Number(row.round_number),
        category: String(row.category ?? ""),
        solution: String(row.solution ?? ""),
        status:
          row.status === "active" || row.status === "won"
            ? row.status
            : "waiting",
        starting_position:
          row.starting_position == null
            ? null
            : Number(row.starting_position),
        winner_position:
          row.winner_position == null
            ? null
            : Number(row.winner_position),
      }),
    );
  } catch {
    return [];
  }
}

export async function getFortuneCitizens(): Promise<FortuneCitizen[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("member_profiles")
      .select(
        "user_id,rp_first_name,rp_last_name,discord_name",
      )
      .order("rp_first_name", { ascending: true })
      .order("rp_last_name", { ascending: true });

    if (error || !data) return [];

    return data.flatMap((row: Record<string, unknown>) => {
      const userId = String(row.user_id ?? "");
      if (!userId) return [];

      const rpName = [
        typeof row.rp_first_name === "string"
          ? row.rp_first_name.trim()
          : "",
        typeof row.rp_last_name === "string"
          ? row.rp_last_name.trim()
          : "",
      ]
        .filter(Boolean)
        .join(" ");

      return [
        {
          user_id: userId,
          name:
            rpName ||
            String(row.discord_name ?? "Citoyen Nostra"),
        },
      ];
    });
  } catch {
    return [];
  }
}
