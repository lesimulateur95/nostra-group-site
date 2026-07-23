import { createClient } from "@/lib/supabase/server";

export type GarageVehicleStatus =
  | "ordered"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export type GarageVehicle = {
  id: number;
  userId: string;
  orderId: number;
  orderNumber: string;
  vehicleId: number | null;
  vehicleName: string;
  brand: string | null;
  model: string | null;
  imageUrl: string | null;
  purchasePrice: number;
  deliveryMode: string | null;
  deliveryAddress: string | null;
  orderStatus: string;
  garageStatus: GarageVehicleStatus;
  acquiredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StaffGarageVehicle = GarageVehicle & {
  customerName: string;
};

export type GarageHistoryEntry = {
  id: number;
  eventType: string;
  status: string | null;
  title: string;
  details: string | null;
  createdAt: string;
};

export type GarageDocument = {
  id: number;
  invoiceNumber: string;
  documentType: string;
  documentTitle: string | null;
  status: string;
  issuedAt: string;
  downloadUrl: string | null;
};

type GarageVehicleRow = {
  id: number | string;
  user_id: string;
  order_id: number | string;
  order_number: string;
  vehicle_id: number | string | null;
  vehicle_name: string;
  brand: string | null;
  model: string | null;
  image_url: string | null;
  purchase_price: number | string | null;
  delivery_mode: string | null;
  delivery_address: string | null;
  order_status: string;
  garage_status: GarageVehicleStatus;
  acquired_at: string | null;
  created_at: string;
  updated_at: string;
};

type GarageHistoryRow = {
  id: number | string;
  event_type: string;
  status: string | null;
  title: string;
  details: string | null;
  created_at: string;
};

type GarageDocumentRow = {
  id: number | string;
  invoice_number: string;
  document_type: string | null;
  document_title: string | null;
  status: string;
  issued_at: string;
  download_url: string | null;
};

function mapGarageVehicle(row: GarageVehicleRow): GarageVehicle {
  return {
    id: Number(row.id),
    userId: row.user_id,
    orderId: Number(row.order_id),
    orderNumber: row.order_number,
    vehicleId: row.vehicle_id === null ? null : Number(row.vehicle_id),
    vehicleName: row.vehicle_name,
    brand: row.brand,
    model: row.model,
    imageUrl: row.image_url,
    purchasePrice: Number(row.purchase_price ?? 0),
    deliveryMode: row.delivery_mode,
    deliveryAddress: row.delivery_address,
    orderStatus: row.order_status,
    garageStatus: row.garage_status,
    acquiredAt: row.acquired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function garageStatusLabel(status: GarageVehicleStatus): string {
  const labels: Record<GarageVehicleStatus, string> = {
    ordered: "Commande envoyée",
    confirmed: "Commande confirmée",
    preparing: "En préparation",
    ready: "Prêt à être livré",
    delivered: "Livré",
    cancelled: "Annulé",
  };

  return labels[status];
}

export async function getMyGarageVehicles(userId: string): Promise<{
  configured: boolean;
  vehicles: GarageVehicle[];
  error?: string;
}> {
  const supabase = await createClient();
  const result = await supabase
    .from("customer_vehicles")
    .select(
      "id,user_id,order_id,order_number,vehicle_id,vehicle_name,brand,model,image_url,purchase_price,delivery_mode,delivery_address,order_status,garage_status,acquired_at,created_at,updated_at",
    )
    .eq("user_id", userId)
    .neq("garage_status", "cancelled")
    .order("acquired_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (result.error) {
    return {
      configured: false,
      vehicles: [],
      error: result.error.message,
    };
  }

  return {
    configured: true,
    vehicles: ((result.data ?? []) as GarageVehicleRow[]).map(mapGarageVehicle),
  };
}

export async function getMyGarageVehicle(
  userId: string,
  vehicleId: number,
): Promise<{
  configured: boolean;
  vehicle: GarageVehicle | null;
  history: GarageHistoryEntry[];
  documents: GarageDocument[];
  error?: string;
}> {
  const supabase = await createClient();
  const vehicleResult = await supabase
    .from("customer_vehicles")
    .select(
      "id,user_id,order_id,order_number,vehicle_id,vehicle_name,brand,model,image_url,purchase_price,delivery_mode,delivery_address,order_status,garage_status,acquired_at,created_at,updated_at",
    )
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .maybeSingle();

  if (vehicleResult.error) {
    return {
      configured: false,
      vehicle: null,
      history: [],
      documents: [],
      error: vehicleResult.error.message,
    };
  }

  if (!vehicleResult.data) {
    return {
      configured: true,
      vehicle: null,
      history: [],
      documents: [],
    };
  }

  const vehicle = mapGarageVehicle(vehicleResult.data as GarageVehicleRow);
  const [historyResult, documentResult] = await Promise.all([
    supabase
      .from("customer_vehicle_history")
      .select("id,event_type,status,title,details,created_at")
      .eq("customer_vehicle_id", vehicle.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select(
        "id,invoice_number,document_type,document_title,status,issued_at,download_url",
      )
      .eq("user_id", userId)
      .eq("order_id", vehicle.orderId)
      .order("issued_at", { ascending: false }),
  ]);

  const history = historyResult.error
    ? []
    : ((historyResult.data ?? []) as GarageHistoryRow[]).map((row) => ({
        id: Number(row.id),
        eventType: row.event_type,
        status: row.status,
        title: row.title,
        details: row.details,
        createdAt: row.created_at,
      }));

  const documents = documentResult.error
    ? []
    : ((documentResult.data ?? []) as GarageDocumentRow[]).map((row) => ({
        id: Number(row.id),
        invoiceNumber: row.invoice_number,
        documentType: row.document_type ?? "document",
        documentTitle: row.document_title,
        status: row.status,
        issuedAt: row.issued_at,
        downloadUrl: row.download_url,
      }));

  return {
    configured: true,
    vehicle,
    history,
    documents,
    error: historyResult.error?.message ?? documentResult.error?.message,
  };
}

export async function getStaffGarageVehicles(): Promise<{
  configured: boolean;
  vehicles: StaffGarageVehicle[];
  error?: string;
}> {
  const supabase = await createClient();
  const vehicleResult = await supabase
    .from("customer_vehicles")
    .select(
      "id,user_id,order_id,order_number,vehicle_id,vehicle_name,brand,model,image_url,purchase_price,delivery_mode,delivery_address,order_status,garage_status,acquired_at,created_at,updated_at",
    )
    .neq("garage_status", "cancelled")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (vehicleResult.error) {
    return {
      configured: false,
      vehicles: [],
      error: vehicleResult.error.message,
    };
  }

  const rows = (vehicleResult.data ?? []) as GarageVehicleRow[];
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const names = new Map<string, string>();

  if (userIds.length > 0) {
    const profileResult = await supabase
      .from("member_profiles")
      .select("user_id,rp_first_name,rp_last_name")
      .in("user_id", userIds);

    if (!profileResult.error) {
      for (const profile of profileResult.data ?? []) {
        const row = profile as {
          user_id: string;
          rp_first_name: string | null;
          rp_last_name: string | null;
        };
        const rpName = `${row.rp_first_name ?? ""} ${row.rp_last_name ?? ""}`.trim();
        names.set(row.user_id, rpName || "Citoyen Nostra Group");
      }
    }
  }

  return {
    configured: true,
    vehicles: rows.map((row) => ({
      ...mapGarageVehicle(row),
      customerName: names.get(row.user_id) ?? "Citoyen Nostra Group",
    })),
  };
}
