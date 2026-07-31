import { createClient } from "@/lib/supabase/server";
import type {
  DriverStanding,
  PublicRaceResultEvent,
  RaceBestLap,
  RaceDashboardState,
  RaceEntry,
  RaceEntryStatus,
  RaceEvent,
  RaceEventState,
  RaceEventStatus,
  RaceLap,
  TeamStanding,
} from "@/lib/race-control/types";

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

function raceEntryStatus(value: unknown): RaceEntryStatus {
  return [
    "ready",
    "running",
    "finished",
    "stopped",
    "dnf",
  ].includes(String(value))
    ? (String(value) as RaceEntryStatus)
    : "ready";
}

function raceEventStatus(value: unknown): RaceEventStatus {
  return [
    "ready",
    "running",
    "finished",
    "published",
    "cancelled",
  ].includes(String(value))
    ? (String(value) as RaceEventStatus)
    : "ready";
}

function normalizeLap(value: unknown): RaceLap | null {
  const row = object(value);
  if (!row) return null;

  const id = numberValue(row.id);
  if (id <= 0) return null;

  return {
    id,
    lap_number: Math.max(0, numberValue(row.lap_number)),
    lap_time_ms: Math.max(0, numberValue(row.lap_time_ms)),
    crossed_at: stringValue(row.crossed_at),
  };
}

function normalizeEntry(value: unknown): RaceEntry | null {
  const row = object(value);
  if (!row) return null;

  const id = numberValue(row.id);
  if (id <= 0) return null;

  const laps = Array.isArray(row.laps)
    ? row.laps
        .map(normalizeLap)
        .filter((lap): lap is RaceLap => lap !== null)
    : [];

  return {
    id,
    driver_name: stringValue(row.driver_name, "Pilote"),
    team_name: stringValue(row.team_name, "Sans écurie"),
    grid_position: Math.max(1, numberValue(row.grid_position, 1)),
    status: raceEntryStatus(row.status),
    lap_count: Math.max(0, numberValue(row.lap_count)),
    last_crossing_at: nullableString(row.last_crossing_at),
    finished_at: nullableString(row.finished_at),
    total_time_ms: nullableNumber(row.total_time_ms),
    pit_started_at: nullableString(row.pit_started_at),
    pit_stop_count: Math.max(0, numberValue(row.pit_stop_count)),
    last_pit_duration_ms: nullableNumber(row.last_pit_duration_ms),
    total_pit_duration_ms: Math.max(
      0,
      numberValue(row.total_pit_duration_ms),
    ),
    best_lap_ms: nullableNumber(row.best_lap_ms),
    last_lap_ms: nullableNumber(row.last_lap_ms),
    position: nullableNumber(row.position),
    championship_points: Math.max(
      0,
      numberValue(row.championship_points),
    ),
    laps,
  };
}

function normalizeEvent(value: unknown): RaceEvent | null {
  const row = object(value);
  if (!row) return null;

  const id = numberValue(row.id);
  if (id <= 0) return null;

  const competitionType = String(row.competition_type);

  return {
    id,
    title: stringValue(row.title, "Course"),
    competition_type: ["f1", "gt3rs", "general"].includes(
      competitionType,
    )
      ? (competitionType as RaceEvent["competition_type"])
      : "general",
    target_laps: Math.max(1, numberValue(row.target_laps, 1)),
    status: raceEventStatus(row.status),
    started_at: nullableString(row.started_at),
    completed_at: nullableString(row.completed_at),
    published_at: nullableString(row.published_at),
    created_at: stringValue(row.created_at),
  };
}

function normalizeBestLap(value: unknown): RaceBestLap {
  const row = object(value);
  if (!row) return null;

  const entryId = numberValue(row.entry_id);
  const lapNumber = numberValue(row.lap_number);
  const lapTimeMs = numberValue(row.lap_time_ms);

  if (entryId <= 0 || lapNumber <= 0 || lapTimeMs <= 0) {
    return null;
  }

  return {
    entry_id: entryId,
    driver_name: stringValue(row.driver_name, "Pilote"),
    team_name: stringValue(row.team_name, "Sans écurie"),
    lap_number: lapNumber,
    lap_time_ms: lapTimeMs,
  };
}

function emptyRaceEventState(): RaceEventState {
  return {
    configured: false,
    server_now: new Date().toISOString(),
    event: null,
    entries: [],
    best_lap: null,
  };
}

function normalizeRaceEventState(value: unknown): RaceEventState {
  const row = object(value);
  if (!row) return emptyRaceEventState();

  const event = normalizeEvent(row.event);
  const entries = Array.isArray(row.entries)
    ? row.entries
        .map(normalizeEntry)
        .filter((entry): entry is RaceEntry => entry !== null)
    : [];

  const parsedServerNow = Date.parse(stringValue(row.server_now));

  return {
    configured: row.configured !== false,
    server_now: Number.isFinite(parsedServerNow)
      ? new Date(parsedServerNow).toISOString()
      : new Date().toISOString(),
    event,
    entries,
    best_lap: normalizeBestLap(row.best_lap),
  };
}

async function shortDelay() {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

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

  if (error || !data || typeof data !== "object") {
    return {
      configured: false,
      events: [],
    };
  }

  const state = data as Partial<RaceDashboardState>;

  return {
    configured: state.configured !== false,
    events: Array.isArray(state.events) ? state.events : [],
  };
}

export async function getRaceControlEventState(
  eventId: number,
): Promise<RaceEventState> {
  const supabase = await createClient();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await supabase.rpc(
      "nostra_get_race_control_event_state",
      {
        p_event_id: eventId,
      },
    );

    if (!error && data) {
      return normalizeRaceEventState(data);
    }

    if (attempt === 0) await shortDelay();
  }

  return emptyRaceEventState();
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
