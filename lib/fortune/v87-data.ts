import { createClient } from "@/lib/supabase/server";

export type FortuneExtraStateV87 = {
  configured: boolean;
  game_id: string | null;
  turn_deadline: string | null;
  turn_duration_seconds: number;
  buzzer_active: boolean;
  buzzer_user_id: string | null;
  buzzer_player_position: number | null;
  buzzer_player_name: string | null;
  buzzer_at: string | null;
  pending_special_action: "divide_bank" | "swap_bank" | null;
  pending_actor_position: number | null;
  pending_actor_name: string | null;
  pending_special_label: string | null;
};

export type FortunePuzzleBankItemV87 = {
  id: number;
  category: string;
  solution: string;
  difficulty: string;
  active: boolean;
  used_count: number;
  last_used_at: string | null;
  created_at: string;
};

export type FortuneHistoryItemV87 = {
  id: number;
  game_id: string;
  winner_user_id: string | null;
  winner_name: string | null;
  winner_position: number | null;
  player_count: number;
  total_prize: number;
  final_result: string | null;
  status: string;
  finished_at: string;
  snapshot: Record<string, unknown>;
};

export type FortuneSegmentV87 = {
  id: number;
  wheel_type: "normal" | "final";
  position: number;
  segment_type: string;
  label: string;
  value: number;
  color: string;
  active: boolean;
};

const emptyExtra: FortuneExtraStateV87 = {
  configured: false,
  game_id: null,
  turn_deadline: null,
  turn_duration_seconds: 30,
  buzzer_active: false,
  buzzer_user_id: null,
  buzzer_player_position: null,
  buzzer_player_name: null,
  buzzer_at: null,
  pending_special_action: null,
  pending_actor_position: null,
  pending_actor_name: null,
  pending_special_label: null,
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export async function getFortuneExtraStateV87(
  gameId: string | null,
): Promise<FortuneExtraStateV87> {
  if (!gameId) return emptyExtra;

  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc(
      "fortune_get_extra_state_v87",
      { p_game_id: gameId },
    );

    if (error || !data) return emptyExtra;
    const row = record(data);
    const special = String(row.pending_special_action ?? "");

    return {
      configured: row.configured === true,
      game_id:
        typeof row.game_id === "string" ? row.game_id : gameId,
      turn_deadline:
        typeof row.turn_deadline === "string"
          ? row.turn_deadline
          : null,
      turn_duration_seconds: Math.max(
        5,
        Number(row.turn_duration_seconds) || 30,
      ),
      buzzer_active: row.buzzer_active === true,
      buzzer_user_id:
        typeof row.buzzer_user_id === "string"
          ? row.buzzer_user_id
          : null,
      buzzer_player_position:
        row.buzzer_player_position == null
          ? null
          : Number(row.buzzer_player_position),
      buzzer_player_name:
        typeof row.buzzer_player_name === "string"
          ? row.buzzer_player_name
          : null,
      buzzer_at:
        typeof row.buzzer_at === "string" ? row.buzzer_at : null,
      pending_special_action:
        special === "divide_bank" || special === "swap_bank"
          ? special
          : null,
      pending_actor_position:
        row.pending_actor_position == null
          ? null
          : Number(row.pending_actor_position),
      pending_actor_name:
        typeof row.pending_actor_name === "string"
          ? row.pending_actor_name
          : null,
      pending_special_label:
        typeof row.pending_special_label === "string"
          ? row.pending_special_label
          : null,
    };
  } catch {
    return emptyExtra;
  }
}

export async function getFortunePuzzleBankV87(): Promise<
  FortunePuzzleBankItemV87[]
> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("fortune_puzzle_bank_v87")
      .select(
        "id,category,solution,difficulty,active,used_count,last_used_at,created_at",
      )
      .order("active", { ascending: false })
      .order("used_count", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(250);

    if (error || !Array.isArray(data)) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      category: String(row.category ?? ""),
      solution: String(row.solution ?? ""),
      difficulty: String(row.difficulty ?? "normal"),
      active: row.active !== false,
      used_count: Math.max(0, Number(row.used_count) || 0),
      last_used_at:
        typeof row.last_used_at === "string" ? row.last_used_at : null,
      created_at: String(row.created_at ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function getFortuneHistoryV87(): Promise<
  FortuneHistoryItemV87[]
> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("fortune_game_history_v87")
      .select(
        "id,game_id,winner_user_id,winner_name,winner_position,player_count,total_prize,final_result,status,finished_at,snapshot",
      )
      .order("finished_at", { ascending: false })
      .limit(30);

    if (error || !Array.isArray(data)) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      game_id: String(row.game_id ?? ""),
      winner_user_id:
        typeof row.winner_user_id === "string"
          ? row.winner_user_id
          : null,
      winner_name:
        typeof row.winner_name === "string" ? row.winner_name : null,
      winner_position:
        row.winner_position == null
          ? null
          : Number(row.winner_position),
      player_count: Math.max(0, Number(row.player_count) || 0),
      total_prize: Math.max(0, Number(row.total_prize) || 0),
      final_result:
        typeof row.final_result === "string" ? row.final_result : null,
      status: String(row.status ?? "finished"),
      finished_at: String(row.finished_at ?? ""),
      snapshot: record(row.snapshot),
    }));
  } catch {
    return [];
  }
}

export async function getFortuneSegmentsV87(): Promise<
  FortuneSegmentV87[]
> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("fortune_wheel_segments")
      .select(
        "id,wheel_type,position,segment_type,label,value,color,active",
      )
      .order("wheel_type", { ascending: true })
      .order("position", { ascending: true });

    if (error || !Array.isArray(data)) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      wheel_type: row.wheel_type === "final" ? "final" : "normal",
      position: Number(row.position),
      segment_type: String(row.segment_type ?? "cash"),
      label: String(row.label ?? ""),
      value: Math.max(0, Number(row.value) || 0),
      color: String(row.color ?? "#c49a26"),
      active: row.active !== false,
    }));
  } catch {
    return [];
  }
}
