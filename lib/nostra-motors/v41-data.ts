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

type OrderItem = Record<string, unknown> & {
  item_type?: unknown;
};

const emptyOverview = {
  configured: false,
  pendingAppointments: 0,
  pendingDeliveries: 0,
};

function orderItems(order: Record<string, unknown>): OrderItem[] {
  const rawItems = order.items;

  if (Array.isArray(rawItems)) {
    return rawItems.filter(
      (item): item is OrderItem => Boolean(item) && typeof item === "object",
    );
  }

  if (typeof rawItems === "string") {
    try {
      const parsed: unknown = JSON.parse(rawItems);
      return Array.isArray(parsed)
        ? parsed.filter(
            (item): item is OrderItem =>
              Boolean(item) && typeof item === "object",
          )
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

function isHomeDeliveryOrder(order: Record<string, unknown>): boolean {
  return orderItems(order).some((item) => item.item_type === "delivery");
}

export async function getMotorsV41Overview() {
  try {
    const supabase = await createClient();

    const [appointments, orders] = await Promise.all([
      (supabase as any)
        .from("motors_appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      (supabase as any)
        .from("orders")
        .select("id,items,delivery_status")
        .order("created_at", { ascending: false }),
    ]);

    const pendingDeliveries = orders.error
      ? 0
      : ((orders.data ?? []) as Record<string, unknown>[]).filter((order) => {
          const status = String(order.delivery_status ?? "not_planned");
          return (
            isHomeDeliveryOrder(order) &&
            ["not_planned", "planned", "in_progress"].includes(status)
          );
        }).length;

    return {
      configured: !appointments.error,
      pendingAppointments: appointments.count ?? 0,
      pendingDeliveries,
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
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Nostra Motors] Impossible de charger les livraisons", error);
    return [];
  }

  return ((data ?? []) as MotorDelivery[]).filter((order) =>
    isHomeDeliveryOrder(order),
  );
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
