import { createClient } from "@/lib/supabase/server";

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

const emptyOverview = {
  configured: false,
  pendingAppointments: 0,
  pendingDeliveries: 0,
};

export async function getMotorsV41Overview() {
  try {
    const supabase = await createClient();
    const appointmentsQuery = (supabase as any)
      .from("motors_appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const deliveriesQuery = (supabase as any)
      .from("orders")
      .select("id", { count: "exact", head: true })
      .or("delivery_method.eq.home,delivery_method.eq.home_delivery,delivery_address.not.is.null")
      .in("delivery_status", ["not_planned", "planned", "in_progress"]);

    const [appointments, deliveries] = await Promise.all([
      appointmentsQuery,
      deliveriesQuery,
    ]);

    return {
      configured: !appointments.error,
      pendingAppointments: appointments.count ?? 0,
      pendingDeliveries: deliveries.error ? 0 : deliveries.count ?? 0,
    };
  } catch {
    return emptyOverview;
  }
}

export async function getMotorAppointments(): Promise<MotorAppointment[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("motors_appointments")
    .select("*")
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (error) return [];
  return (data ?? []) as MotorAppointment[];
}

export async function getMotorDeliveries(): Promise<MotorDelivery[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("orders")
    .select("*")
    .or("delivery_method.eq.home,delivery_method.eq.home_delivery,delivery_address.not.is.null")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as MotorDelivery[];
}

export async function getPublicCatalogVehiclesV41(): Promise<CatalogVehicleV41[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_vehicles")
    .select("*")
    .order("brand", { ascending: true });

  if (error) return [];
  return (data ?? []) as CatalogVehicleV41[];
}

export function vehicleLabel(vehicle: CatalogVehicleV41): string {
  return [vehicle.brand ?? vehicle.make, vehicle.model ?? vehicle.name]
    .filter(Boolean)
    .join(" ") || `Véhicule ${vehicle.id}`;
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
