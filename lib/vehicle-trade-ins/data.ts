import { createClient } from "@/lib/supabase/server";

export type VehicleTradeInStatus =
  | "new"
  | "reviewing"
  | "offer_sent"
  | "accepted"
  | "refused"
  | "converted"
  | "cancelled";

export type VehicleTradeInImage = {
  path: string;
  url: string;
};

export type VehicleTradeInRequest = {
  id: number;
  request_number: string;
  user_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  brand: string;
  model: string;
  version: string | null;
  registration: string | null;
  mileage: number;
  first_registration_year: number | null;
  vehicle_condition: string;
  modifications: string | null;
  desired_price: number | null;
  description: string;
  images: VehicleTradeInImage[];
  status: VehicleTradeInStatus;
  proposed_purchase_price: number | null;
  planned_resale_price: number | null;
  assigned_staff: string | null;
  appointment_at: string | null;
  admin_note: string | null;
  internal_note: string | null;
  converted_vehicle_id: number | null;
  created_at: string;
  updated_at: string;
};

const columns = [
  "id",
  "request_number",
  "user_id",
  "customer_name",
  "customer_email",
  "customer_phone",
  "brand",
  "model",
  "version",
  "registration",
  "mileage",
  "first_registration_year",
  "vehicle_condition",
  "modifications",
  "desired_price",
  "description",
  "images",
  "status",
  "proposed_purchase_price",
  "assigned_staff",
  "appointment_at",
  "admin_note",
  "converted_vehicle_id",
  "created_at",
  "updated_at",
].join(",");

function normalizeImages(value: unknown): VehicleTradeInImage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.path !== "string" || typeof row.url !== "string") return [];
    return [{ path: row.path, url: row.url }];
  });
}

function normalize(
  row: Record<string, unknown>,
  privateValues?: { plannedResalePrice: number | null; internalNote: string | null },
): VehicleTradeInRequest {
  return {
    ...row,
    id: Number(row.id),
    mileage: Math.max(0, Number(row.mileage) || 0),
    first_registration_year: row.first_registration_year
      ? Number(row.first_registration_year)
      : null,
    desired_price: row.desired_price ? Number(row.desired_price) : null,
    proposed_purchase_price: row.proposed_purchase_price
      ? Number(row.proposed_purchase_price)
      : null,
    planned_resale_price: privateValues?.plannedResalePrice ?? null,
    internal_note: privateValues?.internalNote ?? null,
    converted_vehicle_id: row.converted_vehicle_id
      ? Number(row.converted_vehicle_id)
      : null,
    images: normalizeImages(row.images),
  } as VehicleTradeInRequest;
}

export async function getVehicleTradeInsConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const [requestsResult, privateResult] = await Promise.all([
    supabase
      .from("vehicle_trade_in_requests")
      .select(
        "id,request_number,status,proposed_purchase_price,converted_vehicle_id",
      )
      .limit(1),
    supabase
      .from("vehicle_trade_in_private_v96")
      .select("request_id,planned_resale_price,internal_note")
      .limit(1),
  ]);
  return !requestsResult.error && !privateResult.error;
}

export async function getVehicleTradeInRequests(): Promise<VehicleTradeInRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_trade_in_requests")
    .select(columns)
    .order("created_at", { ascending: false });

  if (error) return [];

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const ids = rows.map((row) => Number(row.id)).filter((id) => id > 0);
  if (ids.length === 0) return [];

  const { data: privateRows } = await supabase
    .from("vehicle_trade_in_private_v96")
    .select("request_id,planned_resale_price,internal_note")
    .in("request_id", ids);

  const privateByRequest = new Map<
    number,
    { plannedResalePrice: number | null; internalNote: string | null }
  >();
  for (const privateRow of (privateRows ?? []) as unknown as Record<
    string,
    unknown
  >[]) {
    privateByRequest.set(Number(privateRow.request_id), {
      plannedResalePrice: privateRow.planned_resale_price
        ? Number(privateRow.planned_resale_price)
        : null,
      internalNote:
        typeof privateRow.internal_note === "string"
          ? privateRow.internal_note
          : null,
    });
  }

  return rows.map((row) => normalize(row, privateByRequest.get(Number(row.id))));
}

export async function getOwnVehicleTradeInRequests(
  userId: string,
): Promise<VehicleTradeInRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicle_trade_in_requests")
    .select(columns)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) =>
    normalize(row),
  );
}

export async function getVehicleTradeInSummary() {
  const [configured, requests] = await Promise.all([
    getVehicleTradeInsConfigured(),
    getVehicleTradeInRequests(),
  ]);

  return {
    configured,
    total: requests.length,
    pending: requests.filter((request) =>
      ["new", "reviewing", "offer_sent", "accepted"].includes(request.status),
    ).length,
    offers: requests.filter((request) => request.status === "offer_sent").length,
  };
}
