"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const ADMIN_PATH = "/dashboard/jeux/chasse-au-tresor";
const PUBLIC_PATH = "/evenements/chasse-au-tresor";
const IMAGE_BUCKET = "treasure-hunt-images";
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function value(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function fileValue(formData: FormData, key: string): File | null {
  const raw = formData.get(key);
  if (!raw || typeof raw === "string" || raw.size <= 0) return null;
  return raw;
}

function numberValue(formData: FormData, key: string): number {
  const parsed = Number(value(formData, key));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Identifiant invalide.");
  }
  return parsed;
}

function dateValue(formData: FormData, key: string): string | null {
  const raw = value(formData, key);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Date invalide.");
  }
  return date.toISOString();
}

function nullable(valueToNormalize: string): string | null {
  return valueToNormalize || null;
}

function message(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Une erreur est survenue.";
}

async function requireManager() {
  const supabase = await createClient();
  const authResult = await supabase.auth.getUser();
  if (!authResult.data.user) {
    redirect("/");
  }
  const roles = await getUserRoleKeys(authResult.data.user);
  if (!roles.includes("manager")) {
    redirect("/accueil");
  }
  return { supabase, user: authResult.data.user };
}

function refreshTreasureHunts() {
  revalidatePath(ADMIN_PATH);
  revalidatePath(PUBLIC_PATH);
  revalidatePath("/evenements");
  revalidatePath("/dashboard");
}

function success(code: string): never {
  redirect(`${ADMIN_PATH}?success=${encodeURIComponent(code)}`);
}

function failure(error: unknown): never {
  redirect(`${ADMIN_PATH}?error=${encodeURIComponent(message(error))}`);
}

function storagePathFromPublicUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return null;
  const encodedPath = url.slice(markerIndex + marker.length);
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

async function uploadClueImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  huntId: number,
  file: File,
): Promise<{ publicUrl: string; storagePath: string }> {
  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    throw new Error("Format d’image refusé. Utilise JPG, PNG, WEBP ou GIF.");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("L’image est trop lourde. Taille maximale : 8 Mo.");
  }

  const storagePath = `${userId}/${huntId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const uploadResult = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) {
    throw new Error(`Impossible d’envoyer l’image : ${uploadResult.error.message}`);
  }

  const publicResult = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(storagePath);
  return {
    publicUrl: publicResult.data.publicUrl,
    storagePath,
  };
}

async function removeUploadedImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  imageUrl: string | null,
) {
  const storagePath = storagePathFromPublicUrl(imageUrl);
  if (!storagePath) return;
  await supabase.storage.from(IMAGE_BUCKET).remove([storagePath]);
}

export async function setTreasureHuntEnabled(formData: FormData) {
  try {
    const { supabase, user } = await requireManager();
    const enabled = value(formData, "enabled") === "true";
    const result = await supabase
      .from("treasure_hunt_settings")
      .upsert(
        {
          id: 1,
          is_enabled: enabled,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: "id" },
      );
    if (result.error) throw result.error;
    refreshTreasureHunts();
  } catch (error) {
    failure(error);
  }
  success(value(formData, "enabled") === "true" ? "enabled" : "disabled");
}

export async function createTreasureHunt(formData: FormData) {
  try {
    const { supabase, user } = await requireManager();
    const title = value(formData, "title");
    const description = value(formData, "description");
    if (!title || !description) {
      throw new Error("Le titre et la description sont obligatoires.");
    }
    const startsAt = dateValue(formData, "starts_at");
    const endsAt = dateValue(formData, "ends_at");
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      throw new Error("La date de fin doit être après la date de début.");
    }
    const result = await supabase.from("treasure_hunts").insert({
      title,
      description,
      prize: nullable(value(formData, "prize")),
      meeting_point: nullable(value(formData, "meeting_point")),
      starts_at: startsAt,
      ends_at: endsAt,
      status: "draft",
      created_by: user.id,
    });
    if (result.error) throw result.error;
    refreshTreasureHunts();
  } catch (error) {
    failure(error);
  }
  success("created");
}

export async function updateTreasureHunt(formData: FormData) {
  try {
    const { supabase } = await requireManager();
    const id = numberValue(formData, "id");
    const title = value(formData, "title");
    const description = value(formData, "description");
    const status = value(formData, "status");
    if (!title || !description) {
      throw new Error("Le titre et la description sont obligatoires.");
    }
    if (!["draft", "published", "completed", "cancelled"].includes(status)) {
      throw new Error("Statut invalide.");
    }
    const startsAt = dateValue(formData, "starts_at");
    const endsAt = dateValue(formData, "ends_at");
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      throw new Error("La date de fin doit être après la date de début.");
    }
    const result = await supabase
      .from("treasure_hunts")
      .update({
        title,
        description,
        prize: nullable(value(formData, "prize")),
        meeting_point: nullable(value(formData, "meeting_point")),
        starts_at: startsAt,
        ends_at: endsAt,
        status,
        winner_name: nullable(value(formData, "winner_name")),
        winner_note: nullable(value(formData, "winner_note")),
      })
      .eq("id", id);
    if (result.error) throw result.error;
    refreshTreasureHunts();
  } catch (error) {
    failure(error);
  }
  success("updated");
}

export async function deleteTreasureHunt(formData: FormData) {
  try {
    const { supabase } = await requireManager();
    const id = numberValue(formData, "id");
    const result = await supabase.from("treasure_hunts").delete().eq("id", id);
    if (result.error) throw result.error;
    refreshTreasureHunts();
  } catch (error) {
    failure(error);
  }
  success("deleted");
}

export async function addTreasureHuntClue(formData: FormData) {
  let uploadedPath: string | null = null;
  try {
    const { supabase, user } = await requireManager();
    const huntId = numberValue(formData, "hunt_id");
    const title = value(formData, "title");
    const content = value(formData, "content");
    const imageFile = fileValue(formData, "image_file");
    if (!title || !content) {
      throw new Error("Le titre et le texte de l’indice sont obligatoires.");
    }

    let imageUrl: string | null = null;
    if (imageFile) {
      const uploaded = await uploadClueImage(supabase, user.id, huntId, imageFile);
      imageUrl = uploaded.publicUrl;
      uploadedPath = uploaded.storagePath;
    }

    const current = await supabase
      .from("treasure_hunt_clues")
      .select("position")
      .eq("hunt_id", huntId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (current.error) throw current.error;
    const position = Number(current.data?.position ?? 0) + 1;
    const result = await supabase.from("treasure_hunt_clues").insert({
      hunt_id: huntId,
      position,
      title,
      content,
      zone: nullable(value(formData, "zone")),
      image_url: imageUrl,
      is_revealed: formData.get("is_revealed") === "on",
    });
    if (result.error) throw result.error;
    refreshTreasureHunts();
  } catch (error) {
    if (uploadedPath) {
      try {
        const { supabase } = await requireManager();
        await supabase.storage.from(IMAGE_BUCKET).remove([uploadedPath]);
      } catch {
        // Le nettoyage ne doit pas masquer l’erreur principale.
      }
    }
    failure(error);
  }
  success("clue-added");
}

export async function updateTreasureHuntClue(formData: FormData) {
  let uploadedPath: string | null = null;
  try {
    const { supabase, user } = await requireManager();
    const id = numberValue(formData, "id");
    const huntId = numberValue(formData, "hunt_id");
    const title = value(formData, "title");
    const content = value(formData, "content");
    const isRevealed = formData.get("is_revealed") === "on";
    const removeImage = formData.get("remove_image") === "on";
    const imageFile = fileValue(formData, "image_file");
    if (!title || !content) {
      throw new Error("Le titre et le texte de l’indice sont obligatoires.");
    }

    const currentResult = await supabase
      .from("treasure_hunt_clues")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();
    if (currentResult.error) throw currentResult.error;
    const previousImageUrl = currentResult.data?.image_url ?? null;

    let imageUrl = removeImage ? null : previousImageUrl;
    if (imageFile) {
      const uploaded = await uploadClueImage(supabase, user.id, huntId, imageFile);
      imageUrl = uploaded.publicUrl;
      uploadedPath = uploaded.storagePath;
    }

    const result = await supabase
      .from("treasure_hunt_clues")
      .update({
        title,
        content,
        zone: nullable(value(formData, "zone")),
        image_url: imageUrl,
        is_revealed: isRevealed,
        revealed_at: isRevealed ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (result.error) throw result.error;

    if (previousImageUrl && previousImageUrl !== imageUrl) {
      await removeUploadedImage(supabase, previousImageUrl);
    }
    refreshTreasureHunts();
  } catch (error) {
    if (uploadedPath) {
      try {
        const { supabase } = await requireManager();
        await supabase.storage.from(IMAGE_BUCKET).remove([uploadedPath]);
      } catch {
        // Le nettoyage ne doit pas masquer l’erreur principale.
      }
    }
    failure(error);
  }
  success("clue-updated");
}

export async function deleteTreasureHuntClue(formData: FormData) {
  try {
    const { supabase } = await requireManager();
    const id = numberValue(formData, "id");
    const currentResult = await supabase
      .from("treasure_hunt_clues")
      .select("image_url")
      .eq("id", id)
      .maybeSingle();
    if (currentResult.error) throw currentResult.error;

    const result = await supabase.from("treasure_hunt_clues").delete().eq("id", id);
    if (result.error) throw result.error;
    await removeUploadedImage(supabase, currentResult.data?.image_url ?? null);
    refreshTreasureHunts();
  } catch (error) {
    failure(error);
  }
  success("clue-deleted");
}

export async function revealNextTreasureHuntClue(formData: FormData) {
  try {
    const { supabase } = await requireManager();
    const huntId = numberValue(formData, "hunt_id");
    const nextResult = await supabase
      .from("treasure_hunt_clues")
      .select("id")
      .eq("hunt_id", huntId)
      .eq("is_revealed", false)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextResult.error) throw nextResult.error;
    if (!nextResult.data) {
      throw new Error("Tous les indices sont déjà révélés.");
    }
    const updateResult = await supabase
      .from("treasure_hunt_clues")
      .update({
        is_revealed: true,
        revealed_at: new Date().toISOString(),
      })
      .eq("id", nextResult.data.id);
    if (updateResult.error) throw updateResult.error;
    refreshTreasureHunts();
  } catch (error) {
    failure(error);
  }
  success("next-revealed");
}

export async function moveTreasureHuntClue(formData: FormData) {
  try {
    const { supabase } = await requireManager();
    const id = numberValue(formData, "id");
    const huntId = numberValue(formData, "hunt_id");
    const direction = value(formData, "direction");
    if (!["up", "down"].includes(direction)) {
      throw new Error("Déplacement invalide.");
    }
    const cluesResult = await supabase
      .from("treasure_hunt_clues")
      .select("id,position")
      .eq("hunt_id", huntId)
      .order("position", { ascending: true });
    if (cluesResult.error) throw cluesResult.error;
    const clues = (cluesResult.data ?? []) as Array<{
      id: number | string;
      position: number | string;
    }>;
    const index = clues.findIndex((clue) => Number(clue.id) === id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index >= 0 && targetIndex >= 0 && targetIndex < clues.length) {
      const current = clues[index];
      const target = clues[targetIndex];
      const firstUpdate = await supabase
        .from("treasure_hunt_clues")
        .update({ position: Number(target.position) })
        .eq("id", current.id);
      if (firstUpdate.error) throw firstUpdate.error;
      const secondUpdate = await supabase
        .from("treasure_hunt_clues")
        .update({ position: Number(current.position) })
        .eq("id", target.id);
      if (secondUpdate.error) throw secondUpdate.error;
    }
    refreshTreasureHunts();
  } catch (error) {
    failure(error);
  }
  success("clue-moved");
}
