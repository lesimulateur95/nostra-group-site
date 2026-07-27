import type { CatalogVehicleImage, CustomerOrder } from "@/lib/backoffice/data";
import { getOrders } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

export type UsedVehicleStatus = "available" | "reserved" | "sold";
export type UsedVehicleCondition =
  | "excellent"
  | "very_good"
  | "good"
  | "fair"
  | "repair";

export const USED_CONDITION_LABELS: Record<UsedVehicleCondition, string> = {
  excellent: "Excellent état",
  very_good: "Très bon état",
  good: "Bon état",
  fair: "État correct",
  repair: "À remettre en état",
};

export const USED_STATUS_LABELS: Record<UsedVehicleStatus, string> = {
  available: "Disponible",
  reserved: "Réservé",
  sold: "Vendu",
};

export type UsedVehicle = {
  detailId: number;
  vehicleId: number;
  brand: string;
  model: string;
  version: string;
  registration: string;
  previousOwner: string;
  purchaseDate: string;
  purchasePrice: number;
  resalePrice: number;
  purchaseQuantity: number;
  stockQuantity: number;
  images: CatalogVehicleImage[];
  description: string;
  condition: UsedVehicleCondition;
  internalNotes: string;
  status: UsedVehicleStatus;
  published: boolean;
  trunkCapacity: string;
  topSpeed: string;
  power: string;
  sortOrder: number;
  expectedUnitMargin: number;
  expectedTotalMargin: number;
  actualSalePrice: number | null;
  actualMargin: number | null;
  soldAt: string | null;
  soldOrderId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type UsedVehicleSale = {
  id: number;
  vehicleId: number;
  orderId: number;
  orderNumber: string;
  userId: string;
  customerName: string;
  vehicleName: string;
  quantity: number;
  unitPurchasePrice: number;
  unitSalePrice: number;
  totalPurchasePrice: number;
  totalSalePrice: number;
  margin: number;
  soldAt: string;
};

export type UsedVehicleDocument = {
  id: number;
  invoiceNumber: string;
  orderId: number | null;
  documentType: string;
  documentTitle: string;
  status: string;
  amount: number;
  issuedAt: string;
  userId: string;
};

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function images(value: unknown): CatalogVehicleImage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Row;
    if (typeof row.url !== "string" || typeof row.path !== "string") return [];
    return [{ url: row.url, path: row.path }];
  });
}

function status(value: unknown): UsedVehicleStatus {
  return value === "reserved" || value === "sold" ? value : "available";
}

function condition(value: unknown): UsedVehicleCondition {
  return value === "excellent" ||
    value === "very_good" ||
    value === "fair" ||
    value === "repair"
    ? value
    : "good";
}

export async function getUsedVehiclesConfigured(): Promise<boolean> {
  const supabase = await createClient();
  const [details, catalogue] = await Promise.all([
    (supabase as any).from("used_vehicle_details").select("id,vehicle_id").limit(1),
    (supabase as any)
      .from("catalog_vehicles")
      .select("id,catalog_type,used_vehicle_status,used_condition")
      .limit(1),
  ]);
  return !details.error && !catalogue.error;
}

export async function getUsedVehicles(): Promise<UsedVehicle[]> {
  const supabase = await createClient();
  const detailsResult = await (supabase as any)
    .from("used_vehicle_details")
    .select(
      "id,vehicle_id,version,registration,previous_owner,purchase_date,purchase_price,resale_price,purchase_quantity,vehicle_condition,internal_notes,sale_status,actual_sale_price,actual_margin,sold_at,sold_order_id,created_at,updated_at",
    )
    .order("purchase_date", { ascending: false })
    .order("id", { ascending: false });

  if (detailsResult.error) return [];

  const details = (detailsResult.data ?? []) as Row[];
  const vehicleIds = details.map((row) => number(row.vehicle_id)).filter(Boolean);
  if (vehicleIds.length === 0) return [];

  const catalogResult = await (supabase as any)
    .from("catalog_vehicles")
    .select(
      "id,brand,model,trunk_capacity,top_speed,power,price,description,images,published,stock_quantity,sort_order,catalog_type,used_vehicle_status,used_condition,created_at,updated_at",
    )
    .in("id", vehicleIds);

  if (catalogResult.error) return [];

  const catalogMap = new Map<number, Row>();
  for (const row of (catalogResult.data ?? []) as Row[]) {
    catalogMap.set(number(row.id), row);
  }

  return details.flatMap((detail): UsedVehicle[] => {
    const vehicleId = number(detail.vehicle_id);
    const vehicle = catalogMap.get(vehicleId);
    if (!vehicle) return [];

    const purchasePrice = number(detail.purchase_price);
    const resalePrice = number(detail.resale_price || vehicle.price);
    const purchaseQuantity = Math.max(1, number(detail.purchase_quantity));
    const expectedUnitMargin = resalePrice - purchasePrice;

    return [
      {
        detailId: number(detail.id),
        vehicleId,
        brand: text(vehicle.brand),
        model: text(vehicle.model),
        version: text(detail.version),
        registration: text(detail.registration),
        previousOwner: text(detail.previous_owner),
        purchaseDate: text(detail.purchase_date),
        purchasePrice,
        resalePrice,
        purchaseQuantity,
        stockQuantity: Math.max(0, number(vehicle.stock_quantity)),
        images: images(vehicle.images),
        description: text(vehicle.description),
        condition: condition(detail.vehicle_condition || vehicle.used_condition),
        internalNotes: text(detail.internal_notes),
        status: status(detail.sale_status || vehicle.used_vehicle_status),
        published: vehicle.published === true,
        trunkCapacity: text(vehicle.trunk_capacity),
        topSpeed: text(vehicle.top_speed),
        power: text(vehicle.power),
        sortOrder: Math.max(0, number(vehicle.sort_order)),
        expectedUnitMargin,
        expectedTotalMargin: expectedUnitMargin * purchaseQuantity,
        actualSalePrice:
          detail.actual_sale_price == null ? null : number(detail.actual_sale_price),
        actualMargin: detail.actual_margin == null ? null : number(detail.actual_margin),
        soldAt: detail.sold_at == null ? null : text(detail.sold_at),
        soldOrderId:
          detail.sold_order_id == null ? null : number(detail.sold_order_id),
        createdAt: text(detail.created_at || vehicle.created_at),
        updatedAt: text(detail.updated_at || vehicle.updated_at),
      },
    ];
  });
}

export async function getUsedVehicleOrders(): Promise<CustomerOrder[]> {
  const vehicles = await getUsedVehicles();
  const ids = new Set(vehicles.map((vehicle) => vehicle.vehicleId));
  if (ids.size === 0) return [];

  const orders = await getOrders();
  return orders.flatMap((order): CustomerOrder[] => {
    const vehicleItems = order.items.filter(
      (item) =>
        (item.item_type === "vehicle" || item.item_type == null) &&
        item.vehicle_id != null &&
        ids.has(item.vehicle_id),
    );
    if (vehicleItems.length === 0) return [];

    const usedVehicleIds = new Set(
      vehicleItems.flatMap((item) => (item.vehicle_id == null ? [] : [item.vehicle_id])),
    );
    const deliveryItems = order.items.filter(
      (item) =>
        item.item_type === "delivery" &&
        item.related_vehicle_id != null &&
        usedVehicleIds.has(item.related_vehicle_id),
    );
    const items = [...vehicleItems, ...deliveryItems];
    const total = items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0,
    );

    return [{ ...order, items, total }];
  });
}

export async function getUsedVehicleSales(): Promise<UsedVehicleSale[]> {
  const supabase = await createClient();
  const result = await (supabase as any)
    .from("used_vehicle_sales")
    .select(
      "id,vehicle_id,order_id,order_number,user_id,customer_name,vehicle_name,quantity,unit_purchase_price,unit_sale_price,total_purchase_price,total_sale_price,margin,sold_at",
    )
    .order("sold_at", { ascending: false });

  if (result.error) return [];

  return ((result.data ?? []) as Row[]).map((row) => ({
    id: number(row.id),
    vehicleId: number(row.vehicle_id),
    orderId: number(row.order_id),
    orderNumber: text(row.order_number),
    userId: text(row.user_id),
    customerName: text(row.customer_name),
    vehicleName: text(row.vehicle_name),
    quantity: Math.max(1, number(row.quantity)),
    unitPurchasePrice: number(row.unit_purchase_price),
    unitSalePrice: number(row.unit_sale_price),
    totalPurchasePrice: number(row.total_purchase_price),
    totalSalePrice: number(row.total_sale_price),
    margin: number(row.margin),
    soldAt: text(row.sold_at),
  }));
}

export async function getUsedVehicleDocuments(): Promise<UsedVehicleDocument[]> {
  const orders = await getUsedVehicleOrders();
  const orderIds = orders.map((order) => order.id);
  if (orderIds.length === 0) return [];

  const supabase = await createClient();
  const result = await (supabase as any)
    .from("invoices")
    .select(
      "id,invoice_number,order_id,document_type,document_title,status,amount,issued_at,user_id",
    )
    .in("order_id", orderIds)
    .order("issued_at", { ascending: false });

  if (result.error) return [];

  return ((result.data ?? []) as Row[]).map((row) => ({
    id: number(row.id),
    invoiceNumber: text(row.invoice_number),
    orderId: row.order_id == null ? null : number(row.order_id),
    documentType: text(row.document_type || "invoice"),
    documentTitle: text(row.document_title || "Document de vente"),
    status: text(row.status),
    amount: number(row.amount),
    issuedAt: text(row.issued_at),
    userId: text(row.user_id),
  }));
}

export type UsedVehicleClientSummary = {
  userId: string;
  customerName: string;
  orderCount: number;
  completedSales: number;
  totalOrdered: number;
  lastOrderAt: string;
};

export async function getUsedVehicleClients(): Promise<UsedVehicleClientSummary[]> {
  const orders = await getUsedVehicleOrders();
  const grouped = new Map<string, UsedVehicleClientSummary>();

  for (const order of orders) {
    const key = order.user_id || order.customer_name;
    const current = grouped.get(key) ?? {
      userId: order.user_id,
      customerName: order.customer_name || "Client Nostra Motors",
      orderCount: 0,
      completedSales: 0,
      totalOrdered: 0,
      lastOrderAt: order.created_at,
    };

    current.orderCount += 1;
    current.completedSales += order.status === "completed" ? 1 : 0;
    current.totalOrdered += Number(order.total) || 0;
    if (new Date(order.created_at).getTime() > new Date(current.lastOrderAt).getTime()) {
      current.lastOrderAt = order.created_at;
    }
    grouped.set(key, current);
  }

  return [...grouped.values()].sort(
    (a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime(),
  );
}

export async function getUsedVehicleDashboardSummary() {
  const configured = await getUsedVehiclesConfigured();
  if (!configured) {
    return {
      configured: false,
      vehicles: 0,
      available: 0,
      reserved: 0,
      sold: 0,
      pendingOrders: 0,
      stockValue: 0,
      expectedMargin: 0,
      realizedMargin: 0,
      turnover: 0,
    };
  }

  const [vehicles, orders, sales] = await Promise.all([
    getUsedVehicles(),
    getUsedVehicleOrders(),
    getUsedVehicleSales(),
  ]);

  return {
    configured: true,
    vehicles: vehicles.length,
    available: vehicles.filter((vehicle) => vehicle.status === "available").length,
    reserved: vehicles.filter((vehicle) => vehicle.status === "reserved").length,
    sold: vehicles.filter((vehicle) => vehicle.status === "sold").length,
    pendingOrders: orders.filter((order) =>
      ["pending", "confirmed", "preparing", "ready"].includes(order.status),
    ).length,
    stockValue: vehicles.reduce(
      (total, vehicle) => total + vehicle.purchasePrice * vehicle.stockQuantity,
      0,
    ),
    expectedMargin: vehicles.reduce(
      (total, vehicle) => total + vehicle.expectedUnitMargin * vehicle.stockQuantity,
      0,
    ),
    realizedMargin: sales.reduce((total, sale) => total + sale.margin, 0),
    turnover: sales.reduce((total, sale) => total + sale.totalSalePrice, 0),
  };
}
