"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function num(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(text(value, 80));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function int(value: FormDataEntryValue | null, fallback = 0) {
  return Math.trunc(num(value, fallback));
}
function iso(value: FormDataEntryValue | null): string | null {
  const raw = text(value, 80);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function roleKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

async function managerClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const { data: profile } = await (supabase as any)
    .from("member_profiles")
    .select("role,roles,rp_first_name,rp_last_name,discord_name")
    .eq("user_id", data.user.id)
    .maybeSingle();
  const roles = Array.isArray(profile?.roles) ? profile.roles.map(String) : [];
  const allowed = roles.includes("manager") || roles.includes("direction") || ["manager", "direction"].includes(String(profile?.role ?? ""));
  if (!allowed) redirect("/accueil");
  const staffName = `${profile?.rp_first_name ?? ""} ${profile?.rp_last_name ?? ""}`.trim() || String(profile?.discord_name ?? "Direction Nostra");
  return { supabase, user: data.user, staffName };
}

export async function saveRentalInspectionV156(formData: FormData) {
  const { supabase, user, staffName } = await managerClient();
  const bookingId = text(formData.get("booking_id"), 80);
  const inspectionType = text(formData.get("inspection_type"), 20) === "return" ? "return" : "departure";
  if (!bookingId) redirect("/dashboard/etat-des-lieux?error=booking");
  const photoLines = text(formData.get("photos"), 6000)
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter((value) => /^https?:\/\//i.test(value))
    .slice(0, 12);
  const payload = {
    booking_id: bookingId,
    inspection_type: inspectionType,
    mileage: Math.max(0, int(formData.get("mileage"))),
    fuel_percent: Math.max(0, Math.min(100, int(formData.get("fuel_percent"), 100))),
    exterior_condition: text(formData.get("exterior_condition"), 5000),
    interior_condition: text(formData.get("interior_condition"), 5000),
    damage_notes: text(formData.get("damage_notes"), 5000),
    customer_comment: text(formData.get("customer_comment"), 3000),
    photos: photoLines,
    staff_name: staffName,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = await (supabase as any)
    .from("motors_rental_inspections_v156")
    .upsert(payload, { onConflict: "booking_id,inspection_type" });
  if (error) redirect("/dashboard/etat-des-lieux?error=save");
  revalidatePath("/dashboard/etat-des-lieux");
  revalidatePath("/profil/locations");
  redirect(`/dashboard/etat-des-lieux?saved=${inspectionType}`);
}

export async function saveFlashSaleV156(formData: FormData) {
  const { supabase, user } = await managerClient();
  const id = text(formData.get("id"), 80);
  const vehicleId = int(formData.get("vehicle_id"));
  const startsAt = iso(formData.get("starts_at"));
  const endsAt = iso(formData.get("ends_at"));
  const flashPrice = Math.max(0, num(formData.get("flash_price")));
  if (!vehicleId || !startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt) || flashPrice <= 0) {
    redirect("/dashboard/ventes-flash?error=invalid");
  }
  const { data: vehicle } = await (supabase as any)
    .from("catalog_vehicles")
    .select("price,catalog_type")
    .eq("id", vehicleId)
    .maybeSingle();
  const regularPrice = Number(vehicle?.price ?? 0);
  if (!vehicle || vehicle.catalog_type === "concession" || !Number.isFinite(regularPrice) || regularPrice <= 0 || flashPrice >= regularPrice) {
    redirect("/dashboard/ventes-flash?error=price");
  }
  const payload = {
    vehicle_id: vehicleId,
    title: text(formData.get("title"), 120) || "Vente flash",
    flash_price: flashPrice,
    starts_at: startsAt,
    ends_at: endsAt,
    enabled: formData.get("enabled") === "on",
    created_by: user.id,
    updated_at: new Date().toISOString(),
  };
  const result = id
    ? await (supabase as any).from("nostra_flash_sales_v156").update(payload).eq("id", id)
    : await (supabase as any).from("nostra_flash_sales_v156").insert(payload);
  if (result.error) redirect("/dashboard/ventes-flash?error=save");
  revalidatePath("/dashboard/ventes-flash");
  revalidatePath("/motors/catalogue", "layout");
  redirect("/dashboard/ventes-flash?saved=1");
}

export async function deleteFlashSaleV156(formData: FormData) {
  const { supabase } = await managerClient();
  const id = text(formData.get("id"), 80);
  if (id) await (supabase as any).from("nostra_flash_sales_v156").delete().eq("id", id);
  revalidatePath("/dashboard/ventes-flash");
  revalidatePath("/motors/catalogue", "layout");
  redirect("/dashboard/ventes-flash?deleted=1");
}

export async function saveMysteryEventV156(formData: FormData) {
  const { supabase, user } = await managerClient();
  const id = text(formData.get("id"), 80);
  const revealAt = iso(formData.get("reveal_at"));
  if (!revealAt || !text(formData.get("teaser_title"), 160)) redirect("/dashboard/evenement-mystere?error=invalid");
  const payload = {
    teaser_title: text(formData.get("teaser_title"), 160),
    teaser_text: text(formData.get("teaser_text"), 3000),
    reveal_at: revealAt,
    revealed_title: text(formData.get("revealed_title"), 160),
    revealed_text: text(formData.get("revealed_text"), 5000),
    target_url: text(formData.get("target_url"), 500) || null,
    enabled: formData.get("enabled") === "on",
    created_by: user.id,
    updated_at: new Date().toISOString(),
  };
  const result = id
    ? await (supabase as any).from("nostra_mystery_events_v156").update(payload).eq("id", id)
    : await (supabase as any).from("nostra_mystery_events_v156").insert(payload);
  if (result.error) redirect("/dashboard/evenement-mystere?error=save");
  revalidatePath("/dashboard/evenement-mystere");
  revalidatePath("/evenements/mystere");
  redirect("/dashboard/evenement-mystere?saved=1");
}

export async function deleteMysteryEventV156(formData: FormData) {
  const { supabase } = await managerClient();
  const id = text(formData.get("id"), 80);
  if (id) await (supabase as any).from("nostra_mystery_events_v156").delete().eq("id", id);
  revalidatePath("/dashboard/evenement-mystere");
  revalidatePath("/evenements/mystere");
  redirect("/dashboard/evenement-mystere?deleted=1");
}

export async function saveGlobalCountdownV156(formData: FormData) {
  const { supabase, user } = await managerClient();
  const payload = {
    singleton: true,
    enabled: formData.get("enabled") === "on",
    title: text(formData.get("title"), 160) || "Prochain rendez-vous Nostra",
    subtitle: text(formData.get("subtitle"), 500),
    ends_at: iso(formData.get("ends_at")),
    target_url: text(formData.get("target_url"), 500) || null,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = await (supabase as any)
    .from("nostra_global_countdown_v156")
    .upsert(payload, { onConflict: "singleton" });
  if (error) redirect("/dashboard/compte-a-rebours?error=save");
  revalidatePath("/dashboard/compte-a-rebours");
  revalidatePath("/", "layout");
  redirect("/dashboard/compte-a-rebours?saved=1");
}

export async function saveCustomRoleV156(formData: FormData) {
  const { supabase } = await managerClient();
  const raw = text(formData.get("role_key"), 80) || text(formData.get("label"), 80);
  const key = roleKey(raw);
  const baseRole = text(formData.get("base_role"), 30);
  if (!key || !["manager", "commercial", "employee", "commissioner", "citizen"].includes(baseRole)) {
    redirect("/dashboard/securite?onglet=roles&error=invalid");
  }
  const { error } = await (supabase as any).from("nostra_custom_roles_v156").upsert({
    role_key: key,
    label: text(formData.get("label"), 100) || key,
    description: text(formData.get("description"), 600),
    base_role: baseRole,
    active: formData.get("active") === "on",
    updated_at: new Date().toISOString(),
  }, { onConflict: "role_key" });
  if (error) redirect("/dashboard/securite?onglet=roles&error=save");
  revalidatePath("/dashboard/securite");
  redirect("/dashboard/securite?onglet=roles&saved=1");
}

export async function saveMemberCustomRolesV156(formData: FormData) {
  const { supabase, user } = await managerClient();
  const userId = text(formData.get("user_id"), 80);
  if (!userId) redirect("/dashboard/securite?onglet=roles&error=user");
  const roleKeys = Array.from(formData.entries())
    .filter(([key, value]) => key.startsWith("custom_role_") && value === "on")
    .map(([key]) => key.slice("custom_role_".length));
  await (supabase as any).from("nostra_member_custom_roles_v156").delete().eq("user_id", userId);
  if (roleKeys.length) {
    const { error } = await (supabase as any).from("nostra_member_custom_roles_v156").insert(
      roleKeys.map((role) => ({ user_id: userId, role_key: role, assigned_by: user.id })),
    );
    if (error) redirect("/dashboard/securite?onglet=roles&error=assign");
  }
  revalidatePath("/dashboard/securite");
  redirect("/dashboard/securite?onglet=roles&assigned=1");
}

export async function saveCustomPagePermissionsV156(formData: FormData) {
  const { supabase, user } = await managerClient();
  const pathPattern = text(formData.get("path_pattern"), 300);
  if (!pathPattern.startsWith("/")) redirect("/dashboard/securite?onglet=permissions&error=path");
  const roles = Array.from(formData.entries())
    .filter(([key, value]) => key.startsWith("custom_role_") && value === "on")
    .map(([key]) => key.slice("custom_role_".length));
  const { error } = await (supabase as any).from("nostra_custom_page_permissions_v156").upsert({
    path_pattern: pathPattern,
    allowed_roles: roles,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "path_pattern" });
  if (error) redirect("/dashboard/securite?onglet=permissions&error=custom");
  revalidatePath("/dashboard/securite");
  redirect("/dashboard/securite?onglet=permissions&custom_saved=1");
}

export async function addBlacklistEntryV156(formData: FormData) {
  const { supabase, user } = await managerClient();
  const userId = text(formData.get("user_id"), 80);
  const scope = text(formData.get("scope"), 30);
  const durationHours = int(formData.get("duration_hours"), 0);
  if (!userId || !["all", "motors", "circuit", "academy", "cercle", "events"].includes(scope)) {
    redirect("/dashboard/securite?onglet=blacklist&error=invalid");
  }
  const blockedUntil = durationHours > 0 ? new Date(Date.now() + durationHours * 3600000).toISOString() : null;
  const { error } = await (supabase as any).from("nostra_internal_blacklist_v156").insert({
    user_id: userId,
    scope,
    reason: text(formData.get("reason"), 1000) || "Restriction interne",
    blocked_until: blockedUntil,
    active: true,
    created_by: user.id,
  });
  if (error) redirect("/dashboard/securite?onglet=blacklist&error=save");
  revalidatePath("/dashboard/securite");
  redirect("/dashboard/securite?onglet=blacklist&saved=1");
}

export async function removeBlacklistEntryV156(formData: FormData) {
  const { supabase } = await managerClient();
  const id = text(formData.get("id"), 80);
  if (id) await (supabase as any).from("nostra_internal_blacklist_v156").update({ active: false, updated_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/dashboard/securite");
  redirect("/dashboard/securite?onglet=blacklist&removed=1");
}

export async function saveEmergencyModeV156(formData: FormData) {
  const { supabase, user } = await managerClient();
  const { error } = await (supabase as any).from("nostra_emergency_mode_v156").upsert({
    singleton: true,
    enabled: formData.get("enabled") === "on",
    message: text(formData.get("message"), 1000) || "Une opération de sécurité est en cours.",
    block_motors: formData.get("block_motors") === "on",
    block_circuit: formData.get("block_circuit") === "on",
    block_cercle: formData.get("block_cercle") === "on",
    block_events: formData.get("block_events") === "on",
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "singleton" });
  if (error) redirect("/dashboard/securite?onglet=urgence&error=save");
  revalidatePath("/dashboard/securite");
  redirect("/dashboard/securite?onglet=urgence&saved=1");
}
