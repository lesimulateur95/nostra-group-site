
import { createClient } from "@/lib/supabase/server";
import type {
  DriverStanding,
  PublicRaceResultEvent,
  RaceDashboardState,
  RaceEventState,
  TeamStanding,
} from "@/lib/race-control/types";

export async function getRaceControlModuleConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("race_control_events")
    .select("id", { head: true, count: "exact" });

  return !error;
}

export async function getRaceControlDashboardState(): Promise<RaceDashboardState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_race_control_dashboard_state",
  );

  if (error) {
    return {
      configured: false,
      events: [],
    };
  }

  return data as RaceDashboardState;
}

export async function getRaceControlEventState(
  eventId: number,
): Promise<RaceEventState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_race_control_event_state",
    {
      p_event_id: eventId,
    },
  );

  if (error) {
    return {
      configured: false,
      server_now: new Date().toISOString(),
      event: null,
      entries: [],
      best_lap: null,
    };
  }

  return data as RaceEventState;
}

export async function getPublicRaceResults(
  competitionType: "f1" | "gt3rs",
): Promise<PublicRaceResultEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_public_race_results",
    {
      p_competition_type: competitionType,
    },
  );

  if (error) return [];
  return (data ?? []) as PublicRaceResultEvent[];
}

export async function getPublicDriverStandings(
  competitionType: "f1" | "gt3rs",
): Promise<DriverStanding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_public_driver_standings",
    {
      p_competition_type: competitionType,
    },
  );

  if (error) return [];
  return (data ?? []) as DriverStanding[];
}

export async function getPublicTeamStandings(
  competitionType: "f1" | "gt3rs",
): Promise<TeamStanding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_public_team_standings",
    {
      p_competition_type: competitionType,
    },
  );

  if (error) return [];
  return (data ?? []) as TeamStanding[];
}
