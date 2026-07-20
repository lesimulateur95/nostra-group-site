
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasCommissionerAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

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

function parseTimeText(value: FormDataEntryValue | null): number {
  const raw = text(value, 30).replace(",", ".");
  if (!raw) return 0;

  if (/^\d+(\.\d{1,3})?$/.test(raw)) {
    return Math.round(Number(raw) * 1000);
  }

  const parts = raw.split(":");

  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);

    if (
      Number.isFinite(minutes) &&
      Number.isFinite(seconds) &&
      minutes >= 0 &&
      seconds >= 0 &&
      seconds < 60
    ) {
      return Math.round((minutes * 60 + seconds) * 1000);
    }
  }

  if (parts.length === 3) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);

    if (
      Number.isFinite(hours) &&
      Number.isFinite(minutes) &&
      Number.isFinite(seconds) &&
      hours >= 0 &&
      minutes >= 0 &&
      minutes < 60 &&
      seconds >= 0 &&
      seconds < 60
    ) {
      return Math.round(
        (hours * 3600 + minutes * 60 + seconds) * 1000,
      );
    }
  }

  return 0;
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

  return {
    supabase,
    authenticated: true as const,
    allowed: await hasCommissionerAccess(data.user),
  };
}

function refreshRankings() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/commissaires/classements-speciaux");
  revalidatePath("/circuit/classement");
  revalidatePath("/circuit/classement/evenements");
  revalidatePath("/circuit/classement/contre-la-montre");
  revalidatePath("/circuit/classement/records-tour");
}

export async function addEventRankingResult(formData: FormData) {
  const eventName = text(formData.get("event_name"), 160);
  const eventDate = text(formData.get("event_date"), 20);
  const driverName = text(formData.get("driver_name"), 120);
  const teamName = text(formData.get("team_name"), 120);
  const position = integer(formData.get("finishing_position"));
  const points = integer(formData.get("points"));
  const note = text(formData.get("note"), 500);

  if (
    !eventName ||
    !eventDate ||
    !driverName ||
    !teamName ||
    position < 1 ||
    points < 0
  ) {
    redirect(
      "/dashboard/commissaires/classements-speciaux?error=event",
    );
  }

  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) redirect("/");
  if (!allowed) redirect("/accueil");

  const { error } = await supabase.rpc(
    "nostra_add_event_ranking_result",
    {
      p_event_name: eventName,
      p_event_date: eventDate,
      p_driver_name: driverName,
      p_team_name: teamName,
      p_finishing_position: position,
      p_points: points,
      p_note: note || null,
    },
  );

  if (error) {
    redirect(
      "/dashboard/commissaires/classements-speciaux?error=save",
    );
  }

  refreshRankings();
  redirect(
    "/dashboard/commissaires/classements-speciaux?added=event",
  );
}

export async function addTimeTrialResult(formData: FormData) {
  const courseName = text(formData.get("course_name"), 160);
  const driverName = text(formData.get("driver_name"), 120);
  const teamName = text(formData.get("team_name"), 120);
  const vehicleName = text(formData.get("vehicle_name"), 160);
  const attemptDate = text(formData.get("attempt_date"), 20);
  const timeMs = parseTimeText(formData.get("time_text"));
  const note = text(formData.get("note"), 500);

  if (
    !courseName ||
    !driverName ||
    !teamName ||
    !vehicleName ||
    !attemptDate ||
    timeMs < 500
  ) {
    redirect(
      "/dashboard/commissaires/classements-speciaux?error=time_trial",
    );
  }

  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) redirect("/");
  if (!allowed) redirect("/accueil");

  const { error } = await supabase.rpc(
    "nostra_add_time_trial_result",
    {
      p_course_name: courseName,
      p_driver_name: driverName,
      p_team_name: teamName,
      p_vehicle_name: vehicleName,
      p_time_ms: timeMs,
      p_attempt_date: attemptDate,
      p_note: note || null,
    },
  );

  if (error) {
    redirect(
      "/dashboard/commissaires/classements-speciaux?error=save",
    );
  }

  refreshRankings();
  redirect(
    "/dashboard/commissaires/classements-speciaux?added=time_trial",
  );
}

export async function addCircuitLapRecord(formData: FormData) {
  const circuitLayout = text(formData.get("circuit_layout"), 160);
  const driverName = text(formData.get("driver_name"), 120);
  const teamName = text(formData.get("team_name"), 120);
  const vehicleName = text(formData.get("vehicle_name"), 160);
  const recordDate = text(formData.get("record_date"), 20);
  const lapTimeMs = parseTimeText(formData.get("time_text"));
  const note = text(formData.get("note"), 500);

  if (
    !circuitLayout ||
    !driverName ||
    !teamName ||
    !vehicleName ||
    !recordDate ||
    lapTimeMs < 500
  ) {
    redirect(
      "/dashboard/commissaires/classements-speciaux?error=lap_record",
    );
  }

  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) redirect("/");
  if (!allowed) redirect("/accueil");

  const { error } = await supabase.rpc(
    "nostra_add_circuit_lap_record",
    {
      p_circuit_layout: circuitLayout,
      p_driver_name: driverName,
      p_team_name: teamName,
      p_vehicle_name: vehicleName,
      p_lap_time_ms: lapTimeMs,
      p_record_date: recordDate,
      p_note: note || null,
    },
  );

  if (error) {
    redirect(
      "/dashboard/commissaires/classements-speciaux?error=save",
    );
  }

  refreshRankings();
  redirect(
    "/dashboard/commissaires/classements-speciaux?added=lap_record",
  );
}

export async function deleteSpecialRankingEntry(formData: FormData) {
  const recordType = text(formData.get("record_type"), 30);
  const recordId = integer(formData.get("record_id"));

  if (
    !["event", "time_trial", "lap_record"].includes(recordType) ||
    recordId <= 0
  ) {
    redirect(
      "/dashboard/commissaires/classements-speciaux?error=delete",
    );
  }

  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) redirect("/");
  if (!allowed) redirect("/accueil");

  const { error } = await supabase.rpc(
    "nostra_delete_special_ranking_entry",
    {
      p_record_type: recordType,
      p_record_id: recordId,
    },
  );

  if (error) {
    redirect(
      "/dashboard/commissaires/classements-speciaux?error=delete",
    );
  }

  refreshRankings();
  redirect(
    "/dashboard/commissaires/classements-speciaux?deleted=1",
  );
}

export async function resetSpecialRanking(formData: FormData) {
  const scope = text(formData.get("scope"), 30);
  const confirmed = formData.get("confirmed") === "yes";

  if (
    !["event", "time_trial", "lap_record", "all"].includes(scope) ||
    !confirmed
  ) {
    redirect(
      "/dashboard/commissaires/classements-speciaux?error=reset",
    );
  }

  const { supabase, authenticated, allowed } =
    await requireCommissioner();

  if (!authenticated) redirect("/");
  if (!allowed) redirect("/accueil");

  const { error } = await supabase.rpc(
    "nostra_reset_special_rankings",
    {
      p_scope: scope,
    },
  );

  if (error) {
    redirect(
      "/dashboard/commissaires/classements-speciaux?error=reset",
    );
  }

  refreshRankings();
  redirect(
    `/dashboard/commissaires/classements-speciaux?reset=${scope}`,
  );
}
