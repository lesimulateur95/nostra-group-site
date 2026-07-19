import { createClient } from "@/lib/supabase/server";

export type CircuitSetting = {
  id: number;
  status: string;
  label: string;
  message: string;
  updated_at?: string | null;
};

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

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_items")
    .select("id,name,category,sku,quantity,minimum_quantity,unit_price,notes,updated_at")
    .order("category")
    .order("name");
  return (data ?? []) as InventoryItem[];
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
    supabase.from("orders").select("id,order_number,status,total,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("invoices").select("id,invoice_number,status,amount,issued_at,download_url").eq("user_id", userId).order("issued_at", { ascending: false }),
    supabase.from("loyalty_profiles").select("tier,purchases_count,discount_percent,updated_at").eq("user_id", userId).maybeSingle(),
    supabase.from("cart_items").select("id,item_name,quantity,unit_price,image_url,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  return {
    configured: !orders.error && !invoices.error && !loyalty.error && !cart.error,
    orders: orders.data ?? [],
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
  role: "member" | "staff" | "administrator" | "manager";
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
