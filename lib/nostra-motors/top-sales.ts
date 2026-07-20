import { createClient } from "@/lib/supabase/server";
import {
  getPublicCatalogVehiclesV41,
  vehicleLabel,
  type CatalogVehicleV41,
} from "@/lib/nostra-motors/v41-data";

export type TopSaleAnnouncement = {
  id: string;
  vehicle_id: string;
  created_at: string;
  created_by: string | null;
};

export type TopSaleVehicle = {
  announcement: TopSaleAnnouncement;
  vehicle: CatalogVehicleV41;
  label: string;
};

export async function getTopSaleAnnouncements(): Promise<
  TopSaleAnnouncement[]
> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("motors_top_sales")
      .select("id, vehicle_id, created_at, created_by")
      .order("created_at", { ascending: false });

    if (error) return [];
    return (data ?? []) as TopSaleAnnouncement[];
  } catch {
    return [];
  }
}

export async function getTopSaleVehicles(): Promise<TopSaleVehicle[]> {
  const [announcements, catalog] = await Promise.all([
    getTopSaleAnnouncements(),
    getPublicCatalogVehiclesV41(),
  ]);

  const catalogById = new Map(
    catalog.map((vehicle) => [String(vehicle.id), vehicle]),
  );

  return announcements.flatMap((announcement) => {
    const vehicle = catalogById.get(String(announcement.vehicle_id));
    if (!vehicle) return [];

    return [
      {
        announcement,
        vehicle,
        label: vehicleLabel(vehicle),
      },
    ];
  });
}

export async function isTopSalesModuleConfigured(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("motors_top_sales")
      .select("id", { head: true, count: "exact" });

    return !error;
  } catch {
    return false;
  }
}
