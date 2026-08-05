"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";
import type { ConsignmentImageV134 } from "@/lib/vehicle-consignments/data";

const text = (value: FormDataEntryValue | null, max = 5000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: FormDataEntryValue | null) => { const parsed = Number(text(value, 60).replace(/\s|€|%/g, "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; };

async function staff() { const supabase = await createClient(); const { data } = await supabase.auth.getUser(); if (!data.user) redirect("/"); const roles = await getUserRoleKeys(data.user); if (!roles.some((role) => ["manager", "employee", "commercial"].includes(role))) redirect("/accueil"); return { supabase }; }
function refresh() { revalidatePath("/motors/depot-vente"); revalidatePath("/motors/catalogue/vehicules-occasion"); revalidatePath("/profil"); revalidatePath("/dashboard"); revalidatePath("/dashboard/occasion/depots-vente"); revalidatePath("/dashboard/occasion/catalogue"); revalidatePath("/dashboard/occasion/ventes"); revalidatePath("/dashboard/comptabilite"); }

async function upload(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, formData: FormData) {
  const files = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0).slice(0, 8);
  const result: ConsignmentImageV134[] = [];
  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error("image");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `consignments/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const stored = await supabase.storage.from("vehicle-images").upload(path, file, { contentType: file.type, upsert: false });
    if (stored.error) throw stored.error;
    result.push({ path, url: supabase.storage.from("vehicle-images").getPublicUrl(path).data.publicUrl });
  }
  return result;
}

export async function submitVehicleConsignmentV134(formData: FormData) {
  const brand = text(formData.get("brand"), 100); const model = text(formData.get("model"), 140); const desiredPrice = number(formData.get("desired_price")); const description = text(formData.get("description"));
  if (!brand || !model || desiredPrice <= 0 || description.length < 10) redirect("/motors/depot-vente?error=invalid");
  const supabase = await createClient(); const { data } = await supabase.auth.getUser(); if (!data.user) redirect("/");
  let images: ConsignmentImageV134[] = []; try { images = await upload(supabase, data.user.id, formData); } catch { redirect("/motors/depot-vente?error=image"); }
  const { data: row, error } = await supabase.from("vehicle_consignments_v134").insert({ user_id: data.user.id, owner_name: getRpName(data.user) || getDiscordName(data.user) || "Client Nostra Motors", owner_email: data.user.email ?? null, owner_phone: text(formData.get("owner_phone"), 80) || null, brand, model, version: text(formData.get("version"), 140) || null, registration: text(formData.get("registration"), 40).toUpperCase() || null, mileage: number(formData.get("mileage")), first_registration_year: number(formData.get("first_registration_year")) || null, vehicle_condition: text(formData.get("vehicle_condition"), 30) || "good", description, images, desired_price: desiredPrice }).select("consignment_number").single();
  if (error) redirect("/motors/depot-vente?error=setup"); refresh(); redirect(`/motors/depot-vente?sent=${encodeURIComponent(String(row.consignment_number))}`);
}

export async function reviewVehicleConsignmentV134(formData: FormData) {
  const id = number(formData.get("consignment_id")); const status = text(formData.get("status"), 30); const salePrice = number(formData.get("agreed_sale_price")); const rate = number(formData.get("commission_rate"));
  if (!id || !["new", "reviewing", "offer_sent", "refused", "cancelled"].includes(status) || rate < 0 || rate > 100 || (status === "offer_sent" && salePrice <= 0)) redirect("/dashboard/occasion/depots-vente?error=invalid");
  const commission = Math.round(salePrice * rate) / 100; const { supabase } = await staff();
  const { error } = await supabase.from("vehicle_consignments_v134").update({ status, agreed_sale_price: salePrice || null, commission_rate: rate, commission_amount: commission, owner_net_amount: Math.max(0, salePrice - commission), assigned_staff: text(formData.get("assigned_staff"), 160) || null, public_description: text(formData.get("public_description")) || null, staff_note: text(formData.get("staff_note")) || null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect("/dashboard/occasion/depots-vente?error=save"); refresh(); redirect("/dashboard/occasion/depots-vente?saved=1");
}

export async function acceptVehicleConsignmentV134(formData: FormData) { const id = number(formData.get("consignment_id")); const supabase = await createClient(); const { error } = await (supabase as any).rpc("accept_vehicle_consignment_v134", { p_consignment_id: id }); if (error) redirect("/motors/depot-vente?error=accept"); refresh(); redirect("/motors/depot-vente?accepted=1"); }
export async function cancelVehicleConsignmentV134(formData: FormData) { const id = number(formData.get("consignment_id")); const supabase = await createClient(); const { data } = await supabase.auth.getUser(); if (!data.user) redirect("/"); const { error } = await supabase.from("vehicle_consignments_v134").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", data.user.id).in("status", ["new", "reviewing", "offer_sent"]); if (error) redirect("/motors/depot-vente?error=save"); refresh(); redirect("/motors/depot-vente?cancelled=1"); }
export async function publishVehicleConsignmentV134(formData: FormData) { const id = number(formData.get("consignment_id")); const { supabase } = await staff(); const { error } = await (supabase as any).rpc("publish_vehicle_consignment_v134", { p_consignment_id: id }); if (error) redirect("/dashboard/occasion/depots-vente?error=publish"); refresh(); redirect("/dashboard/occasion/depots-vente?published=1"); }

export async function markConsignmentOwnerPaidV134(formData: FormData) { const id = number(formData.get("consignment_id")); const { supabase } = await staff(); const { error } = await supabase.from("vehicle_consignments_v134").update({ owner_paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("status", "sold"); if (error) redirect("/dashboard/occasion/depots-vente?error=save"); refresh(); redirect("/dashboard/occasion/depots-vente?paid=1"); }
