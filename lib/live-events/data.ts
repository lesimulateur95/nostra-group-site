import { createClient } from "@/lib/supabase/server";
import {
  EMPTY_BRACKET,
  EMPTY_TABLE,
  type BracketData,
  type CustomTableData,
  type EventCitizen,
  type LiveEventBoard,
  type LiveEventFormat,
  type LiveEventStatus,
} from "@/lib/live-events/types";

type RawRow = Record<string, unknown>;

function asObject(value: unknown): RawRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRow)
    : {};
}

function mapBracket(value: unknown): BracketData {
  const raw = asObject(value);
  const size = raw.size === 4 || raw.size === 16 ? raw.size : 8;
  const participants = Array.isArray(raw.participants)
    ? raw.participants.slice(0, size)
    : [];
  while (participants.length < size) participants.push(null);
  return {
    size,
    participants: participants as Array<EventCitizen | null>,
    winners: asObject(raw.winners) as Record<string, EventCitizen>,
  };
}

function mapTable(value: unknown): CustomTableData {
  const raw = asObject(value);
  return {
    columns: Array.isArray(raw.columns)
      ? (raw.columns as CustomTableData["columns"])
      : EMPTY_TABLE.columns,
    rows: Array.isArray(raw.rows)
      ? (raw.rows as CustomTableData["rows"])
      : [],
  };
}

function mapBoard(row: RawRow): LiveEventBoard {
  return {
    id: Number(row.id),
    title: String(row.title ?? "Événement Nostra"),
    subtitle: String(row.subtitle ?? ""),
    location: String(row.location ?? ""),
    starts_at: typeof row.starts_at === "string" ? row.starts_at : null,
    format: row.format === "table" ? "table" : ("bracket" as LiveEventFormat),
    status: ["draft", "live", "completed"].includes(String(row.status))
      ? (row.status as LiveEventStatus)
      : "draft",
    accent_color: String(row.accent_color ?? "#d4af37"),
    bracket_data: mapBracket(row.bracket_data),
    table_data: mapTable(row.table_data),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function getAllLiveEventBoards(): Promise<LiveEventBoard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("live_event_boards")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => mapBoard(row as RawRow));
}

export async function getPublicLiveEventBoards(): Promise<LiveEventBoard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("live_event_boards")
    .select("*")
    .in("status", ["live", "completed"])
    .order("status", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => mapBoard(row as RawRow));
}

export async function getEventCitizens(): Promise<EventCitizen[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_profiles")
    .select("user_id,rp_first_name,rp_last_name,discord_name")
    .order("rp_last_name", { ascending: true });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => {
    const firstName = String(row.rp_first_name ?? "").trim();
    const lastName = String(row.rp_last_name ?? "").trim();
    return {
      user_id: String(row.user_id),
      name:
        `${firstName} ${lastName}`.trim() ||
        String(row.discord_name ?? "Compte citoyen"),
    };
  });
}

export { EMPTY_BRACKET, EMPTY_TABLE };
