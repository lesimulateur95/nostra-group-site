"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { getRpName } from "@/lib/auth/user-profile";
import { debitCitizenGameMoney, refundCitizenGameMoney } from "@/lib/game-bank/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function numberValue(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(text(value, 80).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}
function integer(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number.parseInt(text(value, 40), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function nullableDate(value: FormDataEntryValue | null) {
  const raw = text(value, 40);
  return raw ? new Date(raw).toISOString() : null;
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");
  return { supabase, user: data.user };
}

async function requireMotorsStaff() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  if (!roles.some((role) => ["manager", "employee", "commercial"].includes(role))) redirect("/accueil");
  return { supabase, user: data.user };
}

function codeValue(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

export async function createPromoCodeV153(formData: FormData) {
  const { supabase, user } = await requireManager();
  const code = codeValue(text(formData.get("code"), 40));
  const label = text(formData.get("label"), 120);
  const scope = text(formData.get("scope"), 20) || "global";
  const discountType = text(formData.get("discount_type"), 20) || "percent";
  const discountValue = numberValue(formData.get("discount_value"));
  if (!code || !label || discountValue <= 0 || !["global", "motors", "ticketing", "cercle"].includes(scope) || !["percent", "fixed"].includes(discountType)) redirect("/dashboard/codes-promo?error=invalid");
  const { error } = await (supabase as any).from("nostra_promo_codes_v153").insert({
    code, label, scope, discount_type: discountType, discount_value: discountValue,
    min_amount: Math.max(0, numberValue(formData.get("min_amount"))),
    max_discount: numberValue(formData.get("max_discount"), -1) >= 0 ? numberValue(formData.get("max_discount")) : null,
    max_uses: integer(formData.get("max_uses")) > 0 ? integer(formData.get("max_uses")) : null,
    max_uses_per_user: Math.max(1, integer(formData.get("max_uses_per_user"), 1)),
    starts_at: nullableDate(formData.get("starts_at")), ends_at: nullableDate(formData.get("ends_at")), enabled: true, created_by: user.id,
  });
  if (error) redirect(`/dashboard/codes-promo?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard/codes-promo");
  redirect("/dashboard/codes-promo?created=1");
}

export async function updatePromoCodeV153(formData: FormData) {
  const { supabase } = await requireManager();
  const id = text(formData.get("id"), 80);
  if (!id) redirect("/dashboard/codes-promo?error=invalid");
  const { error } = await (supabase as any).from("nostra_promo_codes_v153").update({
    label: text(formData.get("label"), 120), scope: text(formData.get("scope"), 20), discount_type: text(formData.get("discount_type"), 20),
    discount_value: Math.max(0.01, numberValue(formData.get("discount_value"))), min_amount: Math.max(0, numberValue(formData.get("min_amount"))),
    max_discount: numberValue(formData.get("max_discount"), -1) >= 0 ? numberValue(formData.get("max_discount")) : null,
    max_uses: integer(formData.get("max_uses")) > 0 ? integer(formData.get("max_uses")) : null,
    max_uses_per_user: Math.max(1, integer(formData.get("max_uses_per_user"), 1)), enabled: formData.get("enabled") === "on",
    starts_at: nullableDate(formData.get("starts_at")), ends_at: nullableDate(formData.get("ends_at")), updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) redirect("/dashboard/codes-promo?error=save");
  revalidatePath("/dashboard/codes-promo"); redirect("/dashboard/codes-promo?saved=1");
}

export async function deletePromoCodeV153(formData: FormData) {
  const { supabase } = await requireManager(); const id = text(formData.get("id"), 80); if (!id) redirect("/dashboard/codes-promo");
  const { error } = await (supabase as any).from("nostra_promo_codes_v153").delete().eq("id", id);
  if (error) redirect("/dashboard/codes-promo?error=delete"); revalidatePath("/dashboard/codes-promo"); redirect("/dashboard/codes-promo?deleted=1");
}

export async function updateMaintenancePoleV153(formData: FormData) {
  const { supabase, user } = await requireManager(); const pole = text(formData.get("pole_key"), 20);
  if (!["motors", "circuit", "cercle", "academy", "events"].includes(pole)) redirect("/dashboard/maintenance-poles?error=invalid");
  const { error } = await (supabase as any).from("nostra_pole_maintenance_v153").update({ enabled: formData.get("enabled") === "on", title: text(formData.get("title"), 160), message: text(formData.get("message"), 2000), eta_text: text(formData.get("eta_text"), 160) || null, updated_at: new Date().toISOString(), updated_by: user.id }).eq("pole_key", pole);
  if (error) redirect("/dashboard/maintenance-poles?error=save");
  revalidatePath("/motors"); revalidatePath("/circuit"); revalidatePath("/casino"); revalidatePath("/evenements"); revalidatePath("/dashboard/maintenance-poles"); redirect("/dashboard/maintenance-poles?saved=1");
}

export async function updateOrderProgressV153(formData: FormData) {
  const { supabase, user } = await requireMotorsStaff(); const orderId = integer(formData.get("order_id")); const stage = text(formData.get("stage"), 30); const progress = Math.min(100, Math.max(0, integer(formData.get("progress_percent"))));
  if (!orderId || !["received","confirmed","preparing","paint","plate","quality","ready","collected","cancelled"].includes(stage)) redirect("/dashboard/commandes?error=progress");
  const paymentStatus = text(formData.get("payment_status"), 20) || "paid";
  const publicMessage = text(formData.get("public_message"), 1200) || null;
  const estimated = nullableDate(formData.get("estimated_ready_at"));
  const { error } = await (supabase as any).from("order_progress_v153").upsert({ order_id: orderId, stage, progress_percent: progress, payment_status: paymentStatus, estimated_ready_at: estimated, internal_note: text(formData.get("internal_note"), 1200) || null, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: "order_id" });
  if (error) redirect("/dashboard/commandes?error=progress");
  await (supabase as any).from("order_progress_history_v153").insert({ order_id: orderId, stage, progress_percent: progress, public_message: publicMessage, created_by: user.id });
  const legacyStatus = stage === "received" ? "pending" : stage === "confirmed" ? "confirmed" : ["preparing", "paint", "plate", "quality"].includes(stage) ? "preparing" : stage === "ready" ? "ready" : stage === "collected" ? "completed" : stage === "cancelled" ? "cancelled" : null;
  if (legacyStatus) await (supabase as any).from("orders").update({ status: legacyStatus }).eq("id", orderId);
  if (paymentStatus === "paid") await (supabase as any).rpc("nostra_generate_vehicle_contract_v153", { p_order_id: orderId });
  revalidatePath("/dashboard/commandes"); revalidatePath("/profil/commandes"); revalidatePath("/profil/documents"); redirect("/dashboard/commandes?progress_saved=1");
}

export async function updateCrmProfileV153(formData: FormData) {
  const { supabase, user } = await requireMotorsStaff(); const userId = text(formData.get("user_id"), 80); if (!userId) redirect("/dashboard/crm-motors?error=invalid");
  const tags = text(formData.get("tags"), 500).split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20);
  const { error } = await (supabase as any).from("motors_crm_profiles_v153").upsert({ user_id: userId, customer_status: text(formData.get("customer_status"), 20) || "standard", preferred_contact: text(formData.get("preferred_contact"), 20) || "mail", assigned_commercial: text(formData.get("assigned_commercial"), 80) || null, tags, last_contact_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: "user_id" });
  if (error) redirect(`/dashboard/crm-motors?customer=${userId}&error=save`); revalidatePath("/dashboard/crm-motors"); redirect(`/dashboard/crm-motors?customer=${userId}&saved=1`);
}

export async function addCrmNoteV153(formData: FormData) {
  const { supabase, user } = await requireMotorsStaff(); const userId = text(formData.get("user_id"), 80); const note = text(formData.get("note"), 3000); if (!userId || note.length < 2) redirect("/dashboard/crm-motors?error=invalid");
  const { error } = await (supabase as any).from("motors_crm_notes_v153").insert({ user_id: userId, category: text(formData.get("category"), 80) || "suivi", note, created_by: user.id });
  if (error) redirect(`/dashboard/crm-motors?customer=${userId}&error=note`); revalidatePath("/dashboard/crm-motors"); redirect(`/dashboard/crm-motors?customer=${userId}&note_saved=1`);
}

export async function saveTeamProfileV153(formData: FormData) {
  const supabase = await createClient(); const { data } = await supabase.auth.getUser(); if (!data.user) redirect("/");
  const teamId = integer(formData.get("team_registration_id")); if (!teamId) redirect("/profil/ecuries?error=invalid");
  const { data: team } = await (supabase as any).from("team_registration_requests").select("id,user_id,status").eq("id", teamId).eq("user_id", data.user.id).maybeSingle();
  if (!team || team.status !== "approved") redirect("/profil/ecuries?error=forbidden");
  const { error } = await (supabase as any).from("nostra_team_profiles_v153").upsert({ team_registration_id: teamId, owner_user_id: data.user.id, logo_url: text(formData.get("logo_url"), 1000) || null, slogan: text(formData.get("slogan"), 180) || null, description: text(formData.get("description"), 3000) || null, primary_color: text(formData.get("primary_color"), 20) || "#111111", secondary_color: text(formData.get("secondary_color"), 20) || "#d6b25e", headquarters: text(formData.get("headquarters"), 180) || null, principal_driver: text(formData.get("principal_driver"), 160) || null, second_driver: text(formData.get("second_driver"), 160) || null, reserve_driver: text(formData.get("reserve_driver"), 160) || null, vehicle_model: text(formData.get("vehicle_model"), 180) || null, achievements: text(formData.get("achievements"), 2500) || null, sponsors: text(formData.get("sponsors"), 1000) || null, public_visible: formData.get("public_visible") === "on", updated_at: new Date().toISOString() }, { onConflict: "team_registration_id" });
  if (error) redirect(`/profil/ecuries/${teamId}?error=save`); revalidatePath(`/profil/ecuries/${teamId}`); revalidatePath(`/circuit/ecuries/${teamId}`); redirect(`/profil/ecuries/${teamId}?saved=1`);
}

export async function createCasinoTierV153(formData: FormData) {
  const { supabase } = await requireManager(); const name = text(formData.get("name"), 80); if (!name) redirect("/dashboard/jeux/casino/statuts?error=invalid");
  const { error } = await (supabase as any).from("casino_status_tiers_v153").insert({ name, min_wagered: Math.max(0, numberValue(formData.get("min_wagered"))), icon: text(formData.get("icon"), 16) || "◆", benefits: text(formData.get("benefits"), 2000), sort_order: integer(formData.get("sort_order"), 100), enabled: true });
  if (error) redirect("/dashboard/jeux/casino/statuts?error=save"); revalidatePath("/dashboard/jeux/casino/statuts"); revalidatePath("/casino/profil"); redirect("/dashboard/jeux/casino/statuts?created=1");
}

export async function updateCasinoTierV153(formData: FormData) {
  const { supabase } = await requireManager(); const id = integer(formData.get("id")); if (!id) redirect("/dashboard/jeux/casino/statuts");
  const { error } = await (supabase as any).from("casino_status_tiers_v153").update({ name: text(formData.get("name"), 80), min_wagered: Math.max(0, numberValue(formData.get("min_wagered"))), icon: text(formData.get("icon"), 16) || "◆", benefits: text(formData.get("benefits"), 2000), sort_order: integer(formData.get("sort_order")), enabled: formData.get("enabled") === "on", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect("/dashboard/jeux/casino/statuts?error=save"); revalidatePath("/dashboard/jeux/casino/statuts"); revalidatePath("/casino/profil"); redirect("/dashboard/jeux/casino/statuts?saved=1");
}

export async function deleteCasinoTierV153(formData: FormData) {
  const { supabase } = await requireManager(); const id = integer(formData.get("id")); if (id) await (supabase as any).from("casino_status_tiers_v153").delete().eq("id", id); revalidatePath("/dashboard/jeux/casino/statuts"); redirect("/dashboard/jeux/casino/statuts?deleted=1");
}

export async function createTicketEventV153(formData: FormData) {
  const { supabase, user } = await requireManager(); const title = text(formData.get("title"), 180); const startsAt = nullableDate(formData.get("starts_at")); if (!title || !startsAt) redirect("/dashboard/billetterie?error=invalid");
  const { error } = await (supabase as any).from("nostra_ticket_events_v153").insert({ pole: text(formData.get("pole"), 20) || "group", title, description: text(formData.get("description"), 3000), location: text(formData.get("location"), 180), starts_at: startsAt, ends_at: nullableDate(formData.get("ends_at")), ticket_price: Math.max(0, numberValue(formData.get("ticket_price"))), capacity: integer(formData.get("capacity")) > 0 ? integer(formData.get("capacity")) : null, sales_open: formData.get("sales_open") === "on", published: formData.get("published") === "on", created_by: user.id });
  if (error) redirect("/dashboard/billetterie?error=save"); revalidatePath("/dashboard/billetterie"); revalidatePath("/billetterie"); redirect("/dashboard/billetterie?created=1");
}

export async function updateTicketEventV153(formData: FormData) {
  const { supabase } = await requireManager(); const id = text(formData.get("id"), 80); if (!id) redirect("/dashboard/billetterie");
  const { error } = await (supabase as any).from("nostra_ticket_events_v153").update({ pole: text(formData.get("pole"), 20), title: text(formData.get("title"), 180), description: text(formData.get("description"), 3000), location: text(formData.get("location"), 180), starts_at: nullableDate(formData.get("starts_at")), ends_at: nullableDate(formData.get("ends_at")), ticket_price: Math.max(0, numberValue(formData.get("ticket_price"))), capacity: integer(formData.get("capacity")) > 0 ? integer(formData.get("capacity")) : null, sales_open: formData.get("sales_open") === "on", published: formData.get("published") === "on", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect("/dashboard/billetterie?error=save"); revalidatePath("/dashboard/billetterie"); revalidatePath("/billetterie"); redirect("/dashboard/billetterie?saved=1");
}

export async function deleteTicketEventV153(formData: FormData) {
  const { supabase } = await requireManager(); const id = text(formData.get("id"), 80); if (id) { const { error } = await (supabase as any).from("nostra_ticket_events_v153").delete().eq("id", id); if (error) redirect("/dashboard/billetterie?error=delete"); } revalidatePath("/dashboard/billetterie"); revalidatePath("/billetterie"); redirect("/dashboard/billetterie?deleted=1");
}

export async function buyTicketV153(formData: FormData) {
  const supabase = await createClient(); const { data } = await supabase.auth.getUser(); if (!data.user) redirect("/");
  const eventId = text(formData.get("event_id"), 80); const quantity = Math.min(20, Math.max(1, integer(formData.get("quantity"), 1))); const promoCode = text(formData.get("promo_code"), 40);
  const [{ data: event }, { data: profile }] = await Promise.all([
    (supabase as any).from("nostra_ticket_events_v153").select("*").eq("id", eventId).eq("published", true).maybeSingle(),
    (supabase as any).from("member_profiles").select("steam_id").eq("user_id", data.user.id).maybeSingle(),
  ]);
  if (!event || !event.sales_open) redirect("/billetterie?error=closed");
  const { data: soldRows } = await (supabase as any).from("nostra_ticket_orders_v153").select("quantity").eq("ticket_event_id", eventId).in("status", ["paid", "used"]);
  const alreadySold = (soldRows ?? []).reduce((sum: number, row: { quantity?: number | null }) => sum + Math.max(0, Number(row.quantity ?? 0)), 0);
  if (event.capacity && alreadySold + quantity > Number(event.capacity)) redirect("/billetterie?error=full");
  const baseAmount = Math.round(Number(event.ticket_price) * quantity); let discount = 0;
  if (promoCode) { const quote = await (supabase as any).rpc("nostra_promo_quote_v153", { p_code: promoCode, p_scope: "ticketing", p_amount: baseAmount }); if (quote.error || !quote.data?.valid) redirect(`/billetterie?error=promo-${quote.data?.reason ?? "invalid"}`); discount = Math.max(0, Number(quote.data.discount_amount) || 0); }
  const total = Math.max(0, Math.round(baseAmount - discount)); const steamId = profile?.steam_id ? String(profile.steam_id) : "";
  if (!steamId) redirect("/billetterie?error=steam");
  let debit: Awaited<ReturnType<typeof debitCitizenGameMoney>> | null = null;
  if (total > 0) { debit = await debitCitizenGameMoney(steamId, total); if (debit.status !== "paid") redirect(`/billetterie?error=${debit.status === "insufficient_funds" ? "funds" : "bank"}`); }
  const ticketNumber = `NG-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch { if (debit?.status === "paid") await refundCitizenGameMoney(steamId, debit.debits); redirect("/billetterie?error=save"); }
  const { data: ticket, error } = await (admin as any).from("nostra_ticket_orders_v153").insert({ ticket_event_id: eventId, user_id: data.user.id, ticket_number: ticketNumber, quantity, unit_price: Number(event.ticket_price), discount_amount: discount, total, status: "paid" }).select("id").single();
  if (error) { if (debit?.status === "paid") await refundCitizenGameMoney(steamId, debit.debits); redirect("/billetterie?error=save"); }
  if (promoCode) await (supabase as any).rpc("nostra_redeem_promo_v153", { p_code: promoCode, p_scope: "ticketing", p_amount: baseAmount, p_source_type: "ticket", p_source_id: String(ticket.id) });
  await (admin as any).from("user_notifications").insert({ user_id: data.user.id, notification_type: "ticket", title: "Billet Nostra confirmé", message: `${quantity} billet(s) pour ${event.title} ont été confirmés.`, target_url: "/profil/billets", source_type: "ticket", source_id: String(ticket.id), priority: "normal", category: "event" });
  revalidatePath("/billetterie"); revalidatePath("/profil/billets"); redirect(`/billetterie?success=${encodeURIComponent(ticketNumber)}`);
}

export async function createBackupV153(formData: FormData) {
  const { supabase } = await requireManager(); const { error } = await (supabase as any).rpc("nostra_create_backup_v153", { p_name: text(formData.get("name"), 160) || null }); if (error) redirect("/dashboard/sauvegardes?error=create"); revalidatePath("/dashboard/sauvegardes"); redirect("/dashboard/sauvegardes?created=1");
}
export async function restoreBackupV153(formData: FormData) {
  const { supabase } = await requireManager(); const id = text(formData.get("id"), 80); const confirm = text(formData.get("confirmation"), 60); if (!id || confirm !== "RESTAURER") redirect("/dashboard/sauvegardes?error=confirm"); const { error } = await (supabase as any).rpc("nostra_restore_backup_v153", { p_backup_id: id }); if (error) redirect(`/dashboard/sauvegardes?error=${encodeURIComponent(error.message)}`); revalidatePath("/dashboard/sauvegardes"); revalidatePath("/dashboard"); redirect("/dashboard/sauvegardes?restored=1");
}
export async function deleteBackupV153(formData: FormData) {
  const { supabase } = await requireManager(); const id = text(formData.get("id"), 80); if (id) await (supabase as any).from("nostra_backups_v153").delete().eq("id", id); revalidatePath("/dashboard/sauvegardes"); redirect("/dashboard/sauvegardes?deleted=1");
}
