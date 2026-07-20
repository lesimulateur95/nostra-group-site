
export type RaceCompetitionType = "f1" | "gt3rs" | "general";

export type RaceEventStatus =
  | "ready"
  | "running"
  | "finished"
  | "published"
  | "cancelled";

export type RaceEntryStatus =
  | "ready"
  | "running"
  | "finished"
  | "dnf";

export type RaceLap = {
  id: number;
  lap_number: number;
  lap_time_ms: number;
  crossed_at: string;
};

export type RaceEntry = {
  id: number;
  driver_name: string;
  team_name: string;
  grid_position: number;
  status: RaceEntryStatus;
  lap_count: number;
  last_crossing_at: string | null;
  finished_at: string | null;
  total_time_ms: number | null;
  best_lap_ms: number | null;
  last_lap_ms: number | null;
  position: number | null;
  championship_points: number;
  laps: RaceLap[];
};

export type RaceBestLap = {
  entry_id: number;
  driver_name: string;
  team_name: string;
  lap_number: number;
  lap_time_ms: number;
} | null;

export type RaceEvent = {
  id: number;
  title: string;
  competition_type: RaceCompetitionType;
  target_laps: number;
  status: RaceEventStatus;
  started_at: string | null;
  completed_at: string | null;
  published_at: string | null;
  created_at: string;
};

export type RaceEventState = {
  configured: boolean;
  server_now: string;
  event: RaceEvent | null;
  entries: RaceEntry[];
  best_lap: RaceBestLap;
};

export type RaceEventSummary = RaceEvent & {
  participant_count: number;
  active_count: number;
  finished_count: number;
};

export type RaceDashboardState = {
  configured: boolean;
  events: RaceEventSummary[];
};

export type PublicRaceResultEntry = {
  position: number | null;
  driver_name: string;
  team_name: string;
  status: RaceEntryStatus;
  lap_count: number;
  total_time_ms: number | null;
  best_lap_ms: number | null;
  championship_points: number;
};

export type PublicRaceResultEvent = {
  id: number;
  title: string;
  competition_type: RaceCompetitionType;
  target_laps: number;
  started_at: string | null;
  completed_at: string | null;
  published_at: string | null;
  best_lap: RaceBestLap;
  entries: PublicRaceResultEntry[];
};

export type DriverStanding = {
  position: number;
  driver_name: string;
  teams: string;
  points: number;
  races: number;
  wins: number;
  podiums: number;
  best_laps: number;
};

export type TeamStanding = {
  position: number;
  team_name: string;
  points: number;
  races: number;
  wins: number;
  podiums: number;
  best_laps: number;
};
