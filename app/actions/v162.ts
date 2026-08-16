"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const text=(v:FormDataEntryValue|null,max=5000)=>typeof v==="string"?v.trim().slice(0,max):"";
const int=(v:FormDataEntryValue|null)=>{const n=Number.parseInt(text(v,40),10);return Number.isFinite(n)?n:0};
const money=(v:FormDataEntryValue|null)=>{const n=Number(String(v??"").replace(",","."));return Number.isFinite(n)?Math.max(0,n):0};

async function current(){const s=await createClient();const {data}=await s.auth.getUser();if(!data.user)redirect("/");return{s,user:data.user};}
async function staff(required?:string){
  const c=await current();
  const roles=await getUserRoleKeys(c.user);
  if(roles.includes("manager"))return c;
  if(!roles.some(r=>["employee","commercial"].includes(r)))redirect("/accueil");
  if(required){
    const check=await (c.s as any).rpc("nostra_v164_has_permission",{p_permission:required});
    // Tant que V164 n'est pas installée on garde la compatibilité historique.
    if(!check.error){if(check.data===true)return c;redirect("/dashboard");}
  }
  return c;
}
function code(prefix:string){return `${prefix}-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${crypto.randomUUID().replaceAll("-","").slice(0,6).toUpperCase()}`;}
function revalidateV162(){["/motors/atelier","/dashboard/atelier","/dashboard/campagnes","/dashboard/stock-reel","/profil/vip","/dashboard/concierge","/motors/catalogue","/motors/catalogue/poids-lourds","/motors/catalogue/vehicules-exclusifs"].forEach(p=>revalidatePath(p));}

export async function createWorkshopCaseV162(form:FormData){
  const {s,user}=await current();const customerVehicleId=int(form.get("customer_vehicle_id"));
  if(customerVehicleId<=0)redirect("/motors/atelier?error=vehicle");
  const vehicle=await (s as any).from("customer_vehicles").select("id,user_id,vehicle_id,vehicle_name,brand,model,order_id").eq("id",customerVehicleId).eq("user_id",user.id).maybeSingle();
  if(vehicle.error||!vehicle.data)redirect("/motors/atelier?error=vehicle");
  const label=`${textValue(vehicle.data.brand)} ${textValue(vehicle.data.model)}`.trim()||textValue(vehicle.data.vehicle_name,"Véhicule Nostra");
  const {error}=await (s as any).from("motors_workshop_cases_v162").insert({case_number:code("AT"),user_id:user.id,customer_vehicle_id:customerVehicleId,catalog_vehicle_id:vehicle.data.vehicle_id??null,vehicle_label:label,service_type:text(form.get("service_type"),40)||"maintenance",mileage:int(form.get("mileage"))||null,description:text(form.get("description"),5000),requested_date:text(form.get("requested_date"),20)||null,requested_slot:text(form.get("requested_slot"),80)||null});
  if(error)redirect("/motors/atelier?error=save");
  if(vehicle.data.order_id){let unitQuery=(s as any).from("motors_physical_vehicle_units_v162").update({status:"workshop",location:"Atelier Nostra Motors",updated_at:new Date().toISOString()}).eq("order_id",vehicle.data.order_id).eq("status","delivered");if(vehicle.data.vehicle_id)unitQuery=unitQuery.eq("catalog_vehicle_id",vehicle.data.vehicle_id);await unitQuery;}
  revalidateV162();redirect("/motors/atelier?created=1");
}
function textValue(v:unknown,f=""){return typeof v==="string"?v:f;}

export async function updateWorkshopCaseV162(form:FormData){
  const {s,user}=await staff("workshop_manage");const id=int(form.get("id"));if(id<=0)redirect("/dashboard/atelier?error=invalid");
  const status=text(form.get("status"),40);const quoteStatus=text(form.get("quote_status"),30);
  const payload:any={status,quote_status:quoteStatus,assigned_to:text(form.get("assigned_to"),80)||null,diagnosis:text(form.get("diagnosis"),5000)||null,internal_note:text(form.get("internal_note"),5000)||null,requested_date:text(form.get("requested_date"),20)||null,requested_slot:text(form.get("requested_slot"),80)||null,updated_at:new Date().toISOString()};
  const appointment=text(form.get("appointment_at"),60);payload.appointment_at=appointment?new Date(appointment).toISOString():null;if(status==="returned")payload.completed_at=new Date().toISOString();
  const before=await (s as any).from("motors_workshop_cases_v162").select("customer_vehicle_id").eq("id",id).maybeSingle();
  const {error}=await (s as any).from("motors_workshop_cases_v162").update(payload).eq("id",id);if(error)redirect("/dashboard/atelier?error=save");
  try{await (s as any).from("motors_employee_audit_v164").insert({actor_user_id:user.id,action_key:"workshop_case_updated",entity_type:"workshop_case",entity_id:String(id),title:"Dossier Atelier Nostra modifié",details:{status,quote_status:quoteStatus}});}catch{}
  if(before.data?.customer_vehicle_id){const gv=await (s as any).from("customer_vehicles").select("order_id,vehicle_id").eq("id",before.data.customer_vehicle_id).maybeSingle();if(gv.data?.order_id){const inWorkshop=["accepted","vehicle_received","diagnosis","quote_waiting","quote_accepted","in_progress","final_check","ready"].includes(status);let unitQuery=(s as any).from("motors_physical_vehicle_units_v162").update({status:inWorkshop?"workshop":"delivered",location:inWorkshop?"Atelier Nostra Motors":"Chez le client",updated_at:new Date().toISOString()}).eq("order_id",gv.data.order_id);if(gv.data.vehicle_id)unitQuery=unitQuery.eq("catalog_vehicle_id",gv.data.vehicle_id);await unitQuery;}if(status==="returned"){await (s as any).from("customer_vehicle_history").insert({customer_vehicle_id:before.data.customer_vehicle_id,event_type:"workshop",status:"completed",title:"Passage Atelier Nostra Motors",details:text(form.get("diagnosis"),5000)||"Intervention atelier terminée.",created_at:new Date().toISOString()});}}
  revalidateV162();redirect("/dashboard/atelier?updated=1");
}

export async function addWorkshopQuoteLineV162(form:FormData){const {s}=await staff("workshop_manage");const caseId=int(form.get("case_id"));const {error}=await (s as any).from("motors_workshop_quote_lines_v162").insert({case_id:caseId,label:text(form.get("label"),180),quantity:money(form.get("quantity"))||1,unit_price:money(form.get("unit_price"))});if(error)redirect("/dashboard/atelier?error=quote");await (s as any).from("motors_workshop_cases_v162").update({quote_status:"draft",status:"quote_waiting",updated_at:new Date().toISOString()}).eq("id",caseId);revalidateV162();redirect(`/dashboard/atelier?case=${caseId}&quote=1`);}
export async function deleteWorkshopQuoteLineV162(form:FormData){const {s}=await staff("workshop_manage");const id=int(form.get("id"));const caseId=int(form.get("case_id"));await (s as any).from("motors_workshop_quote_lines_v162").delete().eq("id",id);revalidateV162();redirect(`/dashboard/atelier?case=${caseId}`);}
export async function sendWorkshopQuoteV162(form:FormData){const {s}=await staff("workshop_manage");const id=int(form.get("id"));const caseRow=await (s as any).from("motors_workshop_cases_v162").select("user_id,case_number,quote_total").eq("id",id).maybeSingle();await (s as any).from("motors_workshop_cases_v162").update({quote_status:"sent",status:"quote_waiting",updated_at:new Date().toISOString()}).eq("id",id);if(caseRow.data?.user_id){await (s as any).from("user_notifications").insert({user_id:caseRow.data.user_id,notification_type:"general",title:"Devis Atelier Nostra disponible",message:`Le devis ${caseRow.data.case_number??"atelier"} est prêt à être consulté.`,target_url:"/motors/atelier",source_type:"workshop",source_id:String(id),priority:"normal",category:"motors"});}revalidateV162();redirect(`/dashboard/atelier?case=${id}&sent=1`);}
export async function decideWorkshopQuoteV162(form:FormData){const {s}=await current();const id=int(form.get("id"));const decision=text(form.get("decision"),20);const {error}=await (s as any).rpc("nostra_decide_workshop_quote_v162",{p_case_id:id,p_decision:decision});if(error)redirect("/motors/atelier?error=decision");revalidateV162();redirect("/motors/atelier?decision=1");}

export async function saveCampaignV162(form:FormData){
  const {s,user}=await staff();const id=int(form.get("id"));const scope=text(form.get("target_scope"),30)||"all";const type=text(form.get("campaign_type"),30)||"percent";
  const payload:any={name:text(form.get("name"),160),description:text(form.get("description"),1000)||null,badge_text:text(form.get("badge_text"),80)||null,campaign_type:type,discount_value:money(form.get("discount_value")),target_scope:scope,target_catalog_type:scope==="catalog"?text(form.get("target_catalog_type"),40)||null:null,target_brand:scope==="brand"?text(form.get("target_brand"),100)||null:null,target_vehicle_id:scope==="vehicle"?(int(form.get("target_vehicle_id"))||null):null,target_collection_id:scope==="collection"?text(form.get("target_collection_id"),120)||null:null,starts_at:text(form.get("starts_at"),60)?new Date(text(form.get("starts_at"),60)).toISOString():null,ends_at:text(form.get("ends_at"),60)?new Date(text(form.get("ends_at"),60)).toISOString():null,enabled:form.get("enabled")==="on",priority:int(form.get("priority")),updated_at:new Date().toISOString()};
  let result;if(id>0)result=await (s as any).from("motors_campaigns_v162").update(payload).eq("id",id);else result=await (s as any).from("motors_campaigns_v162").insert({...payload,created_by:user.id});if(result.error)redirect("/dashboard/campagnes?error=save");revalidateV162();redirect("/dashboard/campagnes?saved=1");
}
export async function deleteCampaignV162(form:FormData){const {s}=await staff();await (s as any).from("motors_campaigns_v162").delete().eq("id",int(form.get("id")));revalidateV162();redirect("/dashboard/campagnes?deleted=1");}

export async function syncPhysicalStockV162(form:FormData){
  const {s}=await staff("inventory_manage");const vehicleId=int(form.get("vehicle_id"));const v=await (s as any).from("catalog_vehicles").select("id,stock_quantity").eq("id",vehicleId).maybeSingle();if(!v.data)redirect("/dashboard/stock-reel?error=vehicle");
  const units=await (s as any).from("motors_physical_vehicle_units_v162").select("id,status,hold_id,order_id").eq("catalog_vehicle_id",vehicleId);if(units.error)redirect("/dashboard/stock-reel?error=setup");
  const active=(units.data??[]).filter((u:any)=>!["sold","delivered"].includes(String(u.status)));const target=Math.max(0,Number(v.data.stock_quantity)||0);
  if(active.length<target){for(let i=active.length;i<target;i++){await (s as any).from("motors_physical_vehicle_units_v162").insert({unit_code:`NM-${vehicleId}-${crypto.randomUUID().replaceAll("-","").slice(0,7).toUpperCase()}`,catalog_vehicle_id:vehicleId,status:"stock",location:"Stock Nostra Motors"});}}
  if(active.length>target){const removable=active.filter((u:any)=>["stock","arrived","showroom"].includes(String(u.status))&&!u.hold_id&&!u.order_id).slice(0,active.length-target).map((u:any)=>u.id);if(removable.length)await (s as any).from("motors_physical_vehicle_units_v162").delete().in("id",removable);}
  revalidateV162();redirect(`/dashboard/stock-reel?synced=${vehicleId}`);
}
export async function updatePhysicalUnitV162(form:FormData){const {s}=await staff("inventory_manage");const id=int(form.get("id"));const {error}=await (s as any).from("motors_physical_vehicle_units_v162").update({status:text(form.get("status"),40),location:text(form.get("location"),160)||"Stock Nostra Motors",notes:text(form.get("notes"),1000)||null,updated_at:new Date().toISOString()}).eq("id",id);if(error)redirect("/dashboard/stock-reel?error=unit");revalidateV162();redirect("/dashboard/stock-reel?updated=1");}

export async function createConciergeRequestV162(form:FormData){const {s,user}=await current();const {error}=await (s as any).from("motors_concierge_requests_v162").insert({request_number:code("VIP"),user_id:user.id,request_type:text(form.get("request_type"),40)||"rare_vehicle",subject:text(form.get("subject"),180),description:text(form.get("description"),5000),budget:money(form.get("budget"))||null});if(error)redirect("/profil/vip?concierge_error=save");revalidateV162();redirect("/profil/vip?concierge_created=1");}
export async function updateConciergeRequestV162(form:FormData){const {s}=await staff();const id=int(form.get("id"));const status=text(form.get("status"),40);const expires=text(form.get("proposal_expires_at"),60);const before=await (s as any).from("motors_concierge_requests_v162").select("user_id,request_number").eq("id",id).maybeSingle();const {error}=await (s as any).from("motors_concierge_requests_v162").update({status,assigned_to:text(form.get("assigned_to"),80)||null,proposed_vehicle_id:int(form.get("proposed_vehicle_id"))||null,proposed_price:money(form.get("proposed_price"))||null,proposal_message:text(form.get("proposal_message"),3000)||null,proposal_expires_at:expires?new Date(expires).toISOString():null,updated_at:new Date().toISOString()}).eq("id",id);if(error)redirect("/dashboard/concierge?error=save");if(status==="proposal_sent"&&before.data?.user_id){await (s as any).from("user_notifications").insert({user_id:before.data.user_id,notification_type:"general",title:"Nouvelle proposition Concierge Nostra",message:`Une proposition privée est disponible pour ${before.data.request_number??"ta demande"}.`,target_url:"/profil/vip#concierge",source_type:"concierge",source_id:String(id),priority:"normal",category:"motors"});}revalidateV162();redirect(`/dashboard/concierge?request=${id}&saved=1`);}
export async function acceptConciergeOfferV162(form:FormData){const {s}=await current();const id=int(form.get("id"));const {error}=await (s as any).rpc("nostra_accept_concierge_offer_v162",{p_request_id:id});if(error)redirect("/profil/vip?concierge_error=offer");await (s as any).rpc("nostra_apply_active_campaigns_to_my_cart_v162");revalidateV162();revalidatePath("/profil");redirect("/profil?concierge_added=1");}
