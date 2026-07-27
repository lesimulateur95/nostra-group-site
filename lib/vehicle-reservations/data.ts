import { createClient } from "@/lib/supabase/server";

export type VehicleReservationStatus =
  | "pending_validation"
  | "balance_due"
  | "paid_full"
  | "preparing"
  | "ready"
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
  internal_note: string | null;
  assigned_staff: string | null;
  payment_due_at: string | null;
  stock_reserved: boolean;
  deposit_paid_at: string;
  validated_at: string | null;
  balance_added_at: string | null;
  balance_paid_at: string | null;
  preparation_started_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
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
  "assigned_staff",
  "payment_due_at",
  "stock_reserved",
  "deposit_paid_at",
  "validated_at",
  "balance_added_at",
  "balance_paid_at",
  "preparation_started_at",
  "ready_at",
  "delivered_at",
  "rejected_at",
  "final_order_id",
  "final_order_number",
  "created_at",
  "updated_at",
].join(",");

function normalize(
  row: Record<string, unknown>,
  internalNote: string | null = null,
): VehicleReservation {
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
    internal_note: internalNote,
  } as VehicleReservation;
}

export async function getVehicleReservationsConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const [reservationsResult, privateResult] = await Promise.all([
    supabase
      .from("vehicle_reservations")
      .select(
        "id,assigned_staff,payment_due_at,preparation_started_at,ready_at,delivered_at",
      )
      .limit(1),
    supabase
      .from("vehicle_reservation_private_v96")
      .select("reservation_id,internal_note")
      .limit(1),
  ]);
  return !reservationsResult.error && !privateResult.error;
}

export async function getVehicleReservations(): Promise<VehicleReservation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_reservations")
    .select(columns)
    .order("created_at", { ascending: false });
  if (error) return [];

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const ids = rows.map((row) => Number(row.id)).filter((id) => id > 0);
  if (ids.length === 0) return [];

  const { data: privateRows } = await supabase
    .from("vehicle_reservation_private_v96")
    .select("reservation_id,internal_note")
    .in("reservation_id", ids);

  const privateNotes = new Map<number, string | null>();
  for (const privateRow of (privateRows ?? []) as unknown as Record<
    string,
    unknown
  >[]) {
    privateNotes.set(
      Number(privateRow.reservation_id),
      typeof privateRow.internal_note === "string"
        ? privateRow.internal_note
        : null,
    );
  }

  return rows.map((row) =>
    normalize(row, privateNotes.get(Number(row.id)) ?? null),
  );
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
  return rows.map((row) => normalize(row));
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
    preparing: reservations.filter((item) =>
      ["paid_full", "preparing", "ready"].includes(item.status),
    ).length,
    overdue: reservations.filter(
      (item) =>
        item.status === "balance_due" &&
        item.payment_due_at &&
        new Date(item.payment_due_at).getTime() < Date.now(),
    ).length,
    active: reservations.filter((item) =>
      [
        "pending_validation",
        "balance_due",
        "paid_full",
        "preparing",
        "ready",
      ].includes(item.status),
    ).length,
  };
}
