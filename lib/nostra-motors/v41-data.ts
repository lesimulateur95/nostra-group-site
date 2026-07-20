import { createClient } from "@/lib/supabase/server";
import type {
  CatalogVehicleV41,
  MotorAppointment,
  MotorDelivery,
} from "@/lib/nostra-motors/v41-shared";

// Compatibilité avec les pages serveur déjà ajoutées en V41.
export type {
  CatalogVehicleV41,
  MotorAppointment,
  MotorDelivery,
} from "@/lib/nostra-motors/v41-shared";
export {
  vehicleLabel,
  vehiclePopularityScore,
} from "@/lib/nostra-motors/v41-shared";

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
      .or(
        "delivery_method.eq.home,delivery_method.eq.home_delivery,delivery_address.not.is.null",
      )
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
    .or(
      "delivery_method.eq.home,delivery_method.eq.home_delivery,delivery_address.not.is.null",
    )
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as MotorDelivery[];
}

export async function getPublicCatalogVehiclesV41(): Promise<
  CatalogVehicleV41[]
> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("catalog_vehicles")
    .select("*")
    .order("brand", { ascending: true });

  if (error) return [];
  return (data ?? []) as CatalogVehicleV41[];
}
