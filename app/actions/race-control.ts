
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasCommissionerAccess } from "@/lib/auth/access";
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
      authenticated: false as const,
      allowed: false as const,
    };
  }

  const allowed = await hasCommissionerAccess(data.user);

  return {
    supabase,
    authenticated: true as const,
    allowed,
  };
}

function revalidateRaceLists(eventId: number) {
  revalidatePath("/dashboard/commissaires/chronometrage");
  revalidatePath("/commissaires/chronometrage");
  revalidatePath(
    `/dashboard/commissaires/chronometrage/${eventId}`,
  );
  revalidatePath(`/commissaires/chronometrage/${eventId}`);
}

function revalidatePublishedRacePages() {
  revalidatePath("/circuit/championnat-f1/resultats");
  revalidatePath("/circuit/championnat-gt3rs/resultats");
  revalidatePath("/circuit/classement/f1");
  revalidatePath("/circuit/classement/gt3rs");
  revalidatePath("/circuit/classement/ecuries");
}

type SanitizedRaceEntry = {
  driver_name: string;
  team_name: string;
};

function entryText(value: FormDataEntryValue | undefined): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
}

function parseRaceEntriesFromFormData(
  formData: FormData,
): SanitizedRaceEntry[] | null {
  const driverValues = formData.getAll("driver_name");
  const teamValues = formData.getAll("team_name");

  if (
    driverValues.length !== teamValues.length ||
    driverValues.length < 1 ||
    driverValues.length > 40
  ) {
    return null;
  }

  const entries: SanitizedRaceEntry[] = [];

  for (let index = 0; index < driverValues.length; index += 1) {
    const driverName = entryText(driverValues[index]);
    const teamName = entryText(teamValues[index]);

    if (!driverName && !teamName) continue;
    if (!driverName || !teamName) return null;

    entries.push({
      driver_name: driverName,
      team_name: teamName,
    });
  }

  return entries.length > 0 ? entries : null;
}

export async function createRaceControlEvent(formData: FormData) {
  const title = text(formData.get("title"), 160);
  const competitionType = text(
    formData.get("competition_type"),
    20,
  );
  const targetLaps = integer(formData.get("target_laps"));
  const entries = parseRaceEntriesFromFormData(formData);

  if (
    !title ||
    !["f1", "gt3rs", "general"].includes(competitionType) ||
    targetLaps < 1 ||
    targetLaps > 999 ||
    !entries
  ) {
    redirect(
      "/dashboard/commissaires/chronometrage?error=invalid",
    );
  }

  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) redirect("/");
  if (!allowed) redirect("/accueil");

  const { data, error } = await supabase.rpc(
    "nostra_create_race_control_event",
    {
      p_title: title,
      p_competition_type: competitionType,
      p_target_laps: targetLaps,
      p_entries: entries,
    },
  );

  if (error || !data) {
    redirect(
      `/dashboard/commissaires/chronometrage?error=${actionErrorCode(
        error,
      )}`,
    );
  }

  revalidateRaceLists(Number(data));
  redirect(
    `/dashboard/commissaires/chronometrage/${Number(
      data,
    )}?created=1`,
  );
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

  void data;
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

  void data;
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

  void data;
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

  revalidateRaceLists(eventId);
  revalidatePublishedRacePages();
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

  revalidateRaceLists(eventId);
  revalidatePublishedRacePages();
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

  revalidatePath("/dashboard/commissaires/chronometrage");
  revalidatePath("/commissaires/chronometrage");
  revalidatePublishedRacePages();

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

  revalidateRaceLists(eventId);
  redirect(
    "/dashboard/commissaires/chronometrage?deleted=1",
  );
}
