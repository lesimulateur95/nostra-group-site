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
  item_type: "vehicle" | "delivery" | null;
  vehicle_id: number | null;
  related_vehicle_id: number | null;
  name: string;
  delivery_address: string | null;
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
      item_type:
        candidate.item_type === "vehicle" || candidate.item_type === "delivery"
          ? candidate.item_type
          : null,
      vehicle_id: Number.isFinite(Number(candidate.vehicle_id))
        ? Number(candidate.vehicle_id)
        : null,
      related_vehicle_id: Number.isFinite(Number(candidate.related_vehicle_id))
        ? Number(candidate.related_vehicle_id)
        : null,
      name: candidate.name,
      delivery_address:
        typeof candidate.delivery_address === "string"
          ? candidate.delivery_address
          : null,
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
    supabase.from("cart_items").select("id,vehicle_id,related_vehicle_id,item_type,delivery_mode,delivery_address,item_name,quantity,unit_price,image_url,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
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
  role: "citizen" | "member" | "employee" | "commercial" | "commissioner" | "manager" | "staff" | "administrator";
  roles: string[] | null;
  created_at: string;
  updated_at: string;
};

export async function getMemberProfiles(): Promise<MemberProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_profiles")
    .select("user_id,discord_id,discord_name,email,avatar_url,rp_first_name,rp_last_name,role,roles,created_at,updated_at")
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


export type CommissionerRaceBriefing = {
  id: number;
  event_title: string;
  event_date: string | null;
  stands_opening: string;
  qualifications_time: string;
  race_start: string;
  vehicle: string;
  lap_count: string;
  weather: string;
  commissioners: string;
  race_direction: string;
  live_announcement: string;
  public_visible?: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type CommissionerIncidentReport = {
  id: number;
  created_by: string;
  author_name: string;
  incident_date: string;
  incident_time: string;
  session_name: string;
  circuit_zone: string;
  people_involved: string;
  factual_description: string;
  intervention: string;
  witnesses: string | null;
  race_direction_decision: string | null;
  created_at: string;
  updated_at: string;
};

export async function getRolesCommissionersConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const [{ error: profilesError }, { error: briefingError }, { error: reportsError }] = await Promise.all([
    supabase.from("member_profiles").select("user_id,role,roles").limit(1),
    supabase.from("commissioner_race_briefing").select("id").limit(1),
    supabase.from("commissioner_incident_reports").select("id").limit(1),
  ]);
  return !profilesError && !briefingError && !reportsError;
}

export async function getCommissionerModuleConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const [{ error: briefingError }, { error: reportsError }] = await Promise.all([
    supabase.from("commissioner_race_briefing").select("id").limit(1),
    supabase.from("commissioner_incident_reports").select("id").limit(1),
  ]);
  return !briefingError && !reportsError;
}

export async function getCommissionerRaceBriefing(): Promise<CommissionerRaceBriefing | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("commissioner_race_briefing")
    .select("id,event_title,event_date,stands_opening,qualifications_time,race_start,vehicle,lap_count,weather,commissioners,race_direction,live_announcement,public_visible,updated_by,updated_at")
    .eq("id", 1)
    .maybeSingle();
  return (data as CommissionerRaceBriefing | null) ?? null;
}

export async function getCommissionerIncidentReports(): Promise<CommissionerIncidentReport[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("commissioner_incident_reports")
    .select("id,created_by,author_name,incident_date,incident_time,session_name,circuit_zone,people_involved,factual_description,intervention,witnesses,race_direction_decision,created_at,updated_at")
    .order("incident_date", { ascending: false })
    .order("incident_time", { ascending: false });
  return (data ?? []) as CommissionerIncidentReport[];
}


export async function getDashboardRoleAccessConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const [{ error: orderAccessError }, { error: planningAccessError }, { error: wheelDeleteError }] = await Promise.all([
    supabase.rpc("nostra_can_manage_orders"),
    supabase.from("commissioner_race_briefing").select("public_visible").limit(1),
    supabase.from("game_wheel_spins").select("deleted_at").limit(1),
  ]);
  return !orderAccessError && !planningAccessError && !wheelDeleteError;
}

export type WheelSpin = {
  id: number;
  user_id: string;
  player_name: string;
  slot_index: number;
  prize_key: string;
  prize_label: string;
  prize_type: "bonus" | "loss";
  redemption_status: "unused" | "used" | "lost";
  awarded_at: string;
  used_at: string | null;
  used_by: string | null;
  updated_at: string;
  deleted_at?: string | null;
};

export async function getWheelModuleConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("game_wheel_spins").select("id").limit(1);
  return !error;
}

export async function getWheelSpins(): Promise<WheelSpin[]> {
  const supabase = await createClient();

  // Lecture sécurisée via une fonction SQL dédiée.
  // Cela évite que les règles RLS renvoient silencieusement une liste vide au Dashboard.
  const { data, error } = await supabase.rpc("get_nostra_wheel_spins_for_dashboard");

  if (error) {
    console.error("Impossible de charger les tirages de la roue dans le Dashboard :", error);
    return [];
  }

  return (data ?? []) as WheelSpin[];
}

export async function getOwnWheelSpins(_userId: string): Promise<WheelSpin[]> {
  const supabase = await createClient();

  // L'identité est vérifiée directement dans Supabase avec auth.uid().
  // Le paramètre reçu de la page ne peut donc jamais servir à lire les gains d'un autre citoyen.
  const { data, error } = await supabase.rpc("get_my_nostra_wheel_spins");

  if (error) {
    console.error("Impossible de charger l'historique personnel de la roue :", error);
    return [];
  }

  return (data ?? []) as WheelSpin[];
}

export type TombolaRound = {
  id: number;
  title: string;
  ticket_price: number;
  status: "open" | "closed" | "drawn" | "archived";
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TombolaCartItem = {
  id: number;
  user_id: string;
  round_id: number;
  customer_name: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
};

export type TombolaPurchase = {
  id: number;
  round_id: number;
  user_id: string;
  order_number: string;
  customer_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
};

export type TombolaTicket = {
  id: number;
  round_id: number;
  purchase_id: number;
  user_id: string;
  customer_name: string;
  ticket_number: number;
  created_at: string;
  order_number?: string | null;
  round_title?: string | null;
};

export type TombolaWinner = {
  id: number;
  round_id: number;
  ticket_id: number;
  position: number;
  ticket_number: number;
  customer_name: string;
  drawn_at: string;
};

export async function getTombolaModuleConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const checks = await Promise.all([
    supabase.from("tombola_rounds").select("id").limit(1),
    supabase.from("tombola_tickets").select("id").limit(1),
    supabase.from("tombola_winners").select("id").limit(1),
  ]);
  return checks.every((result) => !result.error);
}

export async function getActiveTombolaRound(): Promise<TombolaRound | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tombola_rounds")
    .select("id,title,ticket_price,status,archived_at,created_at,updated_at")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    ...data,
    ticket_price: Number(data.ticket_price) || 0,
  } as TombolaRound;
}

export async function getTombolaWinners(roundId: number): Promise<TombolaWinner[]> {
  if (!roundId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tombola_winners")
    .select("id,round_id,ticket_id,position,ticket_number,customer_name,drawn_at")
    .eq("round_id", roundId)
    .order("position", { ascending: true });

  if (error) return [];
  return (data ?? []) as TombolaWinner[];
}

export async function getOwnTombolaCart(userId: string): Promise<TombolaCartItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tombola_cart_items")
    .select("id,user_id,round_id,customer_name,quantity,unit_price,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    ...data,
    quantity: Number(data.quantity) || 0,
    unit_price: Number(data.unit_price) || 0,
  } as TombolaCartItem;
}

export async function getOwnTombolaTickets(userId: string): Promise<TombolaTicket[]> {
  const supabase = await createClient();

  // Le profil n'affiche que les tickets de l'édition active.
  // Lors d'un reset, l'ancienne édition est archivée : ses numéros disparaissent donc immédiatement du profil.
  const { data: activeRound, error: roundError } = await supabase
    .from("tombola_rounds")
    .select("id")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  if (roundError || !activeRound) return [];

  const { data, error } = await supabase
    .from("tombola_tickets")
    .select("id,round_id,purchase_id,user_id,customer_name,ticket_number,created_at,tombola_purchases(order_number),tombola_rounds(title)")
    .eq("user_id", userId)
    .eq("round_id", Number(activeRound.id))
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => {
    const purchase = Array.isArray(row.tombola_purchases)
      ? row.tombola_purchases[0]
      : row.tombola_purchases;
    const round = Array.isArray(row.tombola_rounds)
      ? row.tombola_rounds[0]
      : row.tombola_rounds;

    return {
      id: Number(row.id),
      round_id: Number(row.round_id),
      purchase_id: Number(row.purchase_id),
      user_id: String(row.user_id),
      customer_name: String(row.customer_name),
      ticket_number: Number(row.ticket_number),
      created_at: String(row.created_at),
      order_number: purchase && typeof purchase === "object" && "order_number" in purchase
        ? String(purchase.order_number)
        : null,
      round_title: round && typeof round === "object" && "title" in round
        ? String(round.title)
        : null,
    } satisfies TombolaTicket;
  });
}

export async function getTombolaTickets(roundId: number): Promise<TombolaTicket[]> {
  if (!roundId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tombola_tickets")
    .select("id,round_id,purchase_id,user_id,customer_name,ticket_number,created_at,tombola_purchases(order_number)")
    .eq("round_id", roundId)
    .order("ticket_number", { ascending: true });

  if (error) return [];
  return (data ?? []).map((row) => {
    const purchase = Array.isArray(row.tombola_purchases)
      ? row.tombola_purchases[0]
      : row.tombola_purchases;
    return {
      id: Number(row.id),
      round_id: Number(row.round_id),
      purchase_id: Number(row.purchase_id),
      user_id: String(row.user_id),
      customer_name: String(row.customer_name),
      ticket_number: Number(row.ticket_number),
      created_at: String(row.created_at),
      order_number: purchase && typeof purchase === "object" && "order_number" in purchase
        ? String(purchase.order_number)
        : null,
    } satisfies TombolaTicket;
  });
}

export async function getTombolaPurchases(roundId: number): Promise<TombolaPurchase[]> {
  if (!roundId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tombola_purchases")
    .select("id,round_id,user_id,order_number,customer_name,quantity,unit_price,total,created_at")
    .eq("round_id", roundId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row) => ({
    ...row,
    quantity: Number(row.quantity) || 0,
    unit_price: Number(row.unit_price) || 0,
    total: Number(row.total) || 0,
  })) as TombolaPurchase[];
}


export type BingoRound = {
  id: number;
  title: string;
  card_price: number;
  status: "open" | "closed" | "playing" | "completed" | "archived";
  phase: "one_line" | "two_lines" | "three_lines" | "four_lines" | "full_card";
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BingoCartItem = {
  id: number;
  user_id: string;
  round_id: number;
  customer_name: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
};

export type BingoPurchase = {
  id: number;
  round_id: number;
  user_id: string;
  order_number: string;
  customer_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
};

export type BingoCard = {
  id: number;
  round_id: number;
  purchase_id: number;
  user_id: string;
  customer_name: string;
  card_number: number;
  numbers: number[];
  created_at: string;
};

export type BingoDraw = {
  id: number;
  round_id: number;
  ball_number: number;
  draw_order: number;
  drawn_by: string | null;
  drawn_at: string;
};

export type BingoRewardPhase = "one_line" | "two_lines" | "three_lines" | "four_lines" | "full_card";

export type BingoRewards = {
  round_id: number;
  one_line: string;
  two_lines: string;
  three_lines: string;
  four_lines: string;
  full_card: string;
  updated_at: string | null;
};

export type BingoWinner = {
  id: number;
  round_id: number;
  card_id: number;
  phase: BingoRewardPhase;
  card_number: number;
  customer_name: string;
  trigger_ball: number | null;
  reward_text: string;
  reward_status: "pending" | "validated";
  reward_validated_at: string | null;
  achieved_at: string;
};

export async function getBingoModuleConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const checks = await Promise.all([
    supabase.from("bingo_rounds").select("id").limit(1),
    supabase.from("bingo_cards").select("id").limit(1),
    supabase.from("bingo_draws").select("id").limit(1),
    supabase.from("bingo_winners").select("id").limit(1),
  ]);
  return checks.every((result) => !result.error);
}

export async function getBingoRewardsConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("bingo_rewards").select("round_id").limit(1);
  return !error;
}

export async function getBingoRewards(roundId: number): Promise<BingoRewards> {
  const fallback: BingoRewards = {
    round_id: roundId,
    one_line: "",
    two_lines: "",
    three_lines: "",
    four_lines: "",
    full_card: "",
    updated_at: null,
  };

  if (!roundId) return fallback;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bingo_rewards")
    .select("round_id,one_line,two_lines,three_lines,four_lines,full_card,updated_at")
    .eq("round_id", roundId)
    .maybeSingle();

  if (error || !data) return fallback;
  return {
    round_id: Number(data.round_id),
    one_line: String(data.one_line ?? ""),
    two_lines: String(data.two_lines ?? ""),
    three_lines: String(data.three_lines ?? ""),
    four_lines: String(data.four_lines ?? ""),
    full_card: String(data.full_card ?? ""),
    updated_at: data.updated_at ? String(data.updated_at) : null,
  };
}

export async function getActiveBingoRound(): Promise<BingoRound | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bingo_rounds")
    .select("id,title,card_price,status,phase,archived_at,created_at,updated_at")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { ...data, card_price: Number(data.card_price) || 0 } as BingoRound;
}

export async function getOwnBingoCart(userId: string): Promise<BingoCartItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bingo_cart_items")
    .select("id,user_id,round_id,customer_name,quantity,unit_price,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { ...data, quantity: Number(data.quantity) || 0, unit_price: Number(data.unit_price) || 0 } as BingoCartItem;
}

export async function getOwnBingoCards(userId: string): Promise<BingoCard[]> {
  const round = await getActiveBingoRound();
  if (!round) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bingo_cards")
    .select("id,round_id,purchase_id,user_id,customer_name,card_number,numbers,created_at")
    .eq("user_id", userId)
    .eq("round_id", round.id)
    .order("card_number", { ascending: true });

  if (error) return [];
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    round_id: Number(row.round_id),
    purchase_id: Number(row.purchase_id),
    user_id: String(row.user_id),
    customer_name: String(row.customer_name),
    card_number: Number(row.card_number),
    numbers: Array.isArray(row.numbers) ? row.numbers.map(Number) : [],
    created_at: String(row.created_at),
  } satisfies BingoCard));
}

export async function getBingoCards(roundId: number): Promise<BingoCard[]> {
  if (!roundId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bingo_cards")
    .select("id,round_id,purchase_id,user_id,customer_name,card_number,numbers,created_at")
    .eq("round_id", roundId)
    .order("card_number", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row) => ({ ...row, card_number: Number(row.card_number), numbers: Array.isArray(row.numbers) ? row.numbers.map(Number) : [] })) as BingoCard[];
}

export async function getBingoPurchases(roundId: number): Promise<BingoPurchase[]> {
  if (!roundId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bingo_purchases")
    .select("id,round_id,user_id,order_number,customer_name,quantity,unit_price,total,created_at")
    .eq("round_id", roundId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => ({ ...row, quantity: Number(row.quantity), unit_price: Number(row.unit_price), total: Number(row.total) })) as BingoPurchase[];
}

export async function getBingoDraws(roundId: number): Promise<BingoDraw[]> {
  if (!roundId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bingo_draws")
    .select("id,round_id,ball_number,draw_order,drawn_by,drawn_at")
    .eq("round_id", roundId)
    .order("draw_order", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => ({ ...row, ball_number: Number(row.ball_number), draw_order: Number(row.draw_order) })) as BingoDraw[];
}

export async function getBingoWinners(roundId: number): Promise<BingoWinner[]> {
  if (!roundId) return [];
  const supabase = await createClient();
  const current = await supabase
    .from("bingo_winners")
    .select("id,round_id,card_id,phase,card_number,customer_name,trigger_ball,reward_text,reward_status,reward_validated_at,achieved_at")
    .eq("round_id", roundId)
    .order("achieved_at", { ascending: false });

  if (!current.error) {
    return (current.data ?? []).map((row) => ({
      ...row,
      card_number: Number(row.card_number),
      trigger_ball: row.trigger_ball === null ? null : Number(row.trigger_ball),
      reward_text: String(row.reward_text ?? ""),
      reward_status: row.reward_status === "validated" ? "validated" : "pending",
      reward_validated_at: row.reward_validated_at ? String(row.reward_validated_at) : null,
    })) as BingoWinner[];
  }

  // Compatibilité pendant les quelques secondes précédant l’activation SQL V32.3.
  const legacy = await supabase
    .from("bingo_winners")
    .select("id,round_id,card_id,phase,card_number,customer_name,trigger_ball,achieved_at")
    .eq("round_id", roundId)
    .order("achieved_at", { ascending: false });

  if (legacy.error) return [];
  return (legacy.data ?? []).map((row) => ({
    ...row,
    card_number: Number(row.card_number),
    trigger_ball: row.trigger_ball === null ? null : Number(row.trigger_ball),
    reward_text: "",
    reward_status: "pending",
    reward_validated_at: null,
  })) as BingoWinner[];
}
