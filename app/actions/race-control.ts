
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type RaceControlActionResult = {
  ok: boolean;
  error?: string;
};

function text(
  value: FormDataEntryValue | null,
  maxLength: number,
): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function integer(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionErrorCode(error: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null): string {
  const value = `${error?.message ?? ""} ${error?.details ?? ""} ${
    error?.hint ?? ""
  }`.toLowerCase();

  if (value.includes("commissioner_required")) return "access";
  if (value.includes("invalid_entries")) return "entries";
  if (value.includes("invalid_event")) return "event";
  if (value.includes("invalid_event_status")) return "status";
  if (value.includes("invalid_entry_status")) return "entry_status";
  if (value.includes("invalid_lap")) return "lap";
  if (value.includes("use_finish_button")) return "finish";
  if (value.includes("laps_remaining")) return "laps_remaining";
  if (value.includes("duplicate_crossing")) return "duplicate";
  return "save";
}

async function requireCommissioner() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return {
      supabase,
      user: null,
      roles: [] as const,
      authenticated: false as const,
      allowed: false as const,
    };
  }

  const roles = await getUserRoleKeys(data.user);
  const allowed =
    roles.includes("manager") || roles.includes("commissioner");

  return {
    supabase,
    user: data.user,
    roles,
    authenticated: true as const,
    allowed,
  };
}

function revalidateRace(eventId: number) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commissaires/chronometrage");
  revalidatePath(
    `/dashboard/commissaires/chronometrage/${eventId}`,
  );
  revalidatePath("/commissaires/chronometrage");
  revalidatePath(`/commissaires/chronometrage/${eventId}`);
  revalidatePath("/circuit/championnat-f1/resultats");
  revalidatePath("/circuit/championnat-gt3rs/resultats");
  revalidatePath("/circuit/classement/f1");
  revalidatePath("/circuit/classement/gt3rs");
  revalidatePath("/circuit/classement/ecuries");
}

export type CreateRaceControlEventState = {
  ok: boolean;
  error?: string;
};

type SanitizedRaceEntry = {
  driver_name: string;
  team_name: string;
};

function parseRaceEntries(value: string): SanitizedRaceEntry[] | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 40) {
    return null;
  }

  const entries: SanitizedRaceEntry[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") return null;

    const record = item as Record<string, unknown>;
    const driverName =
      typeof record.driver_name === "string"
        ? record.driver_name.trim().slice(0, 120)
        : "";
    const teamName =
      typeof record.team_name === "string"
        ? record.team_name.trim().slice(0, 120)
        : "";

    if (!driverName || !teamName) return null;

    entries.push({
      driver_name: driverName,
      team_name: teamName,
    });
  }

  return entries;
}

export async function createRaceControlEvent(
  _previousState: CreateRaceControlEventState,
  formData: FormData,
): Promise<CreateRaceControlEventState> {
  const title = text(formData.get("title"), 160);
  const competitionType = text(
    formData.get("competition_type"),
    20,
  );
  const targetLaps = integer(formData.get("target_laps"));
  const entries = parseRaceEntries(
    text(formData.get("entries_json"), 20000),
  );

  if (!title) {
    return {
      ok: false,
      error: "Indique le nom de la course.",
    };
  }

  if (!["f1", "gt3rs", "general"].includes(competitionType)) {
    return {
      ok: false,
      error: "Le type de course sélectionné est invalide.",
    };
  }

  if (targetLaps < 1 || targetLaps > 999) {
    return {
      ok: false,
      error: "Le nombre de tours doit être compris entre 1 et 999.",
    };
  }

  if (!entries) {
    return {
      ok: false,
      error:
        "Ajoute au moins un pilote et complète entièrement chaque ligne utilisée.",
    };
  }

  const {
    user,
    roles,
    authenticated,
    allowed,
  } = await requireCommissioner();

  if (!authenticated || !user) {
    return {
      ok: false,
      error: "Ta session a expiré. Recharge la page puis reconnecte-toi.",
    };
  }

  if (!allowed) {
    return {
      ok: false,
      error: "Ton compte n’a pas accès à la direction de course.",
    };
  }

  try {
    const admin = createAdminClient();

    const { data: event, error: eventError } = await admin
      .from("race_control_events")
      .insert({
        title,
        competition_type: competitionType,
        target_laps: targetLaps,
        status: "ready",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (eventError || !event?.id) {
      console.error("createRaceControlEvent event insert", eventError);
      return {
        ok: false,
        error:
          "La course n’a pas pu être créée. Vérifie que le module de chronométrage est activé.",
      };
    }

    const eventId = Number(event.id);
    const rows = entries.map((entry, index) => ({
      event_id: eventId,
      driver_name: entry.driver_name,
      team_name: entry.team_name,
      grid_position: index + 1,
      status: "ready",
    }));

    const { error: entriesError } = await admin
      .from("race_control_entries")
      .insert(rows);

    if (entriesError) {
      console.error(
        "createRaceControlEvent entries insert",
        entriesError,
      );

      await admin
        .from("race_control_events")
        .delete()
        .eq("id", eventId);

      return {
        ok: false,
        error:
          "La grille n’a pas pu être enregistrée. Aucune course incomplète n’a été conservée.",
      };
    }

    revalidateRace(eventId);

    const basePath = roles.includes("manager")
      ? "/dashboard/commissaires/chronometrage"
      : "/commissaires/chronometrage";

    redirect(`${basePath}/${eventId}?created=1`);
  } catch (error) {
    const digest =
      error && typeof error === "object" && "digest" in error
        ? String((error as { digest?: unknown }).digest ?? "")
        : "";

    if (digest.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    console.error("createRaceControlEvent unexpected error", error);

    return {
      ok: false,
      error:
        "Une erreur technique a empêché l’ouverture des chronomètres. Réessaie après avoir rechargé la page.",
    };
  }

  return { ok: true };
}

export async function startRaceControlEvent(
  eventId: number,
): Promise<RaceControlActionResult> {
  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) return { ok: false, error: "auth" };
  if (!allowed) return { ok: false, error: "access" };

  const { error } = await supabase.rpc(
    "nostra_start_race_control_event",
    {
      p_event_id: eventId,
    },
  );

  if (error) {
    return {
      ok: false,
      error: actionErrorCode(error),
    };
  }

  revalidateRace(eventId);
  return { ok: true };
}

export async function recordRaceControlLap(
  entryId: number,
  elapsedMs: number,
): Promise<RaceControlActionResult> {
  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) return { ok: false, error: "auth" };
  if (!allowed) return { ok: false, error: "access" };

  const { data, error } = await supabase.rpc(
    "nostra_record_race_control_lap",
    {
      p_entry_id: entryId,
      p_elapsed_ms: Math.max(0, Math.round(elapsedMs)),
    },
  );

  if (error) {
    return {
      ok: false,
      error: actionErrorCode(error),
    };
  }

  const eventId = Number(data);
  if (eventId > 0) revalidateRace(eventId);
  return { ok: true };
}

export async function finishRaceControlEntry(
  entryId: number,
  elapsedMs: number,
): Promise<RaceControlActionResult> {
  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) return { ok: false, error: "auth" };
  if (!allowed) return { ok: false, error: "access" };

  const { data, error } = await supabase.rpc(
    "nostra_finish_race_control_entry",
    {
      p_entry_id: entryId,
      p_elapsed_ms: Math.max(0, Math.round(elapsedMs)),
    },
  );

  if (error) {
    return {
      ok: false,
      error: actionErrorCode(error),
    };
  }

  const eventId = Number(data);
  if (eventId > 0) revalidateRace(eventId);
  return { ok: true };
}

export async function markRaceControlEntryDnf(
  entryId: number,
  elapsedMs: number,
): Promise<RaceControlActionResult> {
  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) return { ok: false, error: "auth" };
  if (!allowed) return { ok: false, error: "access" };

  const { data, error } = await supabase.rpc(
    "nostra_mark_race_control_entry_dnf",
    {
      p_entry_id: entryId,
      p_elapsed_ms: Math.max(0, Math.round(elapsedMs)),
    },
  );

  if (error) {
    return {
      ok: false,
      error: actionErrorCode(error),
    };
  }

  const eventId = Number(data);
  if (eventId > 0) revalidateRace(eventId);
  return { ok: true };
}

export async function stopRaceControlEvent(
  eventId: number,
): Promise<RaceControlActionResult> {
  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) return { ok: false, error: "auth" };
  if (!allowed) return { ok: false, error: "access" };

  const { error } = await supabase.rpc(
    "nostra_stop_race_control_event",
    {
      p_event_id: eventId,
    },
  );

  if (error) {
    return {
      ok: false,
      error: actionErrorCode(error),
    };
  }

  revalidateRace(eventId);
  return { ok: true };
}

export async function publishRaceControlResults(
  formData: FormData,
) {
  const eventId = integer(formData.get("event_id"));
  const destination = text(formData.get("destination"), 20);

  if (
    eventId <= 0 ||
    !["f1", "gt3rs", "general"].includes(destination)
  ) {
    redirect(
      `/dashboard/commissaires/chronometrage/${eventId}?error=publish`,
    );
  }

  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) redirect("/");
  if (!allowed) redirect("/accueil");

  const { error } = await supabase.rpc(
    "nostra_publish_race_control_results",
    {
      p_event_id: eventId,
      p_destination: destination,
    },
  );

  if (error) {
    redirect(
      `/dashboard/commissaires/chronometrage/${eventId}?error=${actionErrorCode(
        error,
      )}`,
    );
  }

  revalidateRace(eventId);
  redirect(
    `/dashboard/commissaires/chronometrage/${eventId}?published=1`,
  );
}

export async function unpublishRaceControlResults(
  formData: FormData,
) {
  const eventId = integer(formData.get("event_id"));

  if (eventId <= 0) {
    redirect("/dashboard/commissaires/chronometrage?error=event");
  }

  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) redirect("/");
  if (!allowed) redirect("/accueil");

  const { error } = await supabase.rpc(
    "nostra_unpublish_race_control_results",
    {
      p_event_id: eventId,
    },
  );

  if (error) {
    redirect(
      `/dashboard/commissaires/chronometrage/${eventId}?error=${actionErrorCode(
        error,
      )}`,
    );
  }

  revalidateRace(eventId);
  redirect(
    `/dashboard/commissaires/chronometrage/${eventId}?unpublished=1`,
  );
}

export async function resetRaceControlStandings(
  formData: FormData,
) {
  const scope = text(formData.get("scope"), 20);
  const confirmed = formData.get("confirmed") === "yes";

  if (!["f1", "gt3rs", "all"].includes(scope) || !confirmed) {
    redirect(
      "/dashboard/commissaires/chronometrage?error=reset_confirmation",
    );
  }

  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) redirect("/");
  if (!allowed) redirect("/accueil");

  const { error } = await supabase.rpc(
    "nostra_reset_race_control_standings",
    {
      p_scope: scope,
    },
  );

  if (error) {
    redirect(
      `/dashboard/commissaires/chronometrage?error=${actionErrorCode(
        error,
      )}`,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commissaires/chronometrage");
  revalidatePath("/circuit/championnat-f1/resultats");
  revalidatePath("/circuit/championnat-gt3rs/resultats");
  revalidatePath("/circuit/classement/f1");
  revalidatePath("/circuit/classement/gt3rs");
  revalidatePath("/circuit/classement/ecuries");

  redirect(
    `/dashboard/commissaires/chronometrage?reset=${scope}`,
  );
}

export async function deleteRaceControlEvent(formData: FormData) {
  const eventId = integer(formData.get("event_id"));

  if (eventId <= 0) {
    redirect(
      "/dashboard/commissaires/chronometrage?error=delete",
    );
  }

  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) redirect("/");
  if (!allowed) redirect("/accueil");

  const { error } = await supabase.rpc(
    "nostra_delete_race_control_event",
    {
      p_event_id: eventId,
    },
  );

  if (error) {
    redirect(
      "/dashboard/commissaires/chronometrage?error=delete",
    );
  }

  revalidateRace(eventId);
  redirect(
    "/dashboard/commissaires/chronometrage?deleted=1",
  );
}
