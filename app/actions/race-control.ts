
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

function revalidateRace(eventId: number) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commissaires/chronometrage");
  revalidatePath(
    `/dashboard/commissaires/chronometrage/${eventId}`,
  );
  revalidatePath("/circuit/championnat-f1/resultats");
  revalidatePath("/circuit/championnat-gt3rs/resultats");
  revalidatePath("/circuit/classement/f1");
  revalidatePath("/circuit/classement/gt3rs");
  revalidatePath("/circuit/classement/ecuries");
}

export async function createRaceControlEvent(formData: FormData) {
  const title = text(formData.get("title"), 160);
  const competitionType = text(
    formData.get("competition_type"),
    20,
  );
  const targetLaps = integer(formData.get("target_laps"));
  const entriesJson = text(formData.get("entries_json"), 20000);

  let entries: unknown = null;

  try {
    entries = JSON.parse(entriesJson);
  } catch {
    redirect(
      "/dashboard/commissaires/chronometrage?error=entries",
    );
  }

  if (
    !title ||
    !["f1", "gt3rs", "general"].includes(competitionType) ||
    targetLaps < 1 ||
    targetLaps > 999
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

  revalidateRace(Number(data));
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
