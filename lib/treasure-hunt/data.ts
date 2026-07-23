import { createClient } from "@/lib/supabase/server";

export type TreasureHuntStatus =
  | "draft"
  | "published"
  | "completed"
  | "cancelled";

export type TreasureHuntClue = {
  id: number;
  hunt_id: number;
  position: number;
  title: string;
  content: string;
  zone: string | null;
  image_url: string | null;
  is_revealed: boolean;
  revealed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TreasureHunt = {
  id: number;
  title: string;
  description: string;
  prize: string | null;
  meeting_point: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: TreasureHuntStatus;
  winner_name: string | null;
  winner_note: string | null;
  clue_count: number;
  revealed_clue_count: number;
  created_at: string;
  updated_at: string;
  clues: TreasureHuntClue[];
};

type HuntRow = Omit<TreasureHunt, "clues">;

type RawHuntRow = Omit<
  HuntRow,
  "id" | "clue_count" | "revealed_clue_count"
> & {
  id: number | string;
  clue_count: number | string | null;
  revealed_clue_count: number | string | null;
};

type RawClueRow = Omit<
  TreasureHuntClue,
  "id" | "hunt_id" | "position"
> & {
  id: number | string;
  hunt_id: number | string;
  position: number | string;
};

function groupClues(
  hunts: HuntRow[],
  clues: TreasureHuntClue[],
): TreasureHunt[] {
  const cluesByHunt = new Map<number, TreasureHuntClue[]>();

  for (const clue of clues) {
    const current = cluesByHunt.get(clue.hunt_id) ?? [];
    current.push(clue);
    cluesByHunt.set(clue.hunt_id, current);
  }

  return hunts.map((hunt) => ({
    ...hunt,
    clues: (cluesByHunt.get(hunt.id) ?? []).sort(
      (a, b) => a.position - b.position,
    ),
  }));
}

export async function getAllTreasureHunts(): Promise<TreasureHunt[]> {
  const supabase = await createClient();

  const huntsResult = await supabase
    .from("treasure_hunts")
    .select(
      "id,title,description,prize,meeting_point,starts_at,ends_at,status,winner_name,winner_note,clue_count,revealed_clue_count,created_at,updated_at",
    )
    .order("created_at", { ascending: false });

  if (huntsResult.error || !huntsResult.data) {
    return [];
  }

  const huntIds = huntsResult.data.map((hunt: RawHuntRow) => Number(hunt.id));
  if (huntIds.length === 0) return [];

  const cluesResult = await supabase
    .from("treasure_hunt_clues")
    .select(
      "id,hunt_id,position,title,content,zone,image_url,is_revealed,revealed_at,created_at,updated_at",
    )
    .in("hunt_id", huntIds)
    .order("position", { ascending: true });

  return groupClues(
    huntsResult.data.map((hunt: RawHuntRow) => ({
      ...hunt,
      id: Number(hunt.id),
      clue_count: Number(hunt.clue_count ?? 0),
      revealed_clue_count: Number(hunt.revealed_clue_count ?? 0),
    })) as HuntRow[],
    (cluesResult.data ?? []).map((clue: RawClueRow) => ({
      ...clue,
      id: Number(clue.id),
      hunt_id: Number(clue.hunt_id),
      position: Number(clue.position),
    })) as TreasureHuntClue[],
  );
}

export async function getPublishedTreasureHunts(): Promise<TreasureHunt[]> {
  const supabase = await createClient();

  const huntsResult = await supabase
    .from("treasure_hunts")
    .select(
      "id,title,description,prize,meeting_point,starts_at,ends_at,status,winner_name,winner_note,clue_count,revealed_clue_count,created_at,updated_at",
    )
    .in("status", ["published", "completed"])
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (huntsResult.error || !huntsResult.data) {
    return [];
  }

  const huntIds = huntsResult.data.map((hunt: RawHuntRow) => Number(hunt.id));
  if (huntIds.length === 0) return [];

  const cluesResult = await supabase
    .from("treasure_hunt_clues")
    .select(
      "id,hunt_id,position,title,content,zone,image_url,is_revealed,revealed_at,created_at,updated_at",
    )
    .in("hunt_id", huntIds)
    .eq("is_revealed", true)
    .order("position", { ascending: true });

  return groupClues(
    huntsResult.data.map((hunt: RawHuntRow) => ({
      ...hunt,
      id: Number(hunt.id),
      clue_count: Number(hunt.clue_count ?? 0),
      revealed_clue_count: Number(hunt.revealed_clue_count ?? 0),
    })) as HuntRow[],
    (cluesResult.data ?? []).map((clue: RawClueRow) => ({
      ...clue,
      id: Number(clue.id),
      hunt_id: Number(clue.hunt_id),
      position: Number(clue.position),
    })) as TreasureHuntClue[],
  );
}
