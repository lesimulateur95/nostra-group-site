"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

const text = (value: FormDataEntryValue | null, max = 3000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: FormDataEntryValue | null) => { const parsed = Number(text(value, 40).replace(/\s/g, "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; };

async function staff() {
  const supabase = await createClient(); const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  if (!roles.some((role) => ["manager", "employee", "commercial"].includes(role))) redirect("/accueil");
  return { supabase, user: data.user };
}

function refresh() {
  revalidatePath("/motors/mandat-recherche"); revalidatePath("/profil");
  revalidatePath("/dashboard"); revalidatePath("/dashboard/occasion/mandats-recherche");
}

export async function submitVehicleSearchMandateV134(formData: FormData) {
  const budgetMax = number(formData.get("budget_max"));
  if (budgetMax <= 0) redirect("/motors/mandat-recherche?error=invalid");
  const supabase = await createClient(); const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const { data: row, error } = await supabase.from("vehicle_search_mandates_v134").insert({
    user_id: data.user.id,
    customer_name: getRpName(data.user) || getDiscordName(data.user) || "Client Nostra Motors",
    customer_email: data.user.email ?? null, customer_phone: text(formData.get("customer_phone"), 80) || null,
    brand: text(formData.get("brand"), 100) || null, model: text(formData.get("model"), 140) || null,
    vehicle_type: text(formData.get("vehicle_type"), 100) || null,
    budget_min: number(formData.get("budget_min")), budget_max: budgetMax,
    year_min: number(formData.get("year_min")) || null, max_mileage: number(formData.get("max_mileage")) || null,
    required_features: text(formData.get("required_features")) || null, notes: text(formData.get("notes")) || null,
  }).select("mandate_number").single();
  if (error) redirect("/motors/mandat-recherche?error=setup");
  refresh(); redirect(`/motors/mandat-recherche?sent=${encodeURIComponent(String(row.mandate_number))}`);
}

export async function updateVehicleSearchMandateV134(formData: FormData) {
  const id = number(formData.get("mandate_id")); const status = text(formData.get("status"), 30);
  if (!id || !["new", "searching", "proposed", "closed", "refused"].includes(status)) redirect("/dashboard/occasion/mandats-recherche?error=invalid");
  const { supabase } = await staff();
  const { error } = await supabase.from("vehicle_search_mandates_v134").update({ status, assigned_staff: text(formData.get("assigned_staff"), 160) || null, staff_note: text(formData.get("staff_note")) || null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect("/dashboard/occasion/mandats-recherche?error=save");
  refresh(); redirect("/dashboard/occasion/mandats-recherche?saved=1");
}

export async function addVehicleSearchProposalV134(formData: FormData) {
  const mandateId = number(formData.get("mandate_id")); const price = number(formData.get("price")); const vehicleName = text(formData.get("vehicle_name"), 220);
  if (!mandateId || !vehicleName || price <= 0) redirect("/dashboard/occasion/mandats-recherche?error=invalid");
  const { supabase, user } = await staff();
  const { error } = await supabase.from("vehicle_search_proposals_v134").insert({ mandate_id: mandateId, vehicle_name: vehicleName, price, year: number(formData.get("year")) || null, mileage: number(formData.get("mileage")) || null, source_url: text(formData.get("source_url"), 800) || null, details: text(formData.get("details")) || null, created_by: user.id });
  if (!error) await supabase.from("vehicle_search_mandates_v134").update({ status: "proposed", updated_at: new Date().toISOString() }).eq("id", mandateId);
  if (error) redirect("/dashboard/occasion/mandats-recherche?error=save");
  refresh(); redirect("/dashboard/occasion/mandats-recherche?proposal=1");
}

export async function chooseVehicleSearchProposalV134(formData: FormData) {
  const id = number(formData.get("proposal_id")); const supabase = await createClient();
  const { error } = await (supabase as any).rpc("choose_vehicle_search_proposal_v134", { p_proposal_id: id });
  if (error) redirect("/motors/mandat-recherche?error=proposal");
  refresh(); redirect("/motors/mandat-recherche?selected=1");
}

export async function cancelVehicleSearchMandateV134(formData: FormData) {
  const id = number(formData.get("mandate_id")); const supabase = await createClient(); const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const { error } = await supabase.from("vehicle_search_mandates_v134").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", data.user.id).in("status", ["new", "searching", "proposed"]);
  if (error) redirect("/motors/mandat-recherche?error=save"); refresh(); redirect("/motors/mandat-recherche?cancelled=1");
}
