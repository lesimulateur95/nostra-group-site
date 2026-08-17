import { createClient } from "@/lib/supabase/server";

const num = (value: unknown) => Number(value ?? 0) || 0;
const str = (value: unknown) => (value == null ? "" : String(value));

export const MOTORS_PERMISSION_KEYS = [
  "catalogue_read",
  "catalogue_manage",
  "pricing_manage",
  "inventory_manage",
  "orders_manage",
  "garage_read",
  "maintenance_manage",
  "workshop_manage",
  "deliveries_manage",
  "transfer_manage",
  "warranty_read",
  "warranty_manage",
  "crm_manage",
  "suppliers_manage",
  "margins_read",
  "stats_read",
] as const;

export type MotorsPermissionKey = (typeof MOTORS_PERMISSION_KEYS)[number];

export const MOTORS_PERMISSION_LABELS: Record<MotorsPermissionKey, string> = {
  catalogue_read: "Voir le catalogue",
  catalogue_manage: "Créer / modifier les véhicules",
  pricing_manage: "Modifier prix et promotions",
  inventory_manage: "Gérer le stock et les exemplaires",
  orders_manage: "Gérer commandes et réservations",
  garage_read: "Consulter les garages citoyens",
  maintenance_manage: "Remplir les carnets d’entretien",
  workshop_manage: "Gérer l’atelier / SAV",
  deliveries_manage: "Gérer les livraisons",
  transfer_manage: "Valider transferts / reventes",
  warranty_read: "Consulter Nostra Care",
  warranty_manage: "Gérer les formules Nostra Care",
  crm_manage: "Consulter / gérer le CRM Motors",
  suppliers_manage: "Gérer fournisseurs et arrivages",
  margins_read: "Voir les marges réelles",
  stats_read: "Voir les statistiques Direction Motors",
};

export const MOTORS_JOB_ROLE_LABELS: Record<string, string> = {
  direction: "Direction",
  responsable_concession: "Responsable concession",
  vendeur: "Vendeur",
  responsable_atelier: "Responsable atelier",
  mecanicien: "Mécanicien",
  responsable_livraison: "Responsable livraison",
  livreur: "Livreur",
  sav: "Gestionnaire SAV",
  crm: "Gestionnaire CRM",
  employe_polyvalent: "Employé polyvalent",
};

export const MOTORS_ROLE_PERMISSION_PRESETS: Record<string, readonly MotorsPermissionKey[]> = {
  direction: MOTORS_PERMISSION_KEYS,
  responsable_concession: ["catalogue_read","catalogue_manage","pricing_manage","inventory_manage","orders_manage","garage_read","maintenance_manage","workshop_manage","deliveries_manage","transfer_manage","warranty_read","warranty_manage","crm_manage","suppliers_manage","margins_read","stats_read"],
  vendeur: ["catalogue_read","orders_manage","garage_read","transfer_manage","warranty_read","crm_manage"],
  responsable_atelier: ["garage_read","maintenance_manage","workshop_manage","warranty_read","transfer_manage"],
  mecanicien: ["garage_read","maintenance_manage","workshop_manage","warranty_read"],
  responsable_livraison: ["orders_manage","garage_read","deliveries_manage"],
  livreur: ["garage_read","deliveries_manage"],
  sav: ["garage_read","maintenance_manage","workshop_manage","warranty_read","crm_manage"],
  crm: ["catalogue_read","orders_manage","garage_read","warranty_read","crm_manage"],
  employe_polyvalent: ["catalogue_read","inventory_manage","orders_manage","garage_read","maintenance_manage","workshop_manage","deliveries_manage","transfer_manage","warranty_read","crm_manage"],
};

export type MotorsEmployeeAccessV164 = {
  configured: boolean;
  active: boolean;
  jobRole: string | null;
  permissions: Set<string>;
};

function permissionSet(value: unknown): Set<string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return new Set();
  const source = value as Record<string, unknown>;
  return new Set(
    Object.entries(source)
      .filter(([, enabled]) => enabled === true || enabled === "true" || enabled === 1)
      .map(([key]) => key),
  );
}

export async function getMotorsEmployeeAccessV164(
  userId: string,
  manager = false,
): Promise<MotorsEmployeeAccessV164> {
  if (manager) {
    return {
      configured: true,
      active: true,
      jobRole: "direction",
      permissions: new Set(MOTORS_PERMISSION_KEYS),
    };
  }

  const supabase = await createClient();
  const result = await (supabase as any)
    .from("motors_employees_v164")
    .select("user_id,job_role,active,permissions")
    .eq("user_id", userId)
    .maybeSingle();

  if (result.error) {
    return { configured: false, active: true, jobRole: null, permissions: new Set() };
  }

  if (!result.data) {
    return { configured: true, active: false, jobRole: null, permissions: new Set() };
  }

  return {
    configured: true,
    active: result.data.active === true,
    jobRole: str(result.data.job_role) || null,
    permissions: permissionSet(result.data.permissions),
  };
}

export function canMotorsV164(
  access: MotorsEmployeeAccessV164,
  permission: MotorsPermissionKey,
  legacyFallback = true,
): boolean {
  if (!access.configured) return legacyFallback;
  return access.active && access.permissions.has(permission);
}

export async function getMotorsEmployeesAdminV164() {
  const supabase = await createClient();
  const [members, employees, audit] = await Promise.all([
    (supabase as any)
      .from("member_profiles")
      .select("user_id,rp_first_name,rp_last_name,discord_name,email,role,roles")
      .order("rp_last_name")
      .order("rp_first_name")
      .limit(5000),
    (supabase as any)
      .from("motors_employees_v164")
      .select("*")
      .order("active", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1000),
    (supabase as any)
      .from("motors_employee_audit_v164")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const employeeRows: any[] = Array.isArray(employees.data) ? employees.data : [];
  const byUser = new Map(employeeRows.map((row: any) => [String(row.user_id), row]));
  const memberRows: any[] = Array.isArray(members.data) ? members.data : [];

  return {
    configured: !employees.error,
    members: memberRows.map((row: any) => ({
      ...row,
      displayName:
        `${str(row.rp_first_name)} ${str(row.rp_last_name)}`.trim() ||
        str(row.discord_name) ||
        str(row.email) ||
        "Membre Nostra",
      employee: byUser.get(String(row.user_id)) ?? null,
    })),
    employees: employeeRows,
    audit: Array.isArray(audit.data) ? audit.data : [],
    error: employees.error?.message ?? null,
  };
}

export type VehicleMaintenanceV164 = {
  id: number;
  customerVehicleId: number;
  ownerUserId: string;
  maintenanceType: string;
  title: string;
  serviceDate: string;
  mileage: number | null;
  workDone: string | null;
  partsReplaced: string | null;
  vehicleCondition: string | null;
  staffComment: string | null;
  nextServiceDate: string | null;
  nextServiceMileage: number | null;
  cost: number;
  warrantyCovered: boolean;
  warrantyContractId: number | null;
  technicianUserId: string | null;
  technicianName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

function mapMaintenance(row: any): VehicleMaintenanceV164 {
  return {
    id: num(row.id),
    customerVehicleId: num(row.customer_vehicle_id),
    ownerUserId: str(row.owner_user_id),
    maintenanceType: str(row.maintenance_type),
    title: str(row.title),
    serviceDate: str(row.service_date),
    mileage: row.mileage == null ? null : num(row.mileage),
    workDone: row.work_done == null ? null : str(row.work_done),
    partsReplaced: row.parts_replaced == null ? null : str(row.parts_replaced),
    vehicleCondition: row.vehicle_condition == null ? null : str(row.vehicle_condition),
    staffComment: row.staff_comment == null ? null : str(row.staff_comment),
    nextServiceDate: row.next_service_date == null ? null : str(row.next_service_date),
    nextServiceMileage: row.next_service_mileage == null ? null : num(row.next_service_mileage),
    cost: num(row.cost),
    warrantyCovered: row.warranty_covered === true,
    warrantyContractId: row.warranty_contract_id == null ? null : num(row.warranty_contract_id),
    technicianUserId: row.technician_user_id == null ? null : str(row.technician_user_id),
    technicianName: row.technician_name == null ? null : str(row.technician_name),
    status: str(row.status),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    deletedAt: row.deleted_at == null ? null : str(row.deleted_at),
  };
}

export async function getVehicleMaintenanceV164(
  customerVehicleId: number,
  includeDeleted = false,
): Promise<{ configured: boolean; records: VehicleMaintenanceV164[]; error?: string }> {
  const supabase = await createClient();
  let query = (supabase as any)
    .from("motors_vehicle_maintenance_v164")
    .select("*")
    .eq("customer_vehicle_id", customerVehicleId)
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (!includeDeleted) query = query.is("deleted_at", null);
  const result = await query;
  return {
    configured: !result.error,
    records: (Array.isArray(result.data) ? result.data : []).map(mapMaintenance),
    error: result.error?.message,
  };
}

export async function getCitizenDirectoryV164(): Promise<Array<{ userId: string; name: string }>> {
  const supabase = await createClient();
  const result = await (supabase as any).rpc("nostra_v164_citizen_directory");
  if (result.error || !Array.isArray(result.data)) return [];
  return result.data.map((row: any) => ({ userId: str(row.user_id), name: str(row.display_name) }));
}

export async function getVehicleTransfersV164(userId?: string, customerVehicleId?: number) {
  const supabase = await createClient();
  let query = (supabase as any)
    .from("motors_vehicle_transfers_v164")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (customerVehicleId) query = query.eq("customer_vehicle_id", customerVehicleId);
  if (userId) query = query.or(`seller_user_id.eq.${userId},target_user_id.eq.${userId}`);
  const result = await query;
  return {
    configured: !result.error,
    requests: Array.isArray(result.data) ? result.data : [],
    error: result.error?.message ?? null,
  };
}

export async function getTransferAdminV164() {
  const supabase = await createClient();
  const [transfers, profiles, vehicles, settings] = await Promise.all([
    (supabase as any).from("motors_vehicle_transfers_v164").select("*").order("created_at", { ascending: false }).limit(1000),
    (supabase as any).from("member_profiles").select("user_id,rp_first_name,rp_last_name,discord_name,email").limit(5000),
    (supabase as any).from("customer_vehicles").select("id,user_id,brand,model,vehicle_name,order_number,nostra_vin").limit(5000),
    (supabase as any).from("motors_settings_v164").select("*").eq("id", 1).maybeSingle(),
  ]);

  const profileMap = new Map<string, string>();
  for (const row of Array.isArray(profiles.data) ? profiles.data : []) {
    profileMap.set(
      String(row.user_id),
      `${str(row.rp_first_name)} ${str(row.rp_last_name)}`.trim() || str(row.discord_name) || str(row.email) || "Citoyen",
    );
  }
  const vehicleMap = new Map<number, any>((Array.isArray(vehicles.data) ? vehicles.data : []).map((row: any) => [num(row.id), row]));

  return {
    configured: !transfers.error,
    requests: (Array.isArray(transfers.data) ? transfers.data : []).map((row: any) => ({
      ...row,
      sellerName: profileMap.get(String(row.seller_user_id)) ?? "Citoyen",
      targetName: profileMap.get(String(row.target_user_id)) ?? "Citoyen",
      vehicle: vehicleMap.get(num(row.customer_vehicle_id)) ?? null,
    })),
    policy: str(settings.data?.warranty_transfer_policy || "transfer"),
    error: transfers.error?.message ?? null,
  };
}

export async function refreshMyVehicleNotificationsV164(): Promise<void> {
  const supabase = await createClient();
  try {
    await (supabase as any).rpc("nostra_v164_refresh_my_vehicle_notifications");
  } catch {
    // Compatibilité tant que la migration V164 n'est pas exécutée.
  }
}

export async function getMotorsDirectionStatsV164(days = 30) {
  const supabase = await createClient();
  const since = days > 0 ? new Date(Date.now() - days * 86_400_000).toISOString() : null;

  const [orders, vehicles, warranties, workshop, maintenance, profiles, costs, showroomUnits] = await Promise.all([
    (supabase as any).from("orders").select("id,user_id,status,total,items,created_at").order("created_at", { ascending: false }).limit(10000),
    (supabase as any).from("catalog_vehicles").select("id,brand,model,stock_quantity,price,catalog_type").limit(5000),
    (supabase as any).from("motors_warranty_contracts_v163").select("id,plan_name,status,amount,created_at,paid_at,ends_at").limit(10000),
    (supabase as any).from("motors_workshop_cases_v162").select("id,status,quote_total,created_at,completed_at").limit(10000),
    (supabase as any).from("motors_vehicle_maintenance_v164").select("id,status,cost,warranty_covered,created_at,deleted_at").limit(10000),
    (supabase as any).from("member_profiles").select("user_id,created_at").limit(10000),
    (supabase as any).from("motors_vehicle_costs_v163").select("catalog_vehicle_id,purchase_cost,inbound_transport_per_unit,preparation_cost,other_cost").limit(5000),
    (supabase as any).from("motors_physical_vehicle_units_v162").select("catalog_vehicle_id,status,is_demo").eq("status","showroom").limit(10000),
  ]);

  const inPeriod = (value: unknown) => !since || (value && new Date(String(value)).getTime() >= new Date(since).getTime());
  const orderRows: any[] = (Array.isArray(orders.data) ? orders.data : []).filter((row: any) => row.status !== "cancelled" && inPeriod(row.created_at));
  const warrantyRows: any[] = (Array.isArray(warranties.data) ? warranties.data : []).filter((row: any) => inPeriod(row.paid_at || row.created_at));
  const workshopRows: any[] = (Array.isArray(workshop.data) ? workshop.data : []).filter((row: any) => inPeriod(row.created_at));
  const maintenanceRows: any[] = (Array.isArray(maintenance.data) ? maintenance.data : []).filter((row: any) => !row.deleted_at && inPeriod(row.created_at));
  const vehicleRows: any[] = Array.isArray(vehicles.data) ? vehicles.data : [];

  const costMap = new Map<number, number>();
  for (const row of Array.isArray(costs.data) ? costs.data : []) {
    costMap.set(
      num(row.catalog_vehicle_id),
      num(row.purchase_cost) + num(row.inbound_transport_per_unit) + num(row.preparation_cost) + num(row.other_cost),
    );
  }

  let motorsRevenue = 0;
  let soldUnits = 0;
  let estimatedCost = 0;
  const brandSales = new Map<string, { units: number; revenue: number }>();
  const modelSales = new Map<string, { units: number; revenue: number }>();

  for (const order of orderRows) {
    const items: any[] = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      if (!item || typeof item !== "object" || String(item.item_type) !== "vehicle") continue;
      const quantity = Math.max(1, num(item.quantity));
      const unitPrice = num(item.unit_price);
      const vehicleId = num(item.vehicle_id);
      const vehicle = vehicleRows.find((row: any) => num(row.id) === vehicleId);
      motorsRevenue += quantity * unitPrice;
      soldUnits += quantity;
      estimatedCost += quantity * (costMap.get(vehicleId) ?? 0);
      const brand = str(vehicle?.brand || "Inconnue");
      const model = `${brand} ${str(vehicle?.model || item.name || "")}`.trim();
      const b = brandSales.get(brand) ?? { units: 0, revenue: 0 };
      b.units += quantity; b.revenue += quantity * unitPrice; brandSales.set(brand, b);
      const m = modelSales.get(model) ?? { units: 0, revenue: 0 };
      m.units += quantity; m.revenue += quantity * unitPrice; modelSales.set(model, m);
    }
  }

  const uniqueCustomers = new Set(orderRows.map((row: any) => str(row.user_id)).filter(Boolean));
  const warrantyRevenue = warrantyRows
    .filter((row: any) => row.status !== "cancelled" && row.status !== "pending_payment")
    .reduce((sum: number, row: any) => sum + num(row.amount), 0);
  const care = warrantyRows.filter((row: any) => str(row.plan_name).toLowerCase().includes("care") && !str(row.plan_name).includes("+")).length;
  const carePlus = warrantyRows.filter((row: any) => str(row.plan_name).includes("+")).length;
  const activeWarranties = (Array.isArray(warranties.data) ? warranties.data : []).filter((row: any) => row.status === "active" && new Date(String(row.ends_at)).getTime() > Date.now()).length;
  const workshopRevenue = workshopRows.reduce((sum: number, row: any) => sum + num(row.quote_total), 0);
  const maintenanceRevenue = maintenanceRows.reduce((sum: number, row: any) => sum + num(row.cost), 0);
  const lowStock = vehicleRows.filter((row: any) => num(row.stock_quantity) <= 2).length;
  const outOfStock = vehicleRows.filter((row: any) => num(row.stock_quantity) <= 0).length;
  const demoCount = (Array.isArray(showroomUnits.data) ? showroomUnits.data : []).filter((row: any) => row.is_demo === true).length;
  const newCitizens = (Array.isArray(profiles.data) ? profiles.data : []).filter((row: any) => inPeriod(row.created_at)).length;

  const topBrand = [...brandSales.entries()].sort((a, b) => b[1].units - a[1].units)[0] ?? null;
  const topModel = [...modelSales.entries()].sort((a, b) => b[1].units - a[1].units)[0] ?? null;

  return {
    configured: !orders.error && !vehicles.error,
    periodDays: days,
    motorsRevenue,
    soldUnits,
    averageBasket: orderRows.length ? motorsRevenue / orderRows.length : 0,
    estimatedCost,
    estimatedMargin: motorsRevenue - estimatedCost,
    estimatedMarginPercent: motorsRevenue > 0 ? ((motorsRevenue - estimatedCost) / motorsRevenue) * 100 : 0,
    uniqueCustomers: uniqueCustomers.size,
    newCitizens,
    topBrand: topBrand ? { name: topBrand[0], ...topBrand[1] } : null,
    topModel: topModel ? { name: topModel[0], ...topModel[1] } : null,
    stock: { total: vehicleRows.length, low: lowStock, out: outOfStock, demos: demoCount },
    warranty: { revenue: warrantyRevenue, care, carePlus, active: activeWarranties, total: warrantyRows.length },
    workshop: {
      cases: workshopRows.length,
      active: workshopRows.filter((row: any) => !["returned", "cancelled", "closed"].includes(str(row.status))).length,
      revenue: workshopRevenue,
      maintenanceRecords: maintenanceRows.length,
      maintenanceRevenue,
      warrantyCovered: maintenanceRows.filter((row: any) => row.warranty_covered === true).length,
    },
    brands: [...brandSales.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.units - a.units).slice(0, 10),
    models: [...modelSales.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.units - a.units).slice(0, 10),
    error: orders.error?.message ?? vehicles.error?.message ?? null,
  };
}
