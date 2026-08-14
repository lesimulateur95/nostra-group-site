import "server-only";

import type { CatalogType, CatalogVehicleV51 } from "@/lib/catalogues-v51/data";
import { createClient } from "@/lib/supabase/server";

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export type WorkshopStatusV162 =
  | "requested" | "accepted" | "vehicle_received" | "diagnosis" | "quote_waiting"
  | "quote_accepted" | "quote_refused" | "in_progress" | "final_check" | "ready"
  | "returned" | "cancelled";

export type WorkshopCaseV162 = {
  id: number; caseNumber: string; userId: string; customerVehicleId: number | null;
  catalogVehicleId: number | null; vehicleLabel: string; serviceType: string; mileage: number | null;
  description: string; requestedDate: string | null; requestedSlot: string | null; appointmentAt: string | null;
  status: WorkshopStatusV162; quoteStatus: string; quoteTotal: number; assignedTo: string | null;
  diagnosis: string | null; internalNote: string | null; completedAt: string | null; createdAt: string; updatedAt: string;
  customerName?: string;
};

export type WorkshopQuoteLineV162 = { id: number; caseId: number; label: string; quantity: number; unitPrice: number };

function mapWorkshop(row: Record<string, unknown>): WorkshopCaseV162 {
  return {
    id: num(row.id), caseNumber: str(row.case_number), userId: str(row.user_id),
    customerVehicleId: row.customer_vehicle_id == null ? null : num(row.customer_vehicle_id),
    catalogVehicleId: row.catalog_vehicle_id == null ? null : num(row.catalog_vehicle_id),
    vehicleLabel: str(row.vehicle_label), serviceType: str(row.service_type, "maintenance"),
    mileage: row.mileage == null ? null : num(row.mileage), description: str(row.description),
    requestedDate: row.requested_date ? str(row.requested_date) : null, requestedSlot: row.requested_slot ? str(row.requested_slot) : null,
    appointmentAt: row.appointment_at ? str(row.appointment_at) : null,
    status: str(row.status, "requested") as WorkshopStatusV162, quoteStatus: str(row.quote_status, "none"), quoteTotal: num(row.quote_total),
    assignedTo: row.assigned_to ? str(row.assigned_to) : null, diagnosis: row.diagnosis ? str(row.diagnosis) : null,
    internalNote: row.internal_note ? str(row.internal_note) : null, completedAt: row.completed_at ? str(row.completed_at) : null,
    createdAt: str(row.created_at), updatedAt: str(row.updated_at),
  };
}

export async function getMyWorkshopCasesV162(userId: string): Promise<WorkshopCaseV162[]> {
  const s = await createClient();
  const { data, error } = await (s as any).from("motors_workshop_cases_v162").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return error ? [] : (data ?? []).map((r: Record<string, unknown>) => mapWorkshop(r));
}

export async function getWorkshopCasesV162(): Promise<WorkshopCaseV162[]> {
  const s = await createClient();
  const [{ data, error }, profiles] = await Promise.all([
    (s as any).from("motors_workshop_cases_v162").select("*").order("updated_at", { ascending: false }).limit(500),
    (s as any).from("member_profiles").select("user_id,rp_first_name,rp_last_name,discord_name"),
  ]);
  if (error) return [];
  const names = new Map<string, string>();
  for (const p of profiles.data ?? []) {
    const name = `${str(p.rp_first_name)} ${str(p.rp_last_name)}`.trim() || str(p.discord_name, "Citoyen");
    names.set(str(p.user_id), name);
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({ ...mapWorkshop(r), customerName: names.get(str(r.user_id)) ?? "Citoyen" }));
}

export async function getWorkshopQuoteLinesV162(caseIds: number[]): Promise<Map<number, WorkshopQuoteLineV162[]>> {
  const result = new Map<number, WorkshopQuoteLineV162[]>(caseIds.map((id) => [id, []]));
  if (!caseIds.length) return result;
  const s = await createClient();
  const { data, error } = await (s as any).from("motors_workshop_quote_lines_v162").select("id,case_id,label,quantity,unit_price").in("case_id", caseIds).order("id");
  if (error) return result;
  for (const row of data ?? []) {
    const line = { id: num(row.id), caseId: num(row.case_id), label: str(row.label), quantity: num(row.quantity, 1), unitPrice: num(row.unit_price) };
    result.get(line.caseId)?.push(line);
  }
  return result;
}

export type CampaignV162 = {
  id: number; name: string; description: string | null; badgeText: string; campaignType: "percent"|"fixed"|"free_delivery"|"highlight";
  discountValue: number; targetScope: "all"|"catalog"|"brand"|"vehicle"|"collection"; targetCatalogType: string | null;
  targetBrand: string | null; targetVehicleId: number | null; targetCollectionId: string | null; startsAt: string | null; endsAt: string | null;
  enabled: boolean; priority: number;
};

function mapCampaign(row: Record<string, unknown>): CampaignV162 {
  return {
    id: num(row.id), name: str(row.name), description: row.description ? str(row.description) : null,
    badgeText: str(row.badge_text) || str(row.name).toUpperCase(), campaignType: str(row.campaign_type, "percent") as CampaignV162["campaignType"],
    discountValue: num(row.discount_value), targetScope: str(row.target_scope, "all") as CampaignV162["targetScope"],
    targetCatalogType: row.target_catalog_type ? str(row.target_catalog_type) : null, targetBrand: row.target_brand ? str(row.target_brand) : null,
    targetVehicleId: row.target_vehicle_id == null ? null : num(row.target_vehicle_id), targetCollectionId: row.target_collection_id ? str(row.target_collection_id) : null,
    startsAt: row.starts_at ? str(row.starts_at) : null, endsAt: row.ends_at ? str(row.ends_at) : null,
    enabled: row.enabled !== false, priority: num(row.priority),
  };
}

export async function getCampaignsV162(includeDisabled = false): Promise<CampaignV162[]> {
  const s = await createClient();
  let q = (s as any).from("motors_campaigns_v162").select("*").order("priority", { ascending: false }).order("id", { ascending: false });
  if (!includeDisabled) q = q.eq("enabled", true);
  const { data, error } = await q;
  return error ? [] : (data ?? []).map((r: Record<string, unknown>) => mapCampaign(r));
}

export function campaignIsActiveV162(c: CampaignV162, now = Date.now()): boolean {
  return c.enabled && (!c.startsAt || new Date(c.startsAt).getTime() <= now) && (!c.endsAt || new Date(c.endsAt).getTime() >= now);
}

export function campaignMatchesVehicleV162(c: CampaignV162, vehicle: Pick<CatalogVehicleV51,"id"|"brand"|"catalog_type">, collectionIds: string[] = []): boolean {
  if (!campaignIsActiveV162(c)) return false;
  if (c.targetScope === "all") return true;
  if (c.targetScope === "catalog") return vehicle.catalog_type === c.targetCatalogType;
  if (c.targetScope === "brand") return vehicle.brand.trim().toLocaleLowerCase("fr") === (c.targetBrand ?? "").trim().toLocaleLowerCase("fr");
  if (c.targetScope === "vehicle") return Number(vehicle.id) === c.targetVehicleId;
  if (c.targetScope === "collection") return !!c.targetCollectionId && collectionIds.includes(c.targetCollectionId);
  return false;
}

export function applyCampaignPriceV162(basePrice: number, campaigns: CampaignV162[]): { price: number; campaign: CampaignV162 | null; freeDelivery: boolean } {
  let price = Math.max(0, basePrice); let chosen: CampaignV162 | null = null; let freeDelivery = false;
  for (const c of campaigns) {
    if (c.campaignType === "free_delivery") { freeDelivery = true; continue; }
    let candidate = basePrice;
    if (c.campaignType === "percent") candidate = Math.max(0, basePrice * (1 - Math.min(100, c.discountValue) / 100));
    if (c.campaignType === "fixed") candidate = Math.max(0, basePrice - c.discountValue);
    if (candidate < price) { price = candidate; chosen = c; }
    if (!chosen && c.campaignType === "highlight") chosen = c;
  }
  return { price: Math.round(price), campaign: chosen, freeDelivery };
}

export type PhysicalUnitV162 = { id: number; unitCode: string; catalogVehicleId: number; status: string; location: string; holdId: number|null; orderId: number|null; userId: string|null; notes: string|null; updatedAt: string };
export type PhysicalStockGroupV162 = { vehicleId: number; brand: string; model: string; catalogType: CatalogType; stockQuantity: number; units: PhysicalUnitV162[] };

export async function getPhysicalStockV162(): Promise<PhysicalStockGroupV162[]> {
  const s = await createClient();
  const [vehicles, units] = await Promise.all([
    (s as any).from("catalog_vehicles").select("id,brand,model,catalog_type,stock_quantity").order("brand").order("model"),
    (s as any).from("motors_physical_vehicle_units_v162").select("*").order("catalog_vehicle_id").order("id"),
  ]);
  if (vehicles.error) return [];
  const byVehicle = new Map<number, PhysicalUnitV162[]>();
  for (const r of units.data ?? []) {
    const v: PhysicalUnitV162 = { id:num(r.id), unitCode:str(r.unit_code), catalogVehicleId:num(r.catalog_vehicle_id), status:str(r.status), location:str(r.location), holdId:r.hold_id==null?null:num(r.hold_id), orderId:r.order_id==null?null:num(r.order_id), userId:r.user_id?str(r.user_id):null, notes:r.notes?str(r.notes):null, updatedAt:str(r.updated_at) };
    const current = byVehicle.get(v.catalogVehicleId) ?? []; current.push(v); byVehicle.set(v.catalogVehicleId,current);
  }
  return (vehicles.data ?? []).map((v: any) => ({ vehicleId:num(v.id), brand:str(v.brand), model:str(v.model), catalogType:str(v.catalog_type,"standard") as CatalogType, stockQuantity:num(v.stock_quantity), units:byVehicle.get(num(v.id)) ?? [] }));
}

export type ConciergeRequestV162 = {
  id:number; requestNumber:string; userId:string; requestType:string; subject:string; description:string; budget:number|null; status:string; assignedTo:string|null;
  proposedVehicleId:number|null; proposedPrice:number|null; proposalMessage:string|null; proposalExpiresAt:string|null; createdAt:string; updatedAt:string;
  customerName?:string; proposedVehicleLabel?:string;
};
function mapConcierge(r: Record<string,unknown>): ConciergeRequestV162 { return { id:num(r.id),requestNumber:str(r.request_number),userId:str(r.user_id),requestType:str(r.request_type),subject:str(r.subject),description:str(r.description),budget:r.budget==null?null:num(r.budget),status:str(r.status),assignedTo:r.assigned_to?str(r.assigned_to):null,proposedVehicleId:r.proposed_vehicle_id==null?null:num(r.proposed_vehicle_id),proposedPrice:r.proposed_price==null?null:num(r.proposed_price),proposalMessage:r.proposal_message?str(r.proposal_message):null,proposalExpiresAt:r.proposal_expires_at?str(r.proposal_expires_at):null,createdAt:str(r.created_at),updatedAt:str(r.updated_at) }; }

export async function getMyConciergeRequestsV162(userId:string):Promise<ConciergeRequestV162[]> {
  const s=await createClient(); const {data,error}=await (s as any).from("motors_concierge_requests_v162").select("*").eq("user_id",userId).order("created_at",{ascending:false}); if(error)return[];
  const rows=(data??[]).map((r:Record<string,unknown>)=>mapConcierge(r)); const ids=[...new Set(rows.map(r=>r.proposedVehicleId).filter((x):x is number=>!!x))];
  if(ids.length){const v=await (s as any).from("catalog_vehicles").select("id,brand,model").in("id",ids);const m=new Map((v.data??[]).map((x:any)=>[num(x.id),`${str(x.brand)} ${str(x.model)}`.trim()]));for(const r of rows)r.proposedVehicleLabel=r.proposedVehicleId?m.get(r.proposedVehicleId):undefined;}
  return rows;
}

export async function getConciergeRequestsV162():Promise<ConciergeRequestV162[]> {
  const s=await createClient(); const [req,profiles,vehicles]=await Promise.all([(s as any).from("motors_concierge_requests_v162").select("*").order("updated_at",{ascending:false}).limit(500),(s as any).from("member_profiles").select("user_id,rp_first_name,rp_last_name,discord_name"),(s as any).from("catalog_vehicles").select("id,brand,model,published").order("brand").order("model")]); if(req.error)return[];
  const names=new Map<string,string>();for(const p of profiles.data??[]){names.set(str(p.user_id),`${str(p.rp_first_name)} ${str(p.rp_last_name)}`.trim()||str(p.discord_name,"Citoyen"));}
  const vm=new Map<number,string>((vehicles.data??[]).map((v:any)=>[num(v.id),`${str(v.brand)} ${str(v.model)}`.trim()]));
  return (req.data??[]).map((r:Record<string,unknown>)=>{const x=mapConcierge(r);return{...x,customerName:names.get(x.userId)??"Citoyen",proposedVehicleLabel:x.proposedVehicleId?vm.get(x.proposedVehicleId):undefined};});
}

export async function getStaffMembersV162(): Promise<Array<{userId:string;name:string}>> {
  const s=await createClient(); const {data,error}=await (s as any).from("member_profiles").select("user_id,rp_first_name,rp_last_name,discord_name,role,roles"); if(error)return[];
  return (data??[]).filter((p:any)=>{const raw=[str(p.role),...(Array.isArray(p.roles)?p.roles.map(String):[])].join(" ").toLowerCase();return ["manager","employee","commercial","gérant","employé"].some(k=>raw.includes(k));}).map((p:any)=>({userId:str(p.user_id),name:`${str(p.rp_first_name)} ${str(p.rp_last_name)}`.trim()||str(p.discord_name,"Membre Nostra")}));
}
