"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const PATH = "/evenements/roue-de-la-fortune";

function text(formData: FormData, name: string, max = 3000): string {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function integer(formData: FormData, name: string): number {
  const value = Number(text(formData, name, 40));
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function refreshFortune() {
  revalidatePath(PATH);
  revalidatePath(`${PATH}/ecran`);
  revalidatePath("/evenements");
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  return { supabase, user: data.user };
}

async function getManagerClient() {
  const context = await getAuthenticatedClient();
  const roles = await getUserRoleKeys(context.user);
  if (!roles.includes("manager")) redirect("/accueil");
  return context;
}

function fail(code: string): never {
  redirect(`${PATH}?fortune_error=${encodeURIComponent(code)}`);
}

function success(code: string): never {
  refreshFortune();
  redirect(`${PATH}?fortune_success=${encodeURIComponent(code)}`);
}

async function managerRpc(
  name: string,
  params: Record<string, unknown>,
  successCode: string,
): Promise<never> {
  const { supabase } = await getManagerClient();
  const { error } = await (supabase as any).rpc(name, params);
  if (error) fail(error.message || name);
  return success(successCode);
}

export async function createFortuneGameAutoV87(formData: FormData) {
  const playerCount = integer(formData, "player_count");
  if (playerCount < 1 || playerCount > 6) fail("players");

  const { supabase } = await getManagerClient();
  const { data, error } = await (supabase as any)
    .from("member_profiles")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(1000);

  if (error || !Array.isArray(data)) fail(error?.message || "citizens");

  const userIds = Array.from(
    new Set(
      data
        .map((row: Record<string, unknown>) => String(row.user_id ?? ""))
        .filter(Boolean),
    ),
  );

  if (userIds.length < playerCount) fail("not_enough_citizens");

  for (let index = userIds.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [userIds[index], userIds[target]] = [userIds[target], userIds[index]];
  }

  const { error: rpcError } = await (supabase as any).rpc(
    "fortune_create_game_flexible",
    { p_players: userIds.slice(0, playerCount) },
  );

  if (rpcError) fail(rpcError.message || "game_auto");
  return success("game-auto-created");
}

export async function addFortunePuzzleV87(formData: FormData) {
  const category = text(formData, "category", 160);
  const solution = text(formData, "solution", 300);
  const difficulty = text(formData, "difficulty", 30) || "normal";

  if (category.length < 2 || solution.length < 2) fail("puzzle");

  const { supabase, user } = await getManagerClient();
  const { error } = await (supabase as any)
    .from("fortune_puzzle_bank_v87")
    .insert({
      category,
      solution,
      difficulty,
      created_by: user.id,
    });

  if (error) fail(error.message || "puzzle");
  return success("puzzle-added");
}

export async function toggleFortunePuzzleV87(formData: FormData) {
  const puzzleId = integer(formData, "puzzle_id");
  const active = text(formData, "active", 10) === "true";
  if (puzzleId <= 0) fail("puzzle");

  const { supabase } = await getManagerClient();
  const { error } = await (supabase as any)
    .from("fortune_puzzle_bank_v87")
    .update({ active })
    .eq("id", puzzleId);

  if (error) fail(error.message || "puzzle");
  return success(active ? "puzzle-enabled" : "puzzle-disabled");
}

export async function useRandomFortunePuzzleV87(formData: FormData) {
  const gameId = text(formData, "game_id", 80);
  const roundNumber = integer(formData, "round_number");
  const forFinal = text(formData, "for_final", 10) === "true";
  const difficulty = text(formData, "difficulty", 30);

  if (!gameId || (!forFinal && (roundNumber < 1 || roundNumber > 4))) {
    fail("puzzle");
  }

  return managerRpc(
    "fortune_pick_random_puzzle_v87",
    {
      p_game_id: gameId,
      p_round_number: roundNumber,
      p_for_final: forFinal,
      p_difficulty: difficulty || null,
    },
    forFinal ? "random-final-puzzle" : "random-round-puzzle",
  );
}

export async function revealFortuneLetterV87(formData: FormData) {
  const gameId = text(formData, "game_id", 80);
  const letter = text(formData, "letter", 2);
  if (!gameId || !letter) fail("letter");

  return managerRpc(
    "fortune_reveal_letter_v87",
    { p_game_id: gameId, p_letter: letter },
    "letter-revealed",
  );
}

export async function startFortuneTimerV87(formData: FormData) {
  const gameId = text(formData, "game_id", 80);
  const seconds = Math.min(300, Math.max(5, integer(formData, "seconds")));
  if (!gameId) fail("timer");

  return managerRpc(
    "fortune_start_timer_v87",
    { p_game_id: gameId, p_seconds: seconds },
    "timer-started",
  );
}

export async function stopFortuneTimerV87(formData: FormData) {
  const gameId = text(formData, "game_id", 80);
  if (!gameId) fail("timer");

  return managerRpc(
    "fortune_stop_timer_v87",
    { p_game_id: gameId },
    "timer-stopped",
  );
}

export async function resetFortuneBuzzerV87(formData: FormData) {
  const gameId = text(formData, "game_id", 80);
  if (!gameId) fail("buzzer");

  return managerRpc(
    "fortune_reset_buzzer_v87",
    { p_game_id: gameId },
    "buzzer-reset",
  );
}

export async function pressFortuneBuzzerV87(formData: FormData) {
  const gameId = text(formData, "game_id", 80);
  if (!gameId) fail("buzzer");

  const { supabase } = await getAuthenticatedClient();
  const { error } = await (supabase as any).rpc(
    "fortune_press_buzzer_v87",
    { p_game_id: gameId },
  );

  if (error) fail(error.message || "buzzer");
  return success("buzzer-pressed");
}

export async function resolveFortuneSpecialV87(formData: FormData) {
  const gameId = text(formData, "game_id", 80);
  const targetPosition = integer(formData, "target_position");
  if (!gameId || targetPosition < 1 || targetPosition > 6) {
    fail("special_target");
  }

  const { supabase } = await getAuthenticatedClient();
  const { error } = await (supabase as any).rpc(
    "fortune_resolve_special_v87",
    {
      p_game_id: gameId,
      p_target_position: targetPosition,
    },
  );

  if (error) fail(error.message || "special");
  return success("special-resolved");
}

export async function updateFortuneSpecialSegmentV87(
  formData: FormData,
) {
  const segmentId = integer(formData, "segment_id");
  const kind = text(formData, "segment_type", 30);
  const label = text(formData, "label", 40);
  const color = text(formData, "color", 20);
  const value = Math.max(0, integer(formData, "value"));
  const active = text(formData, "active", 10) === "true";

  const allowed = [
    "cash",
    "bankrupt",
    "lose_turn",
    "jackpot",
    "free_turn",
    "prize",
    "divide_bank",
    "swap_bank",
  ];

  if (
    segmentId <= 0 ||
    !allowed.includes(kind) ||
    !label ||
    !/^#[0-9a-f]{6}$/i.test(color)
  ) {
    fail("segment");
  }

  return managerRpc(
    "fortune_update_wheel_segment_v87",
    {
      p_segment_id: segmentId,
      p_label: label,
      p_segment_type: kind,
      p_value: value,
      p_color: color,
      p_active: active,
    },
    "special-segment-updated",
  );
}
