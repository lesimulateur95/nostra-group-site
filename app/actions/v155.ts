"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import {
  creditCitizenGameMoney,
  debitCitizenGameMoney,
  refundCitizenGameMoney,
} from "@/lib/game-bank/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parisLocalInputToIso } from "@/lib/v155/paris-datetime";

const text=(v:FormDataEntryValue|null,max=4000)=>typeof v==="string"?v.trim().slice(0,max):"";
const num=(v:FormDataEntryValue|null,fallback=0)=>{const x=Number(text(v,80).replace(/\s/g,"").replace(",","."));return Number.isFinite(x)?x:fallback;};
const int=(v:FormDataEntryValue|null,fallback=0)=>{const x=Number.parseInt(text(v,40),10);return Number.isFinite(x)?x:fallback;};
const nullableDate=(v:FormDataEntryValue|null)=>{const raw=text(v,50);return raw?parisLocalInputToIso(raw):null;};
const validPhoneV1572=(value:string)=>value.length>=3&&value.length<=40&&/^[0-9+().\s-]+$/.test(value);

async function manager(){const supabase=await createClient();const {data}=await supabase.auth.getUser();if(!data.user)redirect("/");const roles=await getUserRoleKeys(data.user);if(!roles.includes("manager"))redirect("/accueil");return{supabase,user:data.user};}
async function motorsStaff(){const supabase=await createClient();const {data}=await supabase.auth.getUser();if(!data.user)redirect("/");const roles=await getUserRoleKeys(data.user);if(!roles.some(r=>["manager","employee","commercial"].includes(r)))redirect("/accueil");return{supabase,user:data.user};}
async function currentUser(){const supabase=await createClient();const {data}=await supabase.auth.getUser();if(!data.user)redirect("/");return{supabase,user:data.user};}
async function audit(supabase:any,userId:string,action:string,entity:string,id:string|null,summary:string,newData?:unknown){await supabase.from("nostra_audit_log_v155").insert({actor_user_id:userId,action,entity_type:entity,entity_id:id,summary,new_data:newData??null});}

type RentalDepositDebitV157 = { column: string; label?: string; amount: number };

function rentalDepositDebitsV157(value: unknown): RentalDepositDebitV157[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const column = typeof row.column === "string" ? row.column : "";
    const label = typeof row.label === "string" ? row.label : undefined;
    const amount = Math.max(0, Math.trunc(Number(row.amount)));
    if (!column || !Number.isSafeInteger(amount) || amount <= 0) return [];
    return [{ column, label, amount }];
  });
}

function partialRentalRefundV157(
  debits: RentalDepositDebitV157[],
  requestedAmount: number,
): Array<{ column: string; amount: number }> {
  let remaining = Math.max(0, Math.trunc(requestedAmount));
  const result: Array<{ column: string; amount: number }> = [];
  for (const debit of debits) {
    if (remaining <= 0) break;
    const amount = Math.min(debit.amount, remaining);
    if (amount > 0) result.push({ column: debit.column, amount });
    remaining -= amount;
  }
  return result;
}

async function steamIdForUserV157(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await (admin as any)
    .from("member_profiles")
    .select("steam_id")
    .eq("user_id", userId)
    .maybeSingle();
  return typeof data?.steam_id === "string" && data.steam_id.trim()
    ? data.steam_id.trim()
    : null;
}

async function refundRentalDepositV157({
  admin,
  booking,
  retainedAmount,
}: {
  admin: ReturnType<typeof createAdminClient>;
  booking: any;
  retainedAmount: number;
}) {
  const deposit = Math.max(0, Math.trunc(Number(booking.deposit_amount ?? 0)));
  const retained = Math.max(0, Math.min(deposit, Math.trunc(retainedAmount)));
  const refundAmount = Math.max(0, deposit - retained);

  if (String(booking.deposit_status ?? "not_paid") !== "paid") {
    return { ok: true as const, refundAmount: 0, retained };
  }

  const steamId = await steamIdForUserV157(admin, String(booking.user_id));
  if (!steamId) return { ok: false as const, reason: "steam" };

  const now = new Date().toISOString();
  const { data: locked } = await (admin as any)
    .from("motors_rental_bookings_v155")
    .update({ deposit_status: "refund_processing", updated_at: now })
    .eq("id", booking.id)
    .eq("deposit_status", "paid")
    .select("id")
    .maybeSingle();
  if (!locked) return { ok: false as const, reason: "deposit-state" };

  if (refundAmount > 0) {
    const originalDebits = rentalDepositDebitsV157(booking.deposit_payment_details);
    const refundDebits = partialRentalRefundV157(originalDebits, refundAmount);
    const refundTotal = refundDebits.reduce((sum, row) => sum + row.amount, 0);
    if (refundTotal !== refundAmount || !(await refundCitizenGameMoney(steamId, refundDebits))) {
      await (admin as any)
        .from("motors_rental_bookings_v155")
        .update({ deposit_status: "paid", updated_at: new Date().toISOString() })
        .eq("id", booking.id)
        .eq("deposit_status", "refund_processing");
      return { ok: false as const, reason: "deposit-refund" };
    }
  }

  const finalStatus = retained <= 0
    ? "refunded"
    : refundAmount > 0
      ? "partially_refunded"
      : "retained";
  const reference = `RENT-DEPOSIT-${Date.now()}`;
  await (admin as any)
    .from("motors_rental_bookings_v155")
    .update({
      deposit_status: finalStatus,
      deposit_retained_amount: retained,
      deposit_refunded_at: refundAmount > 0 ? new Date().toISOString() : null,
      deposit_refund_reference: reference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (refundAmount > 0) {
    await (admin as any).from("nostra_wallet_ledger_v155").upsert(
      {
        user_id: booking.user_id,
        entry_type: "rental_deposit_refund",
        label: `Restitution caution location · ${booking.rental_number}`,
        amount_rp: refundAmount,
        source_type: "rental_deposit",
        source_id: String(booking.id),
        metadata: { retained_amount: retained, reference },
      },
      { onConflict: "user_id,source_type,source_id,entry_type" },
    );
  }

  await (admin as any).from("user_notifications").insert({
    user_id: booking.user_id,
    notification_type: "rental_deposit",
    title: retained > 0 ? "Caution de location régularisée" : "Caution de location restituée",
    message: retained > 0
      ? `${refundAmount.toLocaleString("fr-FR")} € ont été restitués. ${retained.toLocaleString("fr-FR")} € ont été retenus sur la caution.`
      : `La caution de ${refundAmount.toLocaleString("fr-FR")} € a été restituée après le retour du véhicule.`,
    target_url: "/profil/locations",
    source_type: "rental_deposit",
    source_id: String(booking.id),
    priority: "important",
    category: "motors",
  });

  return { ok: true as const, refundAmount, retained };
}

async function refundRentalFullPaymentV157({
  admin,
  booking,
}: {
  admin: ReturnType<typeof createAdminClient>;
  booking: any;
}) {
  const currentStatus=String(booking.deposit_status??"not_paid");
  if(currentStatus!=="paid") return {ok:true as const,refundAmount:0};
  const steamId=await steamIdForUserV157(admin,String(booking.user_id));
  if(!steamId) return {ok:false as const,reason:"steam"};
  const paymentDebits=rentalDepositDebitsV157(booking.deposit_payment_details);
  const totalPaid=paymentDebits.reduce((sum,row)=>sum+row.amount,0);
  if(totalPaid<=0) return {ok:false as const,reason:"payment-refund"};
  const now=new Date().toISOString();
  const {data:locked}=await (admin as any).from("motors_rental_bookings_v155")
    .update({deposit_status:"refund_processing",updated_at:now})
    .eq("id",booking.id).eq("deposit_status","paid").select("id").maybeSingle();
  if(!locked) return {ok:false as const,reason:"deposit-state"};
  const ok=await refundCitizenGameMoney(steamId,paymentDebits);
  if(!ok){
    await (admin as any).from("motors_rental_bookings_v155")
      .update({deposit_status:"paid",updated_at:new Date().toISOString()})
      .eq("id",booking.id).eq("deposit_status","refund_processing");
    return {ok:false as const,reason:"payment-refund"};
  }
  const reference=`RENT-CANCEL-${Date.now()}`;
  await (admin as any).from("motors_rental_bookings_v155").update({
    deposit_status:"refunded",
    deposit_retained_amount:0,
    deposit_refunded_at:new Date().toISOString(),
    deposit_refund_reference:reference,
    updated_at:new Date().toISOString(),
  }).eq("id",booking.id);
  await (admin as any).from("nostra_wallet_ledger_v155").upsert({
    user_id:booking.user_id,
    entry_type:"rental_cancellation_refund",
    label:`Remboursement annulation location · ${booking.rental_number}`,
    amount_rp:totalPaid,
    source_type:"rental",
    source_id:String(booking.id),
    metadata:{reference,reason:"cancelled_or_rejected"},
  },{onConflict:"user_id,source_type,source_id,entry_type"});
  await (admin as any).from("user_notifications").insert({
    user_id:booking.user_id,
    notification_type:"refund",
    title:"Location remboursée",
    message:`${totalPaid.toLocaleString("fr-FR")} € ont été recrédités après l'annulation de la location.`,
    target_url:"/profil/locations",
    source_type:"rental",
    source_id:String(booking.id),
    priority:"important",
    category:"motors",
  });
  return {ok:true as const,refundAmount:totalPaid};
}

export async function createRentalRequestV155(formData:FormData){
  const {user}=await currentUser();
  const vehicleId=int(formData.get("vehicle_id"));
  const renterPhone=text(formData.get("renter_phone"),40);
  const start=text(formData.get("start_date"),20);
  const end=text(formData.get("end_date"),20);
  if(!validPhoneV1572(renterPhone))redirect(`/motors/location/${vehicleId}?error=phone`);
  if(!vehicleId||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(start)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(end))redirect(`/motors/location/${vehicleId}?error=dates`);

  const startDate=new Date(`${start}T00:00:00Z`);
  const endDate=new Date(`${end}T00:00:00Z`);
  const today=new Date(); today.setUTCHours(0,0,0,0);
  if(Number.isNaN(startDate.getTime())||Number.isNaN(endDate.getTime())||endDate<startDate||startDate<today)redirect(`/motors/location/${vehicleId}?error=dates`);

  const admin=createAdminClient();
  const [{data:vehicle},{data:setting},{data:stockState},{data:profile}] = await Promise.all([
    (admin as any).from("catalog_vehicles").select("id,brand,model,price,stock_quantity,published,catalog_type").eq("id",vehicleId).maybeSingle(),
    (admin as any).from("motors_rental_settings_v155").select("*").eq("vehicle_id",vehicleId).eq("active",true).maybeSingle(),
    (admin as any).from("motors_vehicle_stock_v155").select("operational_status").eq("vehicle_id",vehicleId).maybeSingle(),
    (admin as any).from("member_profiles").select("rp_first_name,rp_last_name").eq("user_id",user.id).maybeSingle(),
  ]);
  const renterFirstName=typeof profile?.rp_first_name==="string"?profile.rp_first_name.trim():"";
  const renterLastName=typeof profile?.rp_last_name==="string"?profile.rp_last_name.trim():"";
  if(renterFirstName.length<2||renterLastName.length<2)redirect(`/motors/location/${vehicleId}?error=profile`);
  if(!vehicle||vehicle.published!==true||vehicle.catalog_type!=="concession")redirect(`/motors/location/${vehicleId}?error=vehicle`);
  if(!setting||["workshop","unavailable"].includes(String(stockState?.operational_status??"")))redirect(`/motors/location/${vehicleId}?error=unavailable`);

  const days=Math.floor((endDate.getTime()-startDate.getTime())/86400000)+1;
  const minDays=Math.max(1,Number(setting.min_days??1));
  const maxDays=Math.max(minDays,Number(setting.max_days??30));
  if(days<minDays||days>maxDays)redirect(`/motors/location/${vehicleId}?error=duration`);

  const {count:overlap}=await (admin as any)
    .from("motors_rental_bookings_v155")
    .select("id",{count:"exact",head:true})
    .eq("vehicle_id",vehicleId)
    .in("status",["pending","confirmed","ready","active"])
    .lte("start_date",end)
    .gte("end_date",start);
  const stock=Math.max(0,Math.trunc(Number(vehicle.stock_quantity??0)));
  if(stock<=0||Number(overlap??0)>=stock)redirect(`/motors/location/${vehicleId}?error=unavailable`);

  const steamId=await steamIdForUserV157(admin,user.id);
  if(!steamId)redirect(`/motors/location/${vehicleId}?error=steam`);

  const dailyRate=Math.max(0,Number(setting.daily_rate??0));
  const rentalTotal=Math.round(dailyRate*days*100)/100;
  const deposit=Math.max(1,Math.round(Number(vehicle.price??0)*0.20));
  const amountToPay=Math.max(1,Math.round(rentalTotal+deposit));
  const debit=await debitCitizenGameMoney(steamId,amountToPay);
  if(debit.status!=="paid"){
    const error=debit.status==="insufficient_funds"?"payment-funds":debit.status==="not_found"?"steam":"payment-bank";
    redirect(`/motors/location/${vehicleId}?error=${error}`);
  }

  const rentalNumber=`NRL-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase()}`;
  const now=new Date().toISOString();
  const {data:booking,error}=await (admin as any).from("motors_rental_bookings_v155").insert({
    user_id:user.id,
    vehicle_id:vehicleId,
    rental_number:rentalNumber,
    start_date:start,
    end_date:end,
    days,
    daily_rate:dailyRate,
    deposit_amount:deposit,
    total_amount:rentalTotal,
    status:"pending",
    pickup_location:"Nostra Motors",
    renter_first_name:renterFirstName,
    renter_last_name:renterLastName,
    renter_phone:renterPhone,
    deposit_status:"paid",
    deposit_payment_details:debit.debits,
    deposit_paid_at:now,
    deposit_held_at:now,
  }).select("id").single();

  if(error||!booking){
    await refundCitizenGameMoney(steamId,debit.debits);
    redirect(`/motors/location/${vehicleId}?error=save`);
  }

  await (admin as any).from("nostra_wallet_ledger_v155").upsert({
    user_id:user.id,
    entry_type:"rental_payment",
    label:`Location + caution · ${vehicle.brand} ${vehicle.model}`,
    amount_rp:-amountToPay,
    source_type:"rental",
    source_id:String(booking.id),
    metadata:{rental_number:rentalNumber,vehicle_id:vehicleId,rental_amount:rentalTotal,deposit_amount:deposit,deposit_rate_percent:20,total_paid:amountToPay},
  },{onConflict:"user_id,source_type,source_id,entry_type"});
  await audit(admin as any,user.id,"create","motors_rental_bookings_v155",String(booking.id),`Location payée avec caution 20 % · ${rentalNumber}`,{vehicle_id:vehicleId,renter_name:`${renterFirstName} ${renterLastName}`.trim(),renter_phone:renterPhone,rental_amount:rentalTotal,deposit_amount:deposit,total_paid:amountToPay,deposit_status:"paid"});
  await (admin as any).from("user_notifications").insert({
    user_id:user.id,
    notification_type:"rental_deposit",
    title:"Location payée · caution encaissée",
    message:`Paiement reçu : ${rentalTotal.toLocaleString("fr-FR")} € de location + ${deposit.toLocaleString("fr-FR")} € de caution (20 %). La caution pourra être rendue par Nostra Motors après le retour du véhicule.`,
    target_url:"/profil/locations",
    source_type:"rental_deposit",
    source_id:String(booking.id),
    priority:"important",
    category:"motors",
  });

  revalidatePath("/profil/locations");
  revalidatePath("/dashboard/location-motors");
  redirect(`/profil/locations?created=${encodeURIComponent(String(booking.id))}`);
}

export async function cancelRentalV155(formData:FormData){
  const {user}=await currentUser();
  const id=text(formData.get("id"),80);
  if(!id)redirect("/profil/locations?error=invalid");
  const admin=createAdminClient();
  const {data:booking}=await (admin as any).from("motors_rental_bookings_v155").select("*").eq("id",id).eq("user_id",user.id).eq("status","pending").maybeSingle();
  if(!booking)redirect("/profil/locations?error=cancel");

  const refund=await refundRentalFullPaymentV157({admin,booking});
  if(!refund.ok)redirect(`/profil/locations?error=${refund.reason}`);
  const {error}=await (admin as any).from("motors_rental_bookings_v155").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",id).eq("user_id",user.id).eq("status","pending");
  if(error)redirect("/profil/locations?error=cancel");
  await audit(admin as any,user.id,"cancel","motors_rental_bookings_v155",id,"Location annulée · paiement intégral remboursé",{refund_amount:refund.refundAmount});
  revalidatePath("/profil/locations");
  revalidatePath("/dashboard/location-motors");
  redirect("/profil/locations?cancelled=1");
}

export async function saveRentalSettingV155(formData:FormData){
  const {supabase,user}=await motorsStaff();
  const vehicleId=int(formData.get("vehicle_id"));
  if(!vehicleId)redirect("/dashboard/location-motors?error=vehicle");
  const {data:vehicle}=await (supabase as any).from("catalog_vehicles").select("price").eq("id",vehicleId).maybeSingle();
  const depositAmount=Math.max(0,Math.round(Number(vehicle?.price??0)*0.20));
  const minDays=Math.max(1,int(formData.get("min_days"),1));
  const maxDays=Math.max(minDays,int(formData.get("max_days"),30));
  const payload={vehicle_id:vehicleId,daily_rate:Math.max(0,num(formData.get("daily_rate"))),deposit_amount:depositAmount,min_days:minDays,max_days:maxDays,mileage_included_per_day:Math.max(0,int(formData.get("mileage_included_per_day"),200)),extra_km_price:Math.max(0,num(formData.get("extra_km_price"))),active:formData.get("active")==="on",updated_at:new Date().toISOString(),updated_by:user.id};
  const {error}=await (supabase as any).from("motors_rental_settings_v155").upsert(payload,{onConflict:"vehicle_id"});
  if(error)redirect("/dashboard/location-motors?error=save");
  revalidatePath("/motors/catalogue/location");
  revalidatePath("/dashboard/location-motors");
  redirect("/dashboard/location-motors?saved=1");
}

export async function updateRentalBookingV155(formData:FormData){
  const {user}=await motorsStaff();
  const id=text(formData.get("id"),80);
  const status=text(formData.get("status"),30);
  if(!id||!["pending","confirmed","ready","active","returned","cancelled","rejected"].includes(status))redirect("/dashboard/location-motors?error=booking");
  const admin=createAdminClient();
  const {data:booking}=await (admin as any).from("motors_rental_bookings_v155").select("*").eq("id",id).maybeSingle();
  if(!booking)redirect("/dashboard/location-motors?error=booking");

  if(["cancelled","rejected"].includes(status) && String(booking.deposit_status)==="paid"){
    const refund=await refundRentalFullPaymentV157({admin,booking});
    if(!refund.ok)redirect(`/dashboard/location-motors?error=${refund.reason}`);
  }

  const payload:any={status,staff_notes:text(formData.get("staff_notes"),2000)||null,damage_notes:text(formData.get("damage_notes"),2000)||null,condition_out:text(formData.get("condition_out"),1000)||null,condition_in:text(formData.get("condition_in"),1000)||null,updated_at:new Date().toISOString(),updated_by:user.id};
  const mo=int(formData.get("mileage_out"),-1);const mi=int(formData.get("mileage_in"),-1);if(mo>=0)payload.mileage_out=mo;if(mi>=0)payload.mileage_in=mi;if(status==="active"&&!booking.picked_up_at)payload.picked_up_at=new Date().toISOString();if(status==="returned"&&!booking.returned_at)payload.returned_at=new Date().toISOString();
  const {error}=await (admin as any).from("motors_rental_bookings_v155").update(payload).eq("id",id);
  if(error)redirect("/dashboard/location-motors?error=booking");
  await audit(admin as any,user.id,"update","motors_rental_bookings_v155",id,`Dossier location mis à jour · ${status}`,{status});
  revalidatePath("/dashboard/location-motors");
  revalidatePath("/profil/locations");
  redirect("/dashboard/location-motors?booking_saved=1");
}

export async function returnRentalDepositV157(formData:FormData){
  const {user}=await motorsStaff();
  const id=text(formData.get("id"),80);
  if(!id)redirect("/dashboard/location-motors?error=booking");
  const admin=createAdminClient();
  const {data:booking}=await (admin as any).from("motors_rental_bookings_v155").select("*").eq("id",id).maybeSingle();
  if(!booking||String(booking.status)!=="returned")redirect("/dashboard/location-motors?error=deposit-return-status");
  if(String(booking.deposit_status)!=="paid")redirect("/dashboard/location-motors?error=deposit-state");
  const refund=await refundRentalDepositV157({admin,booking,retainedAmount:0});
  if(!refund.ok)redirect(`/dashboard/location-motors?error=${refund.reason}`);
  await audit(admin as any,user.id,"refund","motors_rental_bookings_v155",id,"Caution de location rendue au citoyen",{refund_amount:refund.refundAmount});
  revalidatePath("/dashboard/location-motors");
  revalidatePath("/profil/locations");
  redirect("/dashboard/location-motors?deposit_refunded=1");
}

export async function saveStockStateV155(formData:FormData){const {supabase,user}=await motorsStaff();const vehicleId=int(formData.get("vehicle_id"));if(!vehicleId)redirect("/dashboard/stock-reel?error=vehicle");const status=text(formData.get("operational_status"),30);if(!["available","reserved","rented","workshop","unavailable"].includes(status))redirect("/dashboard/stock-reel?error=status");await (supabase as any).from("motors_vehicle_stock_v155").upsert({vehicle_id:vehicleId,operational_status:status,physical_location:text(formData.get("physical_location"),160)||"Concession Nostra Motors",minimum_stock:Math.max(0,int(formData.get("minimum_stock"),1)),notes:text(formData.get("notes"),1200)||null,updated_at:new Date().toISOString(),updated_by:user.id},{onConflict:"vehicle_id"});revalidatePath("/dashboard/stock-reel");redirect("/dashboard/stock-reel?saved=1");}

export async function updateLoyaltyTierV155(formData:FormData){const {supabase,user}=await manager();const code=text(formData.get("code"),80);if(!code)redirect("/dashboard/fidelite?error=tier");const benefits=text(formData.get("benefits"),4000).split("\n").map(x=>x.trim()).filter(Boolean).slice(0,20);const payload:any={label:text(formData.get("label"),120),catalog_discount_percent:Math.max(0,num(formData.get("catalog_discount_percent"))),plate_discount_percent:Math.max(0,num(formData.get("plate_discount_percent"))),min_points:Math.max(0,int(formData.get("min_points"))),public_description:text(formData.get("public_description"),1000)||null,benefits,active:formData.get("active")==="on"};const {error}=await (supabase as any).from("loyalty_tiers").update(payload).eq("code",code);if(error)redirect(`/dashboard/fidelite?error=${encodeURIComponent(error.message)}`);await audit(supabase,user.id,"update","loyalty_tiers",code,`Avantages fidélité ${code} modifiés`,payload);revalidatePath("/dashboard/fidelite");revalidatePath("/profil/fidelite");revalidatePath("/motors/fidelite");redirect("/dashboard/fidelite?tier_saved=1");}

export async function applyReferralV155(formData:FormData){const {supabase}=await currentUser();const code=text(formData.get("code"),40);const {error}=await (supabase as any).rpc("nostra_apply_referral_v155",{p_code:code});if(error)redirect(`/profil/parrainage?error=${encodeURIComponent(error.message)}`);revalidatePath("/profil/parrainage");revalidatePath("/profil/wallet");redirect("/profil/parrainage?success=1");}

export async function savePrivateSaleV155(formData:FormData){const {supabase,user}=await manager();const id=text(formData.get("id"),80);const payload={vehicle_id:int(formData.get("vehicle_id")),title:text(formData.get("title"),180),description:text(formData.get("description"),2500),min_loyalty_points:Math.max(0,int(formData.get("min_loyalty_points"))),starts_at:nullableDate(formData.get("starts_at")),ends_at:nullableDate(formData.get("ends_at")),enabled:formData.get("enabled")==="on",stock_limit:int(formData.get("stock_limit"))>0?int(formData.get("stock_limit")):null,updated_at:new Date().toISOString()};if(!payload.vehicle_id||!payload.title)redirect("/dashboard/ventes-privees?error=invalid");let error;if(id){({error}=await (supabase as any).from("nostra_private_sales_v155").update(payload).eq("id",id));}else{({error}=await (supabase as any).from("nostra_private_sales_v155").insert({...payload,created_by:user.id}));}if(error)redirect("/dashboard/ventes-privees?error=save");revalidatePath("/ventes-privees");revalidatePath("/dashboard/ventes-privees");redirect("/dashboard/ventes-privees?saved=1");}

export async function joinVehicleWaitlistV155(formData:FormData){const {supabase,user}=await currentUser();const vehicleId=int(formData.get("vehicle_id"));const reason=text(formData.get("reason"),30)||"stock";if(!vehicleId||!["stock","rental","private_sale"].includes(reason))redirect("/profil/liste-attente?error=invalid");await (supabase as any).from("nostra_vehicle_waitlist_v155").upsert({user_id:user.id,vehicle_id:vehicleId,reason},{onConflict:"user_id,vehicle_id,reason"});revalidatePath("/profil/liste-attente");redirect("/profil/liste-attente?added=1");}
export async function leaveVehicleWaitlistV155(formData:FormData){const {supabase,user}=await currentUser();const id=int(formData.get("id"));if(id)await (supabase as any).from("nostra_vehicle_waitlist_v155").delete().eq("id",id).eq("user_id",user.id);revalidatePath("/profil/liste-attente");redirect("/profil/liste-attente?removed=1");}

export async function createRefundV155(formData:FormData){const {supabase,user}=await manager();const userId=text(formData.get("user_id"),80);const amount=Math.max(0,num(formData.get("amount")));const reason=text(formData.get("reason"),2000);if(!userId||amount<=0||!reason)redirect("/dashboard/remboursements?error=invalid");const {error}=await (supabase as any).from("nostra_refunds_v155").insert({user_id:userId,source_type:text(formData.get("source_type"),40)||"manual",source_id:text(formData.get("source_id"),120)||null,refund_kind:text(formData.get("refund_kind"),20)==="total"?"total":"partial",amount,reason,status:"pending",created_by:user.id});if(error)redirect("/dashboard/remboursements?error=save");revalidatePath("/dashboard/remboursements");redirect("/dashboard/remboursements?created=1");}

export async function processRefundV155(formData:FormData){const {supabase,user}=await manager();const id=text(formData.get("id"),80);const decision=text(formData.get("decision"),20);if(!id||!["approve","pay","reject"].includes(decision))redirect("/dashboard/remboursements?error=invalid");const {data:refund}=await (supabase as any).from("nostra_refunds_v155").select("*").eq("id",id).maybeSingle();if(!refund)redirect("/dashboard/remboursements?error=missing");if(decision==="reject"){if(refund.status!=="pending")redirect("/dashboard/remboursements?error=status");await (supabase as any).from("nostra_refunds_v155").update({status:"rejected",approved_by:user.id,approved_at:new Date().toISOString()}).eq("id",id);revalidatePath("/dashboard/remboursements");redirect("/dashboard/remboursements?rejected=1");}if(decision==="approve"){if(refund.status!=="pending")redirect("/dashboard/remboursements?error=status");await (supabase as any).from("nostra_refunds_v155").update({status:"approved",approved_by:user.id,approved_at:new Date().toISOString()}).eq("id",id);revalidatePath("/dashboard/remboursements");redirect("/dashboard/remboursements?approved=1");}if(refund.status!=="approved")redirect("/dashboard/remboursements?error=status");if(!refund.user_id)redirect("/dashboard/remboursements?error=user");const {data:profile}=await (supabase as any).from("member_profiles").select("steam_id").eq("user_id",refund.user_id).maybeSingle();const steamId=typeof profile?.steam_id==="string"?profile.steam_id:null;if(!steamId)redirect("/dashboard/remboursements?error=steam");const result=await creditCitizenGameMoney(steamId,Math.trunc(Number(refund.amount)));if(result.status!=="credited")redirect(`/dashboard/remboursements?error=${result.status}`);await (supabase as any).from("nostra_refunds_v155").update({status:"paid",paid_at:new Date().toISOString(),payment_reference:`GAME-${Date.now()}`}).eq("id",id);await (supabase as any).from("nostra_wallet_ledger_v155").insert({user_id:refund.user_id,entry_type:"refund",label:`Remboursement Nostra · ${refund.reason}`,amount_rp:Number(refund.amount),source_type:"refund",source_id:id});await (supabase as any).from("user_notifications").insert({user_id:refund.user_id,notification_type:"refund",title:"Remboursement effectué",message:`Un remboursement de ${Number(refund.amount).toLocaleString("fr-FR")} $RP a été crédité.`,target_url:"/profil/wallet",source_type:"refund",source_id:id,priority:"important",category:"general"});revalidatePath("/dashboard/remboursements");redirect("/dashboard/remboursements?paid=1");}

async function trashEntity(supabase:any,userId:string,table:string,id:string,title:string){const {data,error}=await supabase.from(table).select("*").eq("id",id).maybeSingle();if(error||!data)throw new Error("missing");await supabase.from("nostra_trash_v155").insert({entity_type:table,entity_id:id,title,payload:data,deleted_by:userId});await supabase.from(table).delete().eq("id",id);}
export async function trashContentV155(formData:FormData){const {supabase,user}=await manager();const table=text(formData.get("entity_type"),80);const id=text(formData.get("id"),80);const title=text(formData.get("title"),200)||"Élément supprimé";if(!["nostra_news_v155","nostra_banners_v155","nostra_announcements_v155","nostra_private_sales_v155"].includes(table)||!id)redirect("/dashboard/corbeille?error=invalid");try{await trashEntity(supabase,user.id,table,id,title);}catch{redirect("/dashboard/corbeille?error=delete");}revalidatePath("/dashboard/corbeille");revalidatePath("/actualites");if(table==="nostra_banners_v155"||table==="nostra_announcements_v155")revalidatePath("/","layout");redirect("/dashboard/corbeille?trashed=1");}
export async function restoreTrashV155(formData:FormData){const {supabase,user}=await manager();const trashId=text(formData.get("id"),80);const {data:item}=await (supabase as any).from("nostra_trash_v155").select("*").eq("id",trashId).is("restored_at",null).maybeSingle();if(!item)redirect("/dashboard/corbeille?error=missing");const allowed=["nostra_news_v155","nostra_banners_v155","nostra_announcements_v155","nostra_private_sales_v155"];if(!allowed.includes(item.entity_type))redirect("/dashboard/corbeille?error=unsupported");const {error}=await (supabase as any).from(item.entity_type).insert(item.payload);if(error)redirect("/dashboard/corbeille?error=restore");await (supabase as any).from("nostra_trash_v155").update({restored_at:new Date().toISOString()}).eq("id",trashId);await audit(supabase,user.id,"restore",item.entity_type,item.entity_id,`Restauration depuis la corbeille : ${item.title}`);revalidatePath("/dashboard/corbeille");if(item.entity_type==="nostra_banners_v155"||item.entity_type==="nostra_announcements_v155")revalidatePath("/","layout");redirect("/dashboard/corbeille?restored=1");}

export async function saveNewsV155(formData:FormData){const {supabase,user}=await manager();const id=text(formData.get("id"),80);const payload={pole:text(formData.get("pole"),30)||"group",title:text(formData.get("title"),200),excerpt:text(formData.get("excerpt"),600),content:text(formData.get("content"),6000),image_url:text(formData.get("image_url"),1000)||null,published:formData.get("published")==="on",featured:formData.get("featured")==="on",starts_at:nullableDate(formData.get("starts_at")),ends_at:nullableDate(formData.get("ends_at")),updated_at:new Date().toISOString()};if(!payload.title)redirect("/dashboard/communication?error=news");let error;if(id){({error}=await (supabase as any).from("nostra_news_v155").update(payload).eq("id",id));}else{({error}=await (supabase as any).from("nostra_news_v155").insert({...payload,created_by:user.id}));}if(error)redirect("/dashboard/communication?error=news-save");revalidatePath("/actualites");revalidatePath("/aujourdhui");redirect("/dashboard/communication?saved=news");}
export async function deleteBannerV155(formData:FormData){const {supabase,user}=await manager();const id=text(formData.get("id"),80);if(!id)redirect("/dashboard/communication?error=banner-delete-invalid");const {data:banner}=await (supabase as any).from("nostra_banners_v155").select("id,title").eq("id",id).maybeSingle();if(!banner)redirect("/dashboard/communication?error=banner-delete-missing");const {error}=await (supabase as any).from("nostra_banners_v155").delete().eq("id",id);if(error)redirect("/dashboard/communication?error=banner-delete");await audit(supabase,user.id,"delete","nostra_banners_v155",id,`Suppression définitive de la bannière : ${String(banner.title??"Bannière")}`);revalidatePath("/dashboard/communication");revalidatePath("/","layout");redirect("/dashboard/communication?deleted=banner");}
export async function saveBannerV155(formData:FormData){const {supabase,user}=await manager();const id=text(formData.get("id"),80);const payload={pole:text(formData.get("pole"),30)||"group",title:text(formData.get("title"),200),message:text(formData.get("message"),1500),cta_label:text(formData.get("cta_label"),80)||null,cta_url:text(formData.get("cta_url"),500)||null,starts_at:nullableDate(formData.get("starts_at")),ends_at:nullableDate(formData.get("ends_at")),active:formData.get("active")==="on",priority:int(formData.get("priority")),updated_at:new Date().toISOString()};if(!payload.title)redirect("/dashboard/communication?error=banner");let error;if(id){({error}=await (supabase as any).from("nostra_banners_v155").update(payload).eq("id",id));}else{({error}=await (supabase as any).from("nostra_banners_v155").insert({...payload,created_by:user.id}));}if(error)redirect("/dashboard/communication?error=banner-save");revalidatePath("/","layout");redirect("/dashboard/communication?saved=banner");}
export async function saveAnnouncementV155(formData:FormData){const {supabase,user}=await manager();const id=text(formData.get("id"),80);const payload={title:text(formData.get("title"),200),message:text(formData.get("message"),2000),severity:text(formData.get("severity"),20)||"important",active:formData.get("active")==="on",dismissible:formData.get("dismissible")==="on",starts_at:nullableDate(formData.get("starts_at")),ends_at:nullableDate(formData.get("ends_at")),updated_at:new Date().toISOString()};if(!payload.title||!payload.message)redirect("/dashboard/communication?error=announcement");let error;if(id){({error}=await (supabase as any).from("nostra_announcements_v155").update(payload).eq("id",id));}else{({error}=await (supabase as any).from("nostra_announcements_v155").insert({...payload,created_by:user.id}));}if(error)redirect("/dashboard/communication?error=announcement-save");revalidatePath("/","layout");redirect("/dashboard/communication?saved=announcement");}

export async function purgeTrashV155(formData:FormData){const {supabase,user}=await manager();const id=text(formData.get("id"),80);if(!id)redirect("/dashboard/corbeille?error=invalid");const {data:item}=await (supabase as any).from("nostra_trash_v155").select("*").eq("id",id).maybeSingle();if(!item)redirect("/dashboard/corbeille?error=missing");await (supabase as any).from("nostra_trash_v155").delete().eq("id",id);await audit(supabase,user.id,"purge","nostra_trash_v155",id,`Suppression définitive : ${item.title}`);revalidatePath("/dashboard/corbeille");redirect("/dashboard/corbeille?purged=1");}
