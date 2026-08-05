import { createClient } from "@/lib/supabase/server";

export type ConsignmentImageV134 = { path: string; url: string };
export type VehicleConsignmentV134 = {
  id: number; consignment_number: string; user_id: string; owner_name: string;
  owner_email: string | null; owner_phone: string | null; brand: string; model: string;
  version: string | null; registration: string | null; mileage: number;
  first_registration_year: number | null; vehicle_condition: string; description: string;
  images: ConsignmentImageV134[]; desired_price: number; agreed_sale_price: number | null;
  commission_rate: number | null; commission_amount: number | null; owner_net_amount: number | null;
  status: string; assigned_staff: string | null; public_description: string | null;
  staff_note: string | null; customer_accepted_at: string | null;
  catalog_vehicle_id: number | null; sold_order_id: number | null; sold_at: string | null;
  owner_paid_at: string | null; created_at: string; updated_at: string;
};

const columns = "id,consignment_number,user_id,owner_name,owner_email,owner_phone,brand,model,version,registration,mileage,first_registration_year,vehicle_condition,description,images,desired_price,agreed_sale_price,commission_rate,commission_amount,owner_net_amount,status,assigned_staff,public_description,staff_note,customer_accepted_at,catalog_vehicle_id,sold_order_id,sold_at,owner_paid_at,created_at,updated_at";

function normalize(row: Record<string, unknown>): VehicleConsignmentV134 {
  const images = Array.isArray(row.images) ? row.images.filter((item): item is ConsignmentImageV134 => Boolean(item && typeof item === "object" && "url" in item && "path" in item)) : [];
  return { ...row, id: Number(row.id), mileage: Number(row.mileage), first_registration_year: row.first_registration_year == null ? null : Number(row.first_registration_year), desired_price: Number(row.desired_price), agreed_sale_price: row.agreed_sale_price == null ? null : Number(row.agreed_sale_price), commission_rate: row.commission_rate == null ? null : Number(row.commission_rate), commission_amount: row.commission_amount == null ? null : Number(row.commission_amount), owner_net_amount: row.owner_net_amount == null ? null : Number(row.owner_net_amount), catalog_vehicle_id: row.catalog_vehicle_id == null ? null : Number(row.catalog_vehicle_id), sold_order_id: row.sold_order_id == null ? null : Number(row.sold_order_id), images } as VehicleConsignmentV134;
}

async function load(userId?: string) {
  const supabase = await createClient();
  let query = supabase.from("vehicle_consignments_v134").select(columns).order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) return [];
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalize);
}

export async function getVehicleConsignmentsConfiguredV134() {
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_consignments_v134").select("id").limit(1);
  return !error;
}

export const getVehicleConsignmentsV134 = () => load();
export const getOwnVehicleConsignmentsV134 = (userId: string) => load(userId);

export async function getVehicleConsignmentSummaryV134() {
  const configured = await getVehicleConsignmentsConfiguredV134();
  const rows = configured ? await load() : [];
  return { configured, total: rows.length, pending: rows.filter((row) => ["new", "reviewing", "offer_sent", "accepted"].includes(row.status)).length, published: rows.filter((row) => row.status === "published").length, sold: rows.filter((row) => row.status === "sold").length };
}
