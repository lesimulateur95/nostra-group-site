import "server-only";

import { getCitizenBankInformation } from "@/lib/game-bank/data";
import { createClient } from "@/lib/supabase/server";

const n = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const s = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

export type RentalVehicleV155 = {
  vehicleId: number;
  brand: string;
  model: string;
  imageUrl: string | null;
  stock: number;
  dailyRate: number;
  depositAmount: number;
  minDays: number;
  maxDays: number;
  mileageIncludedPerDay: number;
  extraKmPrice: number;
  active: boolean;
};

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  const first = images[0];
  if (!first || typeof first !== "object") return null;
  const url = (first as Record<string, unknown>).url;
  return typeof url === "string" ? url : null;
}

export async function getRentalVehiclesV155(includeInactive = false): Promise<RentalVehicleV155[]> {
  const supabase = await createClient();
  const [vehicles, settings] = await Promise.all([
    (supabase as any)
      .from("catalog_vehicles")
      .select("id,brand,model,images,stock_quantity,published,catalog_type")
      .eq("catalog_type", "concession")
      .order("brand"),
    (supabase as any).from("motors_rental_settings_v155").select("*")
  ]);
  if (vehicles.error) return [];
  const settingMap = new Map<string, any>((settings.data ?? []).map((row: any) => [String(row.vehicle_id), row]));
  return (vehicles.data ?? []).flatMap((row: any) => {
    const cfg = settingMap.get(String(row.id));
    if (!includeInactive && (!row.published || cfg?.active === false)) return [];
    return [{
      vehicleId: n(row.id), brand: s(row.brand), model: s(row.model), imageUrl: firstImage(row.images), stock: n(row.stock_quantity),
      dailyRate: n(cfg?.daily_rate), depositAmount: n(cfg?.deposit_amount), minDays: Math.max(1,n(cfg?.min_days,1)), maxDays: Math.max(1,n(cfg?.max_days,30)),
      mileageIncludedPerDay: n(cfg?.mileage_included_per_day,200), extraKmPrice: n(cfg?.extra_km_price), active: cfg?.active !== false,
    }];
  });
}

export async function getRentalBookingsV155(userId?: string) {
  const supabase = await createClient();
  let query = (supabase as any).from("motors_rental_bookings_v155").select("*,catalog_vehicles(brand,model,images)").order("created_at",{ascending:false});
  if (userId) query = query.eq("user_id",userId);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map((row:any)=>({
    id:s(row.id), rentalNumber:s(row.rental_number), userId:s(row.user_id), vehicleId:n(row.vehicle_id), brand:s(row.catalog_vehicles?.brand), model:s(row.catalog_vehicles?.model), imageUrl:firstImage(row.catalog_vehicles?.images),
    startDate:s(row.start_date), endDate:s(row.end_date), days:n(row.days), dailyRate:n(row.daily_rate), depositAmount:n(row.deposit_amount), totalAmount:n(row.total_amount), status:s(row.status), pickupLocation:s(row.pickup_location),
    mileageOut:row.mileage_out==null?null:n(row.mileage_out), mileageIn:row.mileage_in==null?null:n(row.mileage_in), conditionOut:row.condition_out?s(row.condition_out):null, conditionIn:row.condition_in?s(row.condition_in):null,
    damageNotes:row.damage_notes?s(row.damage_notes):null, staffNotes:row.staff_notes?s(row.staff_notes):null, createdAt:s(row.created_at)
  }));
}

export async function getStockOverviewV155() {
  const supabase = await createClient();
  const [vehicles, states, reservations, rentals] = await Promise.all([
    (supabase as any).from("catalog_vehicles").select("id,brand,model,stock_quantity,catalog_type,published,showroom_visible").order("brand"),
    (supabase as any).from("motors_vehicle_stock_v155").select("*"),
    (supabase as any).from("vehicle_reservations").select("vehicle_id,quantity,status,stock_reserved"),
    (supabase as any).from("motors_rental_bookings_v155").select("vehicle_id,status,start_date,end_date")
  ]);
  if (vehicles.error) return [];
  const stateMap = new Map<string,any>((states.data??[]).map((r:any)=>[String(r.vehicle_id),r]));
  const reserved = new Map<string,number>();
  for (const r of reservations.data??[]) if (r.stock_reserved && !["rejected","cancelled","completed"].includes(s(r.status))) reserved.set(String(r.vehicle_id),(reserved.get(String(r.vehicle_id))??0)+Math.max(1,n(r.quantity,1)));
  const rented = new Map<string,number>();
  for (const r of rentals.data??[]) if (["confirmed","ready","active"].includes(s(r.status))) rented.set(String(r.vehicle_id),(rented.get(String(r.vehicle_id))??0)+1);
  return (vehicles.data??[]).map((r:any)=>{
    const state=stateMap.get(String(r.id)); const total=n(r.stock_quantity); const res=reserved.get(String(r.id))??0; const rent=rented.get(String(r.id))??0;
    return {vehicleId:n(r.id),brand:s(r.brand),model:s(r.model),catalogType:s(r.catalog_type),totalStock:total,reserved:res,rented:rent,available:Math.max(0,total-res-rent),status:s(state?.operational_status,"available"),location:s(state?.physical_location,"Concession Nostra Motors"),minimumStock:n(state?.minimum_stock,1),notes:state?.notes?s(state.notes):null,published:r.published===true,showroom:r.showroom_visible===true};
  });
}

export async function getWalletV155(userId:string, steamId:string|null) {
  const supabase = await createClient();
  const [bank, ledger, referrals, tickets] = await Promise.all([
    getCitizenBankInformation(steamId),
    (supabase as any).from("nostra_wallet_ledger_v155").select("*").eq("user_id",userId).order("created_at",{ascending:false}).limit(100),
    (supabase as any).from("nostra_referrals_v155").select("id",{count:"exact",head:true}).eq("referrer_user_id",userId).eq("status","validated"),
    (supabase as any).from("nostra_ticket_orders_v153").select("total,status").eq("user_id",userId)
  ]);
  const rows=ledger.data??[]; const points=rows.reduce((sum:number,r:any)=>sum+n(r.loyalty_points),0); const activityRp=rows.reduce((sum:number,r:any)=>sum+n(r.amount_rp),0);
  return {bank,points,activityRp,referrals:referrals.count??0,ticketSpend:(tickets.data??[]).filter((r:any)=>!["cancelled","refunded"].includes(s(r.status))).reduce((sum:number,r:any)=>sum+n(r.total),0),entries:rows.map((r:any)=>({id:n(r.id),type:s(r.entry_type),label:s(r.label),amountRp:n(r.amount_rp),points:n(r.loyalty_points),createdAt:s(r.created_at)}))};
}

export async function getLoyaltyTiersV155() {
  const supabase=await createClient();
  const {data,error}=await (supabase as any).from("loyalty_tiers").select("*").order("sort_order");
  if(error)return [];
  return (data??[]).map((r:any)=>({code:s(r.code),label:s(r.label),catalogDiscount:n(r.catalog_discount_percent),plateDiscount:n(r.plate_discount_percent),benefits:Array.isArray(r.benefits)?r.benefits.map(String):[],minPoints:n(r.min_points),description:r.public_description?s(r.public_description):null,active:r.active!==false,sortOrder:n(r.sort_order)}));
}

export async function getReferralOverviewV155(userId:string) {
  const supabase=await createClient();
  await (supabase as any).rpc("nostra_ensure_referral_code_v155");
  const [code, referred, ownReferral] = await Promise.all([
    (supabase as any).from("nostra_referral_codes_v155").select("code").eq("user_id",userId).maybeSingle(),
    (supabase as any).from("nostra_referrals_v155").select("id,status,created_at,referred_user_id").eq("referrer_user_id",userId).order("created_at",{ascending:false}),
    (supabase as any).from("nostra_referrals_v155").select("id,status,code,created_at").eq("referred_user_id",userId).maybeSingle()
  ]);
  return {code:s(code.data?.code),referred:referred.data??[],ownReferral:ownReferral.data??null};
}

export async function getPrivateSalesV155(userId?:string, includeDisabled=false) {
  const supabase=await createClient();
  let query=(supabase as any).from("nostra_private_sales_v155").select("*,catalog_vehicles(id,brand,model,price,images,stock_quantity,published)").order("created_at",{ascending:false});
  if(!includeDisabled) query=query.eq("enabled",true);
  const {data,error}=await query; if(error)return [];
  let points=0; if(userId){const {data:p}=await (supabase as any).rpc("nostra_loyalty_points_v155",{p_user_id:userId}); points=n(p);}
  const now=Date.now();
  return (data??[]).map((r:any)=>({id:s(r.id),vehicleId:n(r.vehicle_id),title:s(r.title),description:s(r.description),minPoints:n(r.min_loyalty_points),startsAt:r.starts_at?s(r.starts_at):null,endsAt:r.ends_at?s(r.ends_at):null,enabled:r.enabled!==false,stockLimit:r.stock_limit==null?null:n(r.stock_limit),brand:s(r.catalog_vehicles?.brand),model:s(r.catalog_vehicles?.model),price:n(r.catalog_vehicles?.price),imageUrl:firstImage(r.catalog_vehicles?.images),eligible:points>=n(r.min_loyalty_points)&&(!r.starts_at||new Date(r.starts_at).getTime()<=now)&&(!r.ends_at||new Date(r.ends_at).getTime()>=now),points}));
}

export async function getMyWaitlistV155(userId:string) {
  const supabase=await createClient();
  const {data,error}=await (supabase as any).from("nostra_vehicle_waitlist_v155").select("*,catalog_vehicles(brand,model,price,stock_quantity,images)").eq("user_id",userId).order("created_at",{ascending:false}); if(error)return [];
  return (data??[]).map((r:any)=>({id:n(r.id),vehicleId:n(r.vehicle_id),reason:s(r.reason),createdAt:s(r.created_at),brand:s(r.catalog_vehicles?.brand),model:s(r.catalog_vehicles?.model),price:n(r.catalog_vehicles?.price),stock:n(r.catalog_vehicles?.stock_quantity),imageUrl:firstImage(r.catalog_vehicles?.images)}));
}

export async function getRefundsV155() {
  const supabase=await createClient();
  const [rows,profiles]=await Promise.all([(supabase as any).from("nostra_refunds_v155").select("*").order("created_at",{ascending:false}),(supabase as any).from("member_profiles").select("user_id,rp_first_name,rp_last_name,discord_name,steam_id")]);
  const pMap=new Map<string,any>((profiles.data??[]).map((p:any)=>[String(p.user_id),p]));
  return (rows.data??[]).map((r:any)=>{const p=pMap.get(String(r.user_id)); return {...r,id:s(r.id),userId:s(r.user_id),name:`${p?.rp_first_name??""} ${p?.rp_last_name??""}`.trim()||s(p?.discord_name,"Citoyen"),steamId:p?.steam_id?s(p.steam_id):null,amount:n(r.amount)};});
}

export async function getAuditV155(query="") {
  const supabase=await createClient();
  let q=(supabase as any).from("nostra_audit_log_v155").select("*").order("created_at",{ascending:false}).limit(300);
  const {data,error}=await q; if(error)return [];
  const term=query.trim().toLowerCase(); return (data??[]).filter((r:any)=>!term||`${r.action} ${r.entity_type} ${r.entity_id??""} ${r.summary??""}`.toLowerCase().includes(term));
}

export async function getNewsV155(includeHidden=false) {
  const supabase=await createClient(); let q=(supabase as any).from("nostra_news_v155").select("*").order("created_at",{ascending:false}); if(!includeHidden)q=q.eq("published",true); const {data,error}=await q; if(error)return [];
  const now=Date.now(); return (data??[]).filter((r:any)=>includeHidden||((!r.starts_at||new Date(r.starts_at).getTime()<=now)&&(!r.ends_at||new Date(r.ends_at).getTime()>=now)));
}
export async function getBannersV155(includeHidden=false) {
  const supabase=await createClient(); let q=(supabase as any).from("nostra_banners_v155").select("*").order("priority",{ascending:false}).order("created_at",{ascending:false}); if(!includeHidden)q=q.eq("active",true); const {data,error}=await q; if(error)return [];
  const now=Date.now(); return (data??[]).filter((r:any)=>includeHidden||((!r.starts_at||new Date(r.starts_at).getTime()<=now)&&(!r.ends_at||new Date(r.ends_at).getTime()>=now)));
}
export async function getAnnouncementsV155(includeHidden=false) {
  const supabase=await createClient(); let q=(supabase as any).from("nostra_announcements_v155").select("*").order("created_at",{ascending:false}); if(!includeHidden)q=q.eq("active",true); const {data,error}=await q; if(error)return [];
  const now=Date.now(); return (data??[]).filter((r:any)=>includeHidden||((!r.starts_at||new Date(r.starts_at).getTime()<=now)&&(!r.ends_at||new Date(r.ends_at).getTime()>=now)));
}

export async function getTodayV155() {
  const supabase=await createClient(); const today=new Date(); const start=new Date(today); start.setHours(0,0,0,0); const end=new Date(today); end.setHours(23,59,59,999);
  const [events,tickets,showroom,news,banners]=await Promise.all([
    (supabase as any).from("events").select("id,title,location,starts_at,status").gte("starts_at",start.toISOString()).lte("starts_at",end.toISOString()).order("starts_at"),
    (supabase as any).from("nostra_ticket_events_v153").select("id,title,location,starts_at,sales_open").gte("starts_at",start.toISOString()).lte("starts_at",end.toISOString()).order("starts_at"),
    (supabase as any).from("catalog_vehicles").select("id,brand,model,images,price").eq("showroom_visible",true).eq("published",true).limit(8),
    getNewsV155(false), getBannersV155(false)
  ]);
  return {events:events.data??[],ticketEvents:tickets.data??[],showroom:(showroom.data??[]).map((r:any)=>({...r,imageUrl:firstImage(r.images)})),news:news.slice(0,4),banners:banners.slice(0,3)};
}

function monthKey(date:string){const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
export async function getDirectionStatsV155() {
  const supabase=await createClient(); const since=new Date(); since.setMonth(since.getMonth()-11); since.setDate(1); since.setHours(0,0,0,0);
  const [orders,tickets,rentals,profiles,refunds]=await Promise.all([
    (supabase as any).from("orders").select("total,status,created_at").gte("created_at",since.toISOString()),
    (supabase as any).from("nostra_ticket_orders_v153").select("total,status,purchased_at").gte("purchased_at",since.toISOString()),
    (supabase as any).from("motors_rental_bookings_v155").select("total_amount,status,created_at").gte("created_at",since.toISOString()),
    (supabase as any).from("member_profiles").select("created_at").gte("created_at",since.toISOString()),
    (supabase as any).from("nostra_refunds_v155").select("amount,status,created_at").gte("created_at",since.toISOString())
  ]);
  const months:Array<{key:string,label:string,orders:number,tickets:number,rentals:number,citizens:number,refunds:number}> = [];
  for(let i=11;i>=0;i--){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i); const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; months.push({key,label:d.toLocaleDateString("fr-FR",{month:"short"}),orders:0,tickets:0,rentals:0,citizens:0,refunds:0});}
  const map=new Map(months.map(m=>[m.key,m]));
  for(const r of orders.data??[]) if(!["cancelled"].includes(s(r.status))) {const m=map.get(monthKey(s(r.created_at))); if(m)m.orders+=n(r.total);}
  for(const r of tickets.data??[]) if(!["cancelled","refunded"].includes(s(r.status))) {const m=map.get(monthKey(s(r.purchased_at))); if(m)m.tickets+=n(r.total);}
  for(const r of rentals.data??[]) if(!["cancelled","rejected"].includes(s(r.status))) {const m=map.get(monthKey(s(r.created_at))); if(m)m.rentals+=n(r.total_amount);}
  for(const r of profiles.data??[]) {const m=map.get(monthKey(s(r.created_at))); if(m)m.citizens+=1;}
  for(const r of refunds.data??[]) if(["approved","paid"].includes(s(r.status))) {const m=map.get(monthKey(s(r.created_at))); if(m)m.refunds+=n(r.amount);}
  return {months,totals:{orders:months.reduce((a,m)=>a+m.orders,0),tickets:months.reduce((a,m)=>a+m.tickets,0),rentals:months.reduce((a,m)=>a+m.rentals,0),citizens:months.reduce((a,m)=>a+m.citizens,0),refunds:months.reduce((a,m)=>a+m.refunds,0)}};
}

export async function getTrashV155() { const supabase=await createClient(); const {data,error}=await (supabase as any).from("nostra_trash_v155").select("*").is("restored_at",null).order("deleted_at",{ascending:false}); return error?[]:(data??[]); }
