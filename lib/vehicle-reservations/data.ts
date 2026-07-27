import { createClient } from "@/lib/supabase/server";

export type VehicleReservationStatus =
  | "pending_validation"
  | "balance_due"
  | "paid_full"
  | "rejected"
  | "cancelled"
  | "completed";

export type VehicleReservation = {
  id: number;
  reservation_number: string;
  user_id: string;
  vehicle_id: number;
  customer_name: string;
  vehicle_name: string;
  catalog_type: string;
  quantity: number;
  vehicle_price: number;
  deposit_percent: number;
  deposit_amount: number;
  balance_amount: number;
  delivery_mode: "showroom" | "home";
  delivery_fee: number;
  delivery_address: string | null;
  delivery_phone: string | null;
  status: VehicleReservationStatus;
  admin_note: string | null;
  stock_reserved: boolean;
  deposit_paid_at: string;
  validated_at: string | null;
  balance_added_at: string | null;
  balance_paid_at: string | null;
  rejected_at: string | null;
  final_order_id: number | null;
  final_order_number: string | null;
  created_at: string;
  updated_at: string;
};

const columns = [
  "id",
  "reservation_number",
  "user_id",
  "vehicle_id",
  "customer_name",
  "vehicle_name",
  "catalog_type",
  "quantity",
  "vehicle_price",
  "deposit_percent",
  "deposit_amount",
  "balance_amount",
  "delivery_mode",
  "delivery_fee",
  "delivery_address",
  "delivery_phone",
  "status",
  "admin_note",
  "stock_reserved",
  "deposit_paid_at",
  "validated_at",
  "balance_added_at",
  "balance_paid_at",
  "rejected_at",
  "final_order_id",
  "final_order_number",
  "created_at",
  "updated_at",
].join(",");

function normalize(row: Record<string, unknown>): VehicleReservation {
  return {
    ...row,
    id: Number(row.id),
    vehicle_id: Number(row.vehicle_id),
    quantity: Math.max(1, Number(row.quantity) || 1),
    vehicle_price: Math.max(0, Number(row.vehicle_price) || 0),
    deposit_percent: Math.max(0, Number(row.deposit_percent) || 15),
    deposit_amount: Math.max(0, Number(row.deposit_amount) || 0),
    balance_amount: Math.max(0, Number(row.balance_amount) || 0),
    delivery_fee: Math.max(0, Number(row.delivery_fee) || 0),
    final_order_id: row.final_order_id ? Number(row.final_order_id) : null,
  } as VehicleReservation;
}

export async function getVehicleReservationsConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicle_reservations")
    .select("id")
    .limit(1);
  return !error;
}

export async function getVehicleReservations(): Promise<VehicleReservation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_reservations")
    .select(columns)
    .order("created_at", { ascending: false });
  if (error) return [];
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  return rows.map(normalize);
}

export async function getOwnVehicleReservations(
  userId: string,
): Promise<VehicleReservation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_reservations")
    .select(columns)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  return rows.map(normalize);
}

export async function getVehicleReservationSummary() {
  const [configured, reservations] = await Promise.all([
    getVehicleReservationsConfigured(),
    getVehicleReservations(),
  ]);
  return {
    configured,
    pending: reservations.filter((item) => item.status === "pending_validation")
      .length,
    balanceDue: reservations.filter((item) => item.status === "balance_due")
      .length,
    active: reservations.filter((item) =>
      ["pending_validation", "balance_due", "paid_full"].includes(item.status),
    ).length,
  };
}
