"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const RESET_PATH = "/dashboard/remise-a-zero";
const TREASURE_BUCKET = "treasure-hunt-images";

function field(formData: FormData, name: string, max = 200): string {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

function normalizedConfirmation(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function safeError(error: unknown): string {
  if (!error || typeof error !== "object") return "Erreur inconnue";
  const candidate = error as { message?: unknown; details?: unknown; hint?: unknown };
  const parts = [candidate.message, candidate.details, candidate.hint]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());
  return parts.join(" — ").slice(0, 500) || "Erreur inconnue";
}

async function requireManager() {
  const supabase = await createClient();
  const authResult = await supabase.auth.getUser();

  if (!authResult.data.user) redirect("/");

  const roles = await getUserRoleKeys(authResult.data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  return { supabase, user: authResult.data.user };
}

function refreshAll() {
  const paths = [
    RESET_PATH,
    "/dashboard",
    "/evenements",
    "/evenements/roue-de-la-fortune",
    "/evenements/roue-de-la-chance",
    "/evenements/a-prendre-ou-a-laisser",
    "/evenements/chasse-au-tresor",
    "/evenements/bingo",
    "/evenements/tombola",
    "/dashboard/jeux",
    "/profil",
    "/profil/jeux",
    "/profil/documents",
    "/dashboard/documents-signes",
  ];

  for (const path of paths) revalidatePath(path);
}

function success(code: string): never {
  redirect(`${RESET_PATH}?success=${encodeURIComponent(code)}`);
}

function failure(error: unknown): never {
  redirect(`${RESET_PATH}?error=${encodeURIComponent(safeError(error))}`);
}

function treasureStoragePath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${TREASURE_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index < 0) return null;

  const encodedPath = publicUrl.slice(index + marker.length);
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

async function getTreasureImagePaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("treasure_hunt_clues")
    .select("image_url")
    .not("image_url", "is", null);

  if (error) return [];

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => treasureStoragePath(String(row.image_url ?? "")))
        .filter((path): path is string => Boolean(path)),
    ),
  );
}

async function removeTreasureImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
) {
  for (let index = 0; index < paths.length; index += 100) {
    await supabase.storage
      .from(TREASURE_BUCKET)
      .remove(paths.slice(index, index + 100));
  }
}

export async function deletePastFortuneGameV88(formData: FormData) {
  try {
    const { supabase } = await requireManager();
    const gameId = field(formData, "game_id", 120);
    const confirmation = normalizedConfirmation(
      field(formData, "confirmation", 80),
    );

    if (!gameId) throw new Error("Identifiant de partie manquant.");

    const { error } = await (supabase as any).rpc(
      "nostra_delete_fortune_game_v88",
      {
        p_game_id: gameId,
        p_confirmation: confirmation,
      },
    );

    if (error) throw error;
    refreshAll();
  } catch (error) {
    failure(error);
  }

  success("fortune-game-deleted");
}

export async function resetGameDataV88(formData: FormData) {
  try {
    const { supabase } = await requireManager();
    const scope = field(formData, "scope", 40).toLowerCase();
    const confirmation = normalizedConfirmation(
      field(formData, "confirmation", 100),
    );
    const treasurePaths = ["treasure", "all"].includes(scope)
      ? await getTreasureImagePaths(supabase)
      : [];

    const { error } = await (supabase as any).rpc(
      "nostra_reset_game_data_v88",
      {
        p_scope: scope,
        p_confirmation: confirmation,
      },
    );

    if (error) throw error;

    if (treasurePaths.length > 0) {
      await removeTreasureImages(supabase, treasurePaths);
    }

    refreshAll();
  } catch (error) {
    failure(error);
  }

  success(`game-reset-${field(formData, "scope", 40).toLowerCase()}`);
}

export async function resetDocumentCounterV88(formData: FormData) {
  try {
    const { supabase } = await requireManager();
    const confirmation = normalizedConfirmation(
      field(formData, "confirmation", 100),
    );

    const { error } = await (supabase as any).rpc(
      "nostra_reset_document_counter_v88",
      { p_confirmation: confirmation },
    );

    if (error) throw error;
    refreshAll();
  } catch (error) {
    failure(error);
  }

  success("document-counter-reset");
}

export async function clearTestDocumentsV88(formData: FormData) {
  try {
    const { supabase } = await requireManager();
    const confirmation = normalizedConfirmation(
      field(formData, "confirmation", 120),
    );

    const { error } = await (supabase as any).rpc(
      "nostra_clear_test_documents_v88",
      { p_confirmation: confirmation },
    );

    if (error) throw error;
    refreshAll();
  } catch (error) {
    failure(error);
  }

  success("test-documents-cleared");
}
