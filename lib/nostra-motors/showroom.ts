import { createClient } from "@/lib/supabase/server";

export type ShowroomState = {
  vehicle_id: number;
  visible: boolean;
};

export async function getShowroomConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("catalog_vehicles")
    .select("id,showroom_visible")
    .limit(1);

  return !error;
}

export async function getShowroomStateMap(
  vehicleIds: number[],
): Promise<Map<number, boolean>> {
  const ids = [...new Set(vehicleIds.filter((id) => Number.isFinite(id) && id > 0))];
  const result = new Map<number, boolean>();

  for (const id of ids) result.set(id, false);
  if (ids.length === 0) return result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_vehicles")
    .select("id,showroom_visible")
    .in("id", ids);

  if (error || !data) return result;

  for (const row of data) {
    result.set(Number(row.id), row.showroom_visible === true);
  }

  return result;
}

export async function getShowroomVehicleIds(): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_vehicles")
    .select("id")
    .eq("showroom_visible", true)
    .neq("catalog_type", "used")
    .order("showroom_updated_at", { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return data.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
}
