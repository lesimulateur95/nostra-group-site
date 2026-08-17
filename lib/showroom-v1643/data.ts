import { getCatalogVehiclesV51, type CatalogVehicleV51 } from "@/lib/catalogues-v51/data";
import { createClient } from "@/lib/supabase/server";

export type ShowroomPhysicalUnitV1643 = {
  id: number;
  unitCode: string;
  vehicleId: number;
  status: string;
  location: string;
  isDemo: boolean;
  demoMileage: number;
  demoOriginalPrice: number | null;
  demoNote: string;
  showroomSince: string | null;
  holdId: number | null;
  orderId: number | null;
};

export type ShowroomVehicleV1643 = {
  vehicle: CatalogVehicleV51;
  physicalUnits: ShowroomPhysicalUnitV1643[];
  showroomUnits: ShowroomPhysicalUnitV1643[];
  availableUnits: ShowroomPhysicalUnitV1643[];
  showroomCount: number;
  demoCount: number;
  allocatableCount: number;
};

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getShowroomManagementV1643(): Promise<{
  configured: boolean;
  vehicles: ShowroomVehicleV1643[];
}> {
  const supabase = await createClient();
  const vehicles = (await getCatalogVehiclesV51({ includeUnpublished: true })).filter(
    (vehicle) => vehicle.catalog_type !== "used",
  );

  const { data, error } = await (supabase as any)
    .from("motors_physical_vehicle_units_v162")
    .select(
      "id,unit_code,catalog_vehicle_id,status,location,is_demo,demo_mileage,demo_original_price,demo_note,showroom_since,hold_id,order_id",
    )
    .in(
      "catalog_vehicle_id",
      vehicles.map((vehicle) => vehicle.id),
    )
    .order("catalog_vehicle_id")
    .order("id");

  if (error) return { configured: false, vehicles: vehicles.map((vehicle) => ({
    vehicle,
    physicalUnits: [],
    showroomUnits: [],
    availableUnits: [],
    showroomCount: 0,
    demoCount: 0,
    allocatableCount: 0,
  })) };

  const byVehicle = new Map<number, ShowroomPhysicalUnitV1643[]>();
  for (const row of data ?? []) {
    const vehicleId = asNumber(row.catalog_vehicle_id);
    const unit: ShowroomPhysicalUnitV1643 = {
      id: asNumber(row.id),
      unitCode: String(row.unit_code ?? ""),
      vehicleId,
      status: String(row.status ?? "stock"),
      location: String(row.location ?? ""),
      isDemo: row.is_demo === true,
      demoMileage: Math.max(0, asNumber(row.demo_mileage)),
      demoOriginalPrice:
        row.demo_original_price == null ? null : Math.max(0, asNumber(row.demo_original_price)),
      demoNote: String(row.demo_note ?? ""),
      showroomSince: typeof row.showroom_since === "string" ? row.showroom_since : null,
      holdId: row.hold_id == null ? null : asNumber(row.hold_id),
      orderId: row.order_id == null ? null : asNumber(row.order_id),
    };
    const list = byVehicle.get(vehicleId) ?? [];
    list.push(unit);
    byVehicle.set(vehicleId, list);
  }

  return {
    configured: true,
    vehicles: vehicles.map((vehicle) => {
      const physicalUnits = byVehicle.get(vehicle.id) ?? [];
      const showroomUnits = physicalUnits.filter((unit) => unit.status === "showroom");
      const availableUnits = physicalUnits.filter(
        (unit) =>
          ["stock", "arrived", "showroom"].includes(unit.status) &&
          unit.holdId == null &&
          unit.orderId == null,
      );
      return {
        vehicle,
        physicalUnits,
        showroomUnits,
        availableUnits,
        showroomCount: showroomUnits.length,
        demoCount: showroomUnits.filter((unit) => unit.isDemo).length,
        allocatableCount: availableUnits.length,
      };
    }),
  };
}
