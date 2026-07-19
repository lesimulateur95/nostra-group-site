"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasCommissionerAccess } from "@/lib/auth/access";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function requireCommissionerAccess() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!(await hasCommissionerAccess(data.user))) redirect("/accueil");
  return { supabase, user: data.user };
}

export async function saveCommissionerRaceBriefing(formData: FormData) {
  const eventTitle = text(formData.get("event_title"), 160);
  const eventDate = text(formData.get("event_date"), 20) || null;
  const standsOpening = text(formData.get("stands_opening"), 20);
  const qualificationsTime = text(formData.get("qualifications_time"), 20);
  const raceStart = text(formData.get("race_start"), 20);
  const vehicle = text(formData.get("vehicle"), 160);
  const lapCount = text(formData.get("lap_count"), 60);
  const weather = text(formData.get("weather"), 160);
  const commissioners = text(formData.get("commissioners"), 1000);
  const raceDirection = text(formData.get("race_direction"), 500);
  const liveAnnouncement = text(formData.get("live_announcement"), 2000);

  const { supabase, user } = await requireCommissionerAccess();
  const { error } = await supabase.from("commissioner_race_briefing").upsert(
    {
      id: 1,
      event_title: eventTitle,
      event_date: eventDate,
      stands_opening: standsOpening,
      qualifications_time: qualificationsTime,
      race_start: raceStart,
      vehicle,
      lap_count: lapCount,
      weather,
      commissioners,
      race_direction: raceDirection,
      live_announcement: liveAnnouncement,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) redirect("/commissaires/briefing-avant-course?error=save");
  revalidatePath("/commissaires/briefing-avant-course");
  redirect("/commissaires/briefing-avant-course?saved=1");
}

export async function createCommissionerIncidentReport(formData: FormData) {
  const incidentDate = text(formData.get("incident_date"), 20);
  const incidentTime = text(formData.get("incident_time"), 20);
  const sessionName = text(formData.get("session_name"), 180);
  const circuitZone = text(formData.get("circuit_zone"), 180);
  const peopleInvolved = text(formData.get("people_involved"), 1000);
  const factualDescription = text(formData.get("factual_description"), 5000);
  const intervention = text(formData.get("intervention"), 5000);
  const witnesses = text(formData.get("witnesses"), 1500) || null;
  const raceDirectionDecision = text(formData.get("race_direction_decision"), 3000) || null;

  if (!incidentDate || !incidentTime || !sessionName || !circuitZone || !peopleInvolved || !factualDescription || !intervention) {
    redirect("/commissaires/incidents-circuit?error=invalid");
  }

  const { supabase, user } = await requireCommissionerAccess();
  const authorName = getRpName(user) || getDiscordName(user);
  const { error } = await supabase.from("commissioner_incident_reports").insert({
    created_by: user.id,
    author_name: authorName,
    incident_date: incidentDate,
    incident_time: incidentTime,
    session_name: sessionName,
    circuit_zone: circuitZone,
    people_involved: peopleInvolved,
    factual_description: factualDescription,
    intervention,
    witnesses,
    race_direction_decision: raceDirectionDecision,
    updated_at: new Date().toISOString(),
  });

  if (error) redirect("/commissaires/incidents-circuit?error=save");
  revalidatePath("/commissaires/incidents-circuit");
  redirect("/commissaires/incidents-circuit?saved=1");
}

export async function deleteCommissionerIncidentReport(formData: FormData) {
  const id = Number.parseInt(text(formData.get("id"), 30), 10);
  if (!Number.isFinite(id)) redirect("/commissaires/incidents-circuit?error=invalid");

  const { supabase } = await requireCommissionerAccess();
  const { error } = await supabase.from("commissioner_incident_reports").delete().eq("id", id);
  if (error) redirect("/commissaires/incidents-circuit?error=delete");
  revalidatePath("/commissaires/incidents-circuit");
  redirect("/commissaires/incidents-circuit?deleted=1");
}
