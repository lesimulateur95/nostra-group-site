
export type EventStanding = {
  position: number;
  driver_name: string;
  teams: string;
  points: number;
  events: number;
  wins: number;
  podiums: number;
};

export type EventScoreRecord = {
  id: number;
  event_name: string;
  event_date: string;
  driver_name: string;
  team_name: string;
  finishing_position: number;
  points: number;
  note: string | null;
  created_at: string;
};

export type TimeTrialRecord = {
  id: number;
  rank: number;
  course_name: string;
  driver_name: string;
  team_name: string;
  vehicle_name: string;
  time_ms: number;
  attempt_date: string;
  note: string | null;
  created_at: string;
};

export type CircuitLapRecord = {
  id: number;
  rank: number;
  circuit_layout: string;
  driver_name: string;
  team_name: string;
  vehicle_name: string;
  lap_time_ms: number;
  record_date: string;
  note: string | null;
  created_at: string;
};

export type SpecialRankingsDashboardState = {
  configured: boolean;
  event_scores: EventScoreRecord[];
  time_trials: TimeTrialRecord[];
  lap_records: CircuitLapRecord[];
};
