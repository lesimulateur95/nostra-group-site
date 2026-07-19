import { createClient } from "@/lib/supabase/server";

export type ActivitySetting = {
  id: number;
  status: string;
  label: string;
  message: string;
  updated_at?: string | null;
};

export type CircuitSetting = ActivitySetting;
export type MotorsSetting = ActivitySetting;

export type InventoryItem = {
  id: number;
  name: string;
  category: string;
  sku: string | null;
  quantity: number;
  minimum_quantity: number;
  unit_price: number;
  notes: string | null;
  updated_at?: string | null;
};

export type CatalogVehicleImage = {
  url: string;
  path: string;
};

export type CatalogVehicle = {
  id: number;
  brand: string;
  model: string;
  trunk_capacity: string;
  top_speed: string;
  power: string;
  price: number;
  description: string;
  images: CatalogVehicleImage[];
  published: boolean;
  stock_quantity: number;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AccountingEntry = {
  id: number;
  entry_date: string;
  entry_type: "income" | "expense";
  category: string;
  label: string;
  amount: number;
  notes: string | null;
  created_at?: string | null;
};

export type SiteEvent = {
  id: number;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  status: "draft" | "published" | "cancelled" | "completed";
  registration_open: boolean;
  championship?: "general" | "f1" | "gt3rs";
};


export type OrderItemSnapshot = {
  vehicle_id: number | null;
  name: string;
  quantity: number;
  unit_price: number;
  image_url: string | null;
};

export type CustomerOrder = {
  id: number;
  user_id: string;
  order_number: string;
  customer_name: string;
  status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
  total: number;
  items: OrderItemSnapshot[];
  customer_note: string | null;
  admin_note: string | null;
  stock_deducted: boolean;
  created_at: string;
  updated_at: string;
};

export type HomologationRequest = {
  id: number;
  user_id: string;
  request_type: "vehicle" | "team";
  applicant_name: string;
  status: "pending" | "reviewing" | "approved" | "rejected";
  payload: Record<string, unknown>;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export async function getBackofficeConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const checks = await Promise.all([
    supabase.from("circuit_settings").select("id").limit(1),
    supabase.from("custom_circuit_pages").select("id").limit(1),
    supabase.from("member_profiles").select("user_id").limit(1),
    supabase.from("circuit_reservation_requests").select("id").limit(1),
    supabase.from("events").select("championship").limit(1),
    supabase.from("catalog_vehicles").select("id").limit(1),
  ]);
  return checks.every((result) => !result.error);
}

export async function getCircuitSetting(): Promise<CircuitSetting> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circuit_settings")
    .select("id,status,label,message,updated_at")
    .eq("id", 1)
    .maybeSingle();

  return data ?? {
    id: 1,
    status: "unknown",
    label: "État indisponible",
    message: "L’état du circuit n’a pas encore été configuré.",
  };
}

export async function getMotorsStatusConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("motors_settings").select("id").limit(1);
  return !error;
}

export async function getMotorsSetting(): Promise<MotorsSetting> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("motors_settings")
    .select("id,status,label,message,updated_at")
    .eq("id", 1)
    .maybeSingle();

  return data ?? {
    id: 1,
    status: "unknown",
    label: "État indisponible",
    message: "L’état de Nostra Motors n’a pas encore été configuré.",
  };
}

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_items")
    .select("id,name,category,sku,quantity,minimum_quantity,unit_price,notes,updated_at")
    .order("category")
    .order("name");
  return (data ?? []) as InventoryItem[];
}

export async function getCatalogModuleConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("catalog_vehicles").select("id").limit(1);
  return !error;
}

export async function getStockCommerceConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const checks = await Promise.all([
    supabase.from("catalog_vehicles").select("id,stock_quantity").limit(1),
    supabase.from("cart_items").select("id,vehicle_id").limit(1),
    supabase.from("orders").select("id,stock_deducted").limit(1),
  ]);
  return checks.every((result) => !result.error);
}

export async function getCatalogVehicles(includeUnpublished = false): Promise<CatalogVehicle[]> {
  const supabase = await createClient();
  let query = supabase
    .from("catalog_vehicles")
    .select("id,brand,model,trunk_capacity,top_speed,power,price,description,images,published,stock_quantity,sort_order,created_at,updated_at")
    .order("brand")
    .order("sort_order")
    .order("model");

  if (!includeUnpublished) query = query.eq("published", true);
  const { data, error } = await query;
  if (!error) {
    return (data ?? []).map((row) => ({
      ...row,
      stock_quantity: Math.max(0, Number(row.stock_quantity) || 0),
      images: Array.isArray(row.images) ? row.images : [],
    })) as CatalogVehicle[];
  }

  // Compatibilité temporaire avant l'exécution du script V22.
  let legacyQuery = supabase
    .from("catalog_vehicles")
    .select("id,brand,model,trunk_capacity,top_speed,power,price,description,images,published,sort_order,created_at,updated_at")
    .order("brand")
    .order("sort_order")
    .order("model");
  if (!includeUnpublished) legacyQuery = legacyQuery.eq("published", true);
  const legacy = await legacyQuery;
  if (legacy.error) return [];
  return (legacy.data ?? []).map((row) => ({
    ...row,
    stock_quantity: 0,
    images: Array.isArray(row.images) ? row.images : [],
  })) as CatalogVehicle[];
}

export async function getAccountingEntries(): Promise<AccountingEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounting_entries")
    .select("id,entry_date,entry_type,category,label,amount,notes,created_at")
    .order("entry_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  return (data ?? []) as AccountingEntry[];
}

export async function getEvents(includeDrafts = false): Promise<SiteEvent[]> {
  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select("id,title,description,location,starts_at,ends_at,status,registration_open,championship")
    .order("starts_at", { ascending: true });

  if (!includeDrafts) query = query.eq("status", "published");
  const { data } = await query;
  return (data ?? []) as SiteEvent[];
}


export async function getOrderModuleConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .select("id,customer_name,items,customer_note,admin_note,stock_deducted,updated_at")
    .limit(1);
  return !error;
}

function normalizeOrderItems(value: unknown): OrderItemSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.name !== "string") return [];
    return [{
      vehicle_id: Number.isFinite(Number(candidate.vehicle_id)) ? Number(candidate.vehicle_id) : null,
      name: candidate.name,
      quantity: Math.max(1, Number(candidate.quantity) || 1),
      unit_price: Math.max(0, Number(candidate.unit_price) || 0),
      image_url: typeof candidate.image_url === "string" ? candidate.image_url : null,
    }];
  });
}

export async function getOrders(): Promise<CustomerOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id,user_id,order_number,customer_name,status,total,items,customer_note,admin_note,stock_deducted,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((order) => ({
    ...order,
    customer_name: String(order.customer_name || ""),
    items: normalizeOrderItems(order.items),
  })) as CustomerOrder[];
}

export async function getHomologationRequests(): Promise<HomologationRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("homologation_requests")
    .select("id,user_id,request_type,applicant_name,status,payload,admin_note,created_at,updated_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as HomologationRequest[];
}

export async function getOwnHomologationRequests(userId: string): Promise<HomologationRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("homologation_requests")
    .select("id,user_id,request_type,applicant_name,status,payload,admin_note,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as HomologationRequest[];
}

export async function getProfileCommerceData(userId: string) {
  const supabase = await createClient();
  const [orders, invoices, loyalty, cart] = await Promise.all([
    supabase.from("orders").select("id,order_number,status,total,created_at,customer_name,items,customer_note,admin_note,stock_deducted,updated_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("invoices").select("id,invoice_number,status,amount,issued_at,download_url").eq("user_id", userId).order("issued_at", { ascending: false }),
    supabase.from("loyalty_profiles").select("tier,purchases_count,discount_percent,updated_at").eq("user_id", userId).maybeSingle(),
    supabase.from("cart_items").select("id,vehicle_id,item_name,quantity,unit_price,image_url,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  return {
    configured: !orders.error && !invoices.error && !loyalty.error && !cart.error,
    ordersConfigured: !orders.error,
    orders: (orders.data ?? []).map((order) => ({ ...order, items: normalizeOrderItems(order.items) })),
    invoices: invoices.data ?? [],
    loyalty: loyalty.data ?? null,
    cart: cart.data ?? [],
  };
}

export type MemberProfile = {
  user_id: string;
  discord_id: string | null;
  discord_name: string | null;
  email: string | null;
  avatar_url: string | null;
  rp_first_name: string | null;
  rp_last_name: string | null;
  role: "member" | "employee" | "commercial" | "commissioner" | "manager" | "staff" | "administrator";
  created_at: string;
  updated_at: string;
};

export async function getMemberProfiles(): Promise<MemberProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_profiles")
    .select("user_id,discord_id,discord_name,email,avatar_url,rp_first_name,rp_last_name,role,created_at,updated_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as MemberProfile[];
}

export async function getReservationModuleConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("circuit_reservation_requests")
    .select("id")
    .limit(1);
  return !error;
}

export type CircuitReservationRequest = {
  id: number;
  user_id: string;
  first_name: string;
  last_name: string;
  reservation_date: string;
  reservation_time: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export async function getReservationRequests(): Promise<CircuitReservationRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circuit_reservation_requests")
    .select("id,user_id,first_name,last_name,reservation_date,reservation_time,reason,status,admin_note,created_at,updated_at")
    .order("reservation_date", { ascending: true })
    .order("reservation_time", { ascending: true });
  return (data ?? []) as CircuitReservationRequest[];
}

export async function getApprovedReservationSlots(): Promise<CircuitReservationRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circuit_reservation_requests")
    .select("id,user_id,first_name,last_name,reservation_date,reservation_time,reason,status,admin_note,created_at,updated_at")
    .eq("status", "approved")
    .order("reservation_date", { ascending: true })
    .order("reservation_time", { ascending: true });
  return (data ?? []) as CircuitReservationRequest[];
}

export async function getOwnReservationRequests(userId: string): Promise<CircuitReservationRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("circuit_reservation_requests")
    .select("id,user_id,first_name,last_name,reservation_date,reservation_time,reason,status,admin_note,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as CircuitReservationRequest[];
}

export async function getChampionshipEvents(championship: "f1" | "gt3rs", includeDrafts = false): Promise<SiteEvent[]> {
  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select("id,title,description,location,starts_at,ends_at,status,registration_open,championship")
    .eq("championship", championship)
    .order("starts_at", { ascending: true });
  if (!includeDrafts) query = query.eq("status", "published");
  const { data } = await query;
  return (data ?? []) as SiteEvent[];
}

export type TeamRegistrationRequest = {
  id: number;
  user_id: string;
  registration_type: "f1" | "gt3rs" | "both";
  applicant_name: string;
  team_name: string;
  team_director: string;
  requested_number_f1: string | null;
  requested_number_gt3rs: string | null;
  has_f1_license: boolean;
  has_gt3rs_license: boolean;
  notes: string | null;
  status: "pending" | "reviewing" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export async function getTeamRegistrationModuleConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("team_registration_requests")
    .select("id")
    .limit(1);
  return !error;
}

export async function getTeamRegistrationRequests(): Promise<TeamRegistrationRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_registration_requests")
    .select("id,user_id,registration_type,applicant_name,team_name,team_director,requested_number_f1,requested_number_gt3rs,has_f1_license,has_gt3rs_license,notes,status,admin_note,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as TeamRegistrationRequest[];
}

export async function getOwnTeamRegistrationRequests(userId: string): Promise<TeamRegistrationRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_registration_requests")
    .select("id,user_id,registration_type,applicant_name,team_name,team_director,requested_number_f1,requested_number_gt3rs,has_f1_license,has_gt3rs_license,notes,status,admin_note,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as TeamRegistrationRequest[];
}
