"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const PATH = "/evenements/roue-de-la-fortune";

function text(
  formData: FormData,
  name: string,
  max = 3000,
): string {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function integer(formData: FormData, name: string): number {
  const value = Number(text(formData, name, 40));
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function refresh() {
  revalidatePath("/evenements");
  revalidatePath(PATH);
}

async function managerRpc(
  name: string,
  params: Record<string, unknown>,
  success: string,
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const { error } = await (supabase as any).rpc(name, params);

  if (error) {
    redirect(
      `${PATH}?fortune_error=${encodeURIComponent(
        error.message || "database",
      )}`,
    );
  }

  refresh();
  redirect(`${PATH}?fortune_success=${success}`);
}

export async function createFortuneGame(formData: FormData) {
  const playerCount = integer(formData, "player_count");

  if (playerCount < 1 || playerCount > 6) {
    redirect(`${PATH}?fortune_error=players`);
  }

  const players = Array.from(
    { length: playerCount },
    (_, index) => text(formData, `player_${index + 1}`, 80),
  );

  if (
    players.some((value) => !value) ||
    new Set(players).size !== playerCount
  ) {
    redirect(`${PATH}?fortune_error=players`);
  }

  await managerRpc(
    "fortune_create_game_flexible",
    {
      p_players: players,
    },
    "game-created",
  );
}

export async function saveFortuneRound(formData: FormData) {
  const gameId = text(formData, "game_id", 80);
  const roundNumber = integer(formData, "round_number");
  const category = text(formData, "category", 160);
  const solution = text(formData, "solution", 300);

  if (
    !gameId ||
    roundNumber < 1 ||
    roundNumber > 4 ||
    category.length < 2 ||
    solution.length < 2
  ) {
    redirect(`${PATH}?fortune_error=round`);
  }

  await managerRpc(
    "fortune_save_round",
    {
      p_game_id: gameId,
      p_round_number: roundNumber,
      p_category: category,
      p_solution: solution,
    },
    `round-${roundNumber}-saved`,
  );
}

export async function startFortuneRound(formData: FormData) {
  await managerRpc(
    "fortune_start_round",
    { p_game_id: text(formData, "game_id", 80) },
    "round-started",
  );
}

export async function advanceFortuneRound(formData: FormData) {
  await managerRpc(
    "fortune_advance_round",
    { p_game_id: text(formData, "game_id", 80) },
    "round-advanced",
  );
}

export async function saveFortuneFinalPuzzle(
  formData: FormData,
) {
  const gameId = text(formData, "game_id", 80);
  const category = text(formData, "final_category", 160);
  const solution = text(formData, "final_solution", 300);

  if (!gameId || category.length < 2 || solution.length < 2) {
    redirect(`${PATH}?fortune_error=final`);
  }

  await managerRpc(
    "fortune_save_final_puzzle",
    {
      p_game_id: gameId,
      p_category: category,
      p_solution: solution,
      p_revealed_letters: text(
        formData,
        "final_revealed_letters",
        30,
      ),
    },
    "final-saved",
  );
}

export async function setFortuneWheelVisibility(
  formData: FormData,
) {
  const visible = text(formData, "visible_wheel", 20);

  if (!['normal', 'final', 'none'].includes(visible)) {
    redirect(`${PATH}?fortune_error=wheel`);
  }

  await managerRpc(
    "fortune_set_visible_wheel",
    { p_visible_wheel: visible },
    `wheel-${visible}`,
  );
}

export async function toggleFortuneGame(formData: FormData) {
  const enabled = text(formData, "enabled", 10) === "true";

  await managerRpc(
    "fortune_set_enabled",
    { p_enabled: enabled },
    enabled ? "enabled" : "disabled",
  );
}

export async function updateFortuneWheelSegment(
  formData: FormData,
) {
  const segmentId = integer(formData, "segment_id");
  const label = text(formData, "label", 40);
  const kind = text(formData, "segment_type", 30);
  const value = Math.max(0, integer(formData, "value"));
  const color = text(formData, "color", 20);
  const active = text(formData, "active", 10) === "true";

  if (
    segmentId <= 0 ||
    !label ||
    ![
      "cash",
      "bankrupt",
      "lose_turn",
      "jackpot",
      "free_turn",
      "prize",
    ].includes(kind) ||
    !/^#[0-9a-f]{6}$/i.test(color)
  ) {
    redirect(`${PATH}?fortune_error=segment`);
  }

  await managerRpc(
    "fortune_update_wheel_segment",
    {
      p_segment_id: segmentId,
      p_label: label,
      p_segment_type: kind,
      p_value: value,
      p_color: color,
      p_active: active,
    },
    "segment-updated",
  );
}

export async function setFortuneActivePlayer(
  formData: FormData,
) {
  const position = integer(formData, "player_position");

  if (position < 1 || position > 6) {
    redirect(`${PATH}?fortune_error=player`);
  }

  await managerRpc(
    "fortune_set_active_player",
    {
      p_game_id: text(formData, "game_id", 80),
      p_player_position: position,
    },
    "player-changed",
  );
}

export async function cancelFortuneGame(formData: FormData) {
  await managerRpc(
    "fortune_cancel_game",
    { p_game_id: text(formData, "game_id", 80) },
    "game-cancelled",
  );
}

export async function submitFortuneLetter(formData: FormData) {
  const gameId = text(formData, "game_id", 80);
  const kind = text(formData, "kind", 20);
  const letter = text(formData, "letter", 5);

  if (
    !gameId ||
    !["consonant", "vowel"].includes(kind) ||
    !letter
  ) {
    redirect(`${PATH}?fortune_error=letter`);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const { data: result, error } = await (supabase as any).rpc(
    "fortune_submit_letter",
    {
      p_game_id: gameId,
      p_letter: letter,
      p_kind: kind,
    },
  );

  if (error) {
    redirect(
      `${PATH}?fortune_error=${encodeURIComponent(
        error.message || "letter",
      )}`,
    );
  }

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};

  refresh();
  redirect(
    `${PATH}?fortune_success=${
      Number(response.occurrences) > 0
        ? "letter-found"
        : "letter-missed"
    }`,
  );
}

export async function submitFortuneSolution(formData: FormData) {
  const gameId = text(formData, "game_id", 80);
  const solution = text(formData, "solution", 300);

  if (!gameId || solution.length < 2) {
    redirect(`${PATH}?fortune_error=solution`);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const { data: result, error } = await (supabase as any).rpc(
    "fortune_submit_solution",
    {
      p_game_id: gameId,
      p_solution: solution,
    },
  );

  if (error) {
    redirect(
      `${PATH}?fortune_error=${encodeURIComponent(
        error.message || "solution",
      )}`,
    );
  }

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};

  refresh();
  redirect(
    `${PATH}?fortune_success=${
      response.correct === true
        ? "solution-correct"
        : "solution-wrong"
    }`,
  );
}
