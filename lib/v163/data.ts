import { createClient } from "@/lib/supabase/server";

const n = (value: unknown) => Number(value ?? 0) || 0;
const s = (value: unknown) => (value == null ? "" : String(value));

export async function getSuppliersV163() {
  const supabase = await createClient();
  const [suppliers, orders, items, vehicles] = await Promise.all([
    (supabase as any).from("motors_suppliers_v163").select("*").order("name"),
    (supabase as any).from("motors_supplier_orders_v163").select("*").order("created_at", { ascending: false }).limit(250),
    (supabase as any).from("motors_supplier_order_items_v163").select("*").limit(1000),
    (supabase as any).from("catalog_vehicles").select("id,brand,model,price,stock_quantity,catalog_type").order("brand").order("model").limit(3000),
  ]);
  const configured = !suppliers.error && !orders.error && !items.error;
  const orderRows: any[] = Array.isArray(orders.data) ? orders.data : [];
  const itemRows: any[] = Array.isArray(items.data) ? items.data : [];
  return {
    configured,
    suppliers: Array.isArray(suppliers.data) ? suppliers.data : [],
    orders: orderRows.map((order: any) => ({
      ...order,
      items: itemRows.filter((item: any) => Number(item.supplier_order_id) === Number(order.id)),
    })),
    vehicles: Array.isArray(vehicles.data) ? vehicles.data : [],
  };
}

export async function getMarginsV163() {
  const supabase = await createClient();
  const [costs, vehicles, orders] = await Promise.all([
    (supabase as any).from("motors_vehicle_costs_v163").select("*").limit(3000),
    (supabase as any).from("catalog_vehicles").select("id,brand,model,price,catalog_type").limit(3000),
    (supabase as any).from("orders").select("id,order_number,status,total,items,created_at,customer_name").neq("status", "cancelled").order("created_at", { ascending: false }).limit(2500),
  ]);
  const costRows: any[] = Array.isArray(costs.data) ? costs.data : [];
  const vehicleRows: any[] = Array.isArray(vehicles.data) ? vehicles.data : [];
  const orderRows: any[] = Array.isArray(orders.data) ? orders.data : [];
  const costMap = new Map<number, any>(costRows.map((row: any) => [Number(row.catalog_vehicle_id), row]));
  const vehicleMap = new Map<number, any>(vehicleRows.map((row: any) => [Number(row.id), row]));
  const lines: any[] = [];
  for (const order of orderRows) {
    const snapshots: any[] = Array.isArray(order.items) ? order.items : [];
    for (const raw of snapshots) {
      if (!raw || typeof raw !== "object" || String(raw.item_type) !== "vehicle") continue;
      const vehicleId = n(raw.vehicle_id);
      if (!vehicleId) continue;
      const quantity = Math.max(1, n(raw.quantity));
      const unitPrice = n(raw.unit_price);
      const cost = costMap.get(vehicleId);
      const unitCost = cost ? n(cost.purchase_cost) + n(cost.inbound_transport_per_unit) + n(cost.preparation_cost) + n(cost.other_cost) : 0;
      const revenue = unitPrice * quantity;
      const totalCost = unitCost * quantity;
      lines.push({
        orderId: Number(order.id), orderNumber: s(order.order_number), customerName: s(order.customer_name), status: s(order.status), createdAt: s(order.created_at),
        vehicleId, vehicle: vehicleMap.get(vehicleId), quantity, unitPrice, revenue, unitCost, totalCost,
        margin: revenue - totalCost,
        marginPercent: revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0,
        configuredCost: Boolean(cost),
      });
    }
  }
  const totalRevenue = lines.reduce((sum: number, row: any) => sum + row.revenue, 0);
  const totalCost = lines.reduce((sum: number, row: any) => sum + row.totalCost, 0);
  return {
    configured: !costs.error && !orders.error,
    lines,
    vehicles: vehicleRows,
    costs: costRows,
    totalRevenue,
    totalCost,
    totalMargin: totalRevenue - totalCost,
    marginPercent: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
  };
}

export async function getWarrantyAdminV163() {
  const supabase = await createClient();
  const [plans, contracts, vehicles, profiles] = await Promise.all([
    (supabase as any).from("motors_warranty_plans_v163").select("*").order("created_at", { ascending: false }),
    (supabase as any).from("motors_warranty_contracts_v163").select("*").order("created_at", { ascending: false }).limit(1000),
    (supabase as any).from("customer_vehicles").select("id,user_id,vehicle_name,brand,model,purchase_price,order_number").limit(3000),
    (supabase as any).from("member_profiles").select("user_id,rp_first_name,rp_last_name,discord_name,email").limit(5000),
  ]);
  return {
    configured: !plans.error && !contracts.error,
    plans: Array.isArray(plans.data) ? plans.data : [],
    contracts: Array.isArray(contracts.data) ? contracts.data : [],
    vehicles: Array.isArray(vehicles.data) ? vehicles.data : [],
    profiles: Array.isArray(profiles.data) ? profiles.data : [],
  };
}

export async function getMyWarrantiesV163(userId: string, customerVehicleId?: number) {
  const supabase = await createClient();
  let vehiclesQuery = (supabase as any).from("customer_vehicles").select("id,user_id,vehicle_name,brand,model,image_url,purchase_price,order_number,garage_status").eq("user_id", userId).neq("garage_status", "cancelled").order("created_at", { ascending: false });
  if (customerVehicleId) vehiclesQuery = vehiclesQuery.eq("id", customerVehicleId);
  const [vehicles, warrantyPlans, warranties] = await Promise.all([
    vehiclesQuery,
    (supabase as any).from("motors_warranty_plans_v163").select("*").eq("active", true).order("duration_days"),
    (supabase as any).from("motors_warranty_contracts_v163").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);
  return {
    configured: !warrantyPlans.error && !warranties.error,
    vehicles: Array.isArray(vehicles.data) ? vehicles.data : [],
    warrantyPlans: Array.isArray(warrantyPlans.data) ? warrantyPlans.data : [],
    warranties: Array.isArray(warranties.data) ? warranties.data : [],
  };
}

export async function getCrmAfterSalesOverviewV163(userId: string) {
  const supabase = await createClient();
  const [warranties, workshop] = await Promise.all([
    (supabase as any).from("motors_warranty_contracts_v163").select("id,status,amount,ends_at,customer_vehicle_id,plan_name").eq("user_id", userId),
    (supabase as any).from("motors_workshop_cases_v162").select("id,status,quote_total,created_at").eq("user_id", userId).limit(250),
  ]);
  const warrantyRows: any[] = Array.isArray(warranties.data) ? warranties.data : [];
  const workshopRows: any[] = Array.isArray(workshop.data) ? workshop.data : [];
  return {
    configured: !warranties.error,
    activeWarranties: warrantyRows.filter((x: any) => x.status === "active" && new Date(String(x.ends_at)).getTime() > Date.now()).length,
    warrantySpent: warrantyRows.reduce((sum: number, x: any) => sum + n(x.amount), 0),
    workshopCases: workshopRows.length,
    workshopOpen: workshopRows.filter((x: any) => !["returned", "closed", "cancelled"].includes(String(x.status))).length,
  };
}
