
import { createClient } from "@/lib/supabase/server";
import type {
  CircuitLapRecord,
  EventStanding,
  SpecialRankingsDashboardState,
  TimeTrialRecord,
} from "@/lib/special-rankings/types";

export async function getSpecialRankingsConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("circuit_event_scores")
    .select("id", { head: true, count: "exact" });

  return !error;
}

export async function getSpecialRankingsDashboardState(): Promise<SpecialRankingsDashboardState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_special_rankings_dashboard_state",
  );

  if (error) {
    return {
      configured: false,
      event_scores: [],
      time_trials: [],
      lap_records: [],
    };
  }

  return data as SpecialRankingsDashboardState;
}

export async function getEventStandings(): Promise<EventStanding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_public_event_standings",
  );

  if (error) return [];
  return (data ?? []) as EventStanding[];
}

export async function getTimeTrialRankings(): Promise<TimeTrialRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_public_time_trial_rankings",
  );

  if (error) return [];
  return (data ?? []) as TimeTrialRecord[];
}

export async function getCircuitLapRecords(): Promise<CircuitLapRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "nostra_get_public_circuit_lap_records",
  );

  if (error) return [];
  return (data ?? []) as CircuitLapRecord[];
}
