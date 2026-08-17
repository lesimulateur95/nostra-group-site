import { createClient } from "@/lib/supabase/server";

export type ShowroomState = {
  vehicle_id: number;
  visible: boolean;
};

export type ShowroomVehicleDetails = {
  showroomCount: number;
  demoCount: number;
  demoMileage: number;
  demoOriginalPrice: number | null;
  demoNote: string;
};

export async function getShowroomConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc("nostra_get_showroom_summary_v1643", {
    p_vehicle_ids: null,
  });
  return !error;
}

export async function getShowroomDetailsMap(
  vehicleIds: number[],
): Promise<Map<number, ShowroomVehicleDetails>> {
  const ids = [...new Set(vehicleIds.filter((id) => Number.isFinite(id) && id > 0))];
  const result = new Map<number, ShowroomVehicleDetails>();
  for (const id of ids) {
    result.set(id, {
      showroomCount: 0,
      demoCount: 0,
      demoMileage: 0,
      demoOriginalPrice: null,
      demoNote: "",
    });
  }
  if (ids.length === 0) return result;

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc("nostra_get_showroom_summary_v1643", {
    p_vehicle_ids: ids,
  });

  if (error || !data) return result;

  for (const row of data) {
    const id = Number(row.catalog_vehicle_id);
    if (!Number.isFinite(id)) continue;
    result.set(id, {
      showroomCount: Math.max(0, Number(row.showroom_count) || 0),
      demoCount: Math.max(0, Number(row.demo_count) || 0),
      demoMileage: Math.max(0, Number(row.demo_mileage) || 0),
      demoOriginalPrice:
        row.demo_original_price == null ? null : Math.max(0, Number(row.demo_original_price) || 0),
      demoNote: String(row.demo_note ?? ""),
    });
  }

  return result;
}

export async function getShowroomStateMap(
  vehicleIds: number[],
): Promise<Map<number, boolean>> {
  const details = await getShowroomDetailsMap(vehicleIds);
  return new Map([...details.entries()].map(([id, value]) => [id, value.showroomCount > 0]));
}

export async function getShowroomVehicleIds(): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc("nostra_get_showroom_summary_v1643", {
    p_vehicle_ids: null,
  });
  if (error || !data) return [];
  return data
    .map((row: any) => Number(row.catalog_vehicle_id))
    .filter((id: number) => Number.isFinite(id));
}
