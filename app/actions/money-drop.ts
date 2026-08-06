"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_PATH = "/motors/money-drop";
const DASHBOARD_PATH = "/dashboard/jeux/money-drop";

function text(formData: FormData, name: string, max = 1000): string {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function integer(formData: FormData, name: string): number {
  const value = Number(text(formData, name, 40));
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function refresh() {
  revalidatePath("/motors");
  revalidatePath(PUBLIC_PATH);
  revalidatePath("/dashboard");
  revalidatePath(DASHBOARD_PATH);
}

async function managerRpc(
  name: string,
  params: Record<string, unknown>,
  success: string,
): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const { error } = await (supabase as any).rpc(name, params);
  if (error) {
    redirect(
      `${DASHBOARD_PATH}?money_drop_error=${encodeURIComponent(
        error.message || "database",
      )}`,
    );
  }

  refresh();
  redirect(`${DASHBOARD_PATH}?money_drop_success=${success}`);
}

export async function toggleMoneyDrop(formData: FormData) {
  await managerRpc(
    "money_drop_set_enabled",
    { p_enabled: text(formData, "enabled", 10) === "true" },
    text(formData, "enabled", 10) === "true" ? "enabled" : "disabled",
  );
}

export async function updateMoneyDropSettings(formData: FormData) {
  const startingAmount = integer(formData, "starting_amount");
  const totalRounds = integer(formData, "total_rounds");
  const answerSeconds = integer(formData, "answer_seconds");

  if (
    startingAmount < 1_000 ||
    startingAmount > 1_000_000_000 ||
    totalRounds < 1 ||
    totalRounds > 12 ||
    answerSeconds < 10 ||
    answerSeconds > 600
  ) {
    redirect(`${DASHBOARD_PATH}?money_drop_error=settings`);
  }

  await managerRpc(
    "money_drop_update_settings",
    {
      p_starting_amount: startingAmount,
      p_total_rounds: totalRounds,
      p_answer_seconds: answerSeconds,
    },
    "settings-saved",
  );
}

export async function addMoneyDropQuestion(formData: FormData) {
  const optionA = text(formData, "option_a", 180);
  const optionB = text(formData, "option_b", 180);
  const optionC = text(formData, "option_c", 180);
  const optionD = text(formData, "option_d", 180);
  const correct = text(formData, "correct_option", 1).toUpperCase();
  const available = [optionA, optionB, optionC, optionD].filter(Boolean).length;

  if (
    text(formData, "category", 100).length < 2 ||
    text(formData, "question", 500).length < 5 ||
    available < 2 ||
    !["A", "B", "C", "D"].includes(correct) ||
    ![optionA, optionB, optionC, optionD][correct.charCodeAt(0) - 65]
  ) {
    redirect(`${DASHBOARD_PATH}?money_drop_error=question`);
  }

  await managerRpc(
    "money_drop_add_question",
    {
      p_category: text(formData, "category", 100),
      p_question: text(formData, "question", 500),
      p_option_a: optionA,
      p_option_b: optionB,
      p_option_c: optionC || null,
      p_option_d: optionD || null,
      p_correct_option: correct,
      p_is_final: text(formData, "is_final", 10) === "true",
    },
    "question-added",
  );
}

export async function toggleMoneyDropQuestion(formData: FormData) {
  await managerRpc(
    "money_drop_toggle_question",
    {
      p_question_id: integer(formData, "question_id"),
      p_active: text(formData, "active", 10) === "true",
    },
    "question-updated",
  );
}

export async function createMoneyDropGame(formData: FormData) {
  const playerCount = integer(formData, "player_count");
  if (playerCount < 1 || playerCount > 4) {
    redirect(`${DASHBOARD_PATH}?money_drop_error=players`);
  }

  const players = Array.from({ length: playerCount }, (_, index) =>
    text(formData, `player_${index + 1}`, 80),
  );
  if (players.some((value) => !value) || new Set(players).size !== players.length) {
    redirect(`${DASHBOARD_PATH}?money_drop_error=players`);
  }

  await managerRpc(
    "money_drop_create_game",
    {
      p_team_name: text(formData, "team_name", 100) || "Équipe Nostra",
      p_players: players,
    },
    "game-created",
  );
}

export async function selectMoneyDropQuestion(formData: FormData) {
  await managerRpc(
    "money_drop_select_question",
    {
      p_game_id: text(formData, "game_id", 80),
      p_question_id: integer(formData, "question_id"),
    },
    "question-selected",
  );
}

export async function selectRandomMoneyDropQuestion(formData: FormData) {
  const category = text(formData, "category", 100);
  await managerRpc(
    "money_drop_select_random_question",
    {
      p_game_id: text(formData, "game_id", 80),
      p_category: category || null,
    },
    "question-selected",
  );
}

export async function openMoneyDropQuestion(formData: FormData) {
  await managerRpc(
    "money_drop_open_question",
    { p_game_id: text(formData, "game_id", 80) },
    "question-opened",
  );
}

export async function lockMoneyDropAllocations(formData: FormData) {
  await managerRpc(
    "money_drop_lock_allocations",
    { p_game_id: text(formData, "game_id", 80) },
    "allocations-locked",
  );
}

export async function revealMoneyDropAnswer(formData: FormData) {
  await managerRpc(
    "money_drop_reveal_answer",
    { p_game_id: text(formData, "game_id", 80) },
    "answer-revealed",
  );
}

export async function advanceMoneyDropRound(formData: FormData) {
  await managerRpc(
    "money_drop_advance_round",
    { p_game_id: text(formData, "game_id", 80) },
    "round-advanced",
  );
}

export async function cancelMoneyDropGame(formData: FormData) {
  await managerRpc(
    "money_drop_cancel_game",
    { p_game_id: text(formData, "game_id", 80) },
    "game-cancelled",
  );
}

export async function saveMoneyDropAllocations(formData: FormData) {
  const gameId = text(formData, "game_id", 80);
  const allocations = {
    A: Math.max(0, integer(formData, "allocation_a")),
    B: Math.max(0, integer(formData, "allocation_b")),
    C: Math.max(0, integer(formData, "allocation_c")),
    D: Math.max(0, integer(formData, "allocation_d")),
  };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { error } = await (supabase as any).rpc(
    "money_drop_save_allocations",
    {
      p_game_id: gameId,
      p_allocations: allocations,
    },
  );

  if (error) {
    redirect(
      `${PUBLIC_PATH}?money_drop_error=${encodeURIComponent(
        error.message || "allocations",
      )}`,
    );
  }

  refresh();
  redirect(`${PUBLIC_PATH}?money_drop_success=allocations-saved`);
}
