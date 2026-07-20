export type MotorAppointment = {
  id: string;
  user_id: string | null;
  customer_name: string;
  phone: string;
  email: string | null;
  appointment_type: "showroom" | "test_drive";
  appointment_date: string;
  appointment_time: string;
  vehicle_id: string | null;
  vehicle_label: string | null;
  message: string | null;
  status: "pending" | "confirmed" | "declined" | "completed" | "cancelled";
  direction_note: string | null;
  created_at: string;
};

export type MotorDelivery = Record<string, unknown> & {
  id: string | number;
  status?: string;
  delivery_status?: string;
  delivery_date?: string | null;
  delivery_driver?: string | null;
  delivery_notes?: string | null;
  delivery_address?: string | null;
  delivery_method?: string | null;
};

export type CatalogVehicleV41 = Record<string, unknown> & {
  id: string | number;
  brand?: string | null;
  make?: string | null;
  model?: string | null;
  name?: string | null;
  price?: number | string | null;
  image_url?: string | null;
  photo_url?: string | null;
  quantity?: number | null;
  sales_count?: number | null;
  order_count?: number | null;
  popularity?: number | null;
  views?: number | null;
};

export function vehicleLabel(vehicle: CatalogVehicleV41): string {
  return (
    [vehicle.brand ?? vehicle.make, vehicle.model ?? vehicle.name]
      .filter(Boolean)
      .join(" ") || `Véhicule ${vehicle.id}`
  );
}

export function vehiclePopularityScore(vehicle: CatalogVehicleV41): number {
  return Number(
    vehicle.sales_count ??
      vehicle.order_count ??
      vehicle.popularity ??
      vehicle.views ??
      0,
  );
}
