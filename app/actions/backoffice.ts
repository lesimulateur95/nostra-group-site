"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRpName } from "@/lib/auth/user-profile";
import { hasDashboardAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = Number.parseInt(text(value, 30), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: FormDataEntryValue | null): number {
  const raw = text(value, 60).replace(/\s|€|\$/g, "");
  if (!raw) return 0;
  let normalized = raw;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIndex = Math.max(lastComma, lastDot);
    normalized = raw.slice(0, decimalIndex).replace(/[.,]/g, "") + "." + raw.slice(decimalIndex + 1).replace(/[.,]/g, "");
  } else if (lastComma >= 0) {
    const decimals = raw.length - lastComma - 1;
    normalized = decimals === 3 ? raw.replace(/,/g, "") : raw.replace(/,/g, ".");
  } else if (lastDot >= 0) {
    const decimals = raw.length - lastDot - 1;
    normalized = decimals === 3 ? raw.replace(/\./g, "") : raw;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function checkbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!(await hasDashboardAccess(data.user))) redirect("/accueil");
  return { supabase, user: data.user };
}

export async function saveCircuitStatus(formData: FormData) {
  const status = text(formData.get("circuit_status"), 30);
  const label = text(formData.get("circuit_label"), 100);
  const message = text(formData.get("circuit_message"), 500);
  const allowed = new Set(["open", "closed", "maintenance", "reserved", "competition"]);
  if (!allowed.has(status) || label.length < 2 || message.length < 2) redirect("/dashboard/circuit?error=invalid");

  const { supabase, user } = await requireManager();
  const { error } = await supabase.from("circuit_settings").upsert({
    id: 1,
    status,
    label,
    message,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) redirect("/dashboard/circuit?error=save");

  revalidatePath("/circuit", "layout");
  revalidatePath("/dashboard/circuit");
  redirect("/dashboard/circuit?saved=1");
}

export async function saveInventoryItem(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const name = text(formData.get("name"), 120);
  const category = text(formData.get("category"), 80) || "Général";
  const sku = text(formData.get("sku"), 80) || null;
  const quantity = Math.max(0, integer(formData.get("quantity"), 0));
  const minimumQuantity = Math.max(0, integer(formData.get("minimum_quantity"), 0));
  const unitPrice = money(formData.get("unit_price"));
  const notes = text(formData.get("notes"), 1000) || null;
  if (name.length < 2) redirect("/dashboard/stocks?error=invalid");

  const { supabase, user } = await requireManager();
  const payload = {
    name,
    category,
    sku,
    quantity,
    minimum_quantity: minimumQuantity,
    unit_price: unitPrice,
    notes,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const result = id > 0
    ? await supabase.from("inventory_items").update(payload).eq("id", id)
    : await supabase.from("inventory_items").insert(payload);

  if (result.error) redirect("/dashboard/stocks?error=save");
  revalidatePath("/dashboard/stocks");
  redirect("/dashboard/stocks?saved=1");
}

export async function deleteInventoryItem(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const { supabase } = await requireManager();
  if (id > 0) await supabase.from("inventory_items").delete().eq("id", id);
  revalidatePath("/dashboard/stocks");
  redirect("/dashboard/stocks?deleted=1");
}

export async function createAccountingEntry(formData: FormData) {
  const entryDate = text(formData.get("operation_date"), 20);
  const entryType = text(formData.get("operation_type"), 20);
  const category = text(formData.get("operation_category"), 80) || "Général";
  const label = text(formData.get("operation_label"), 160);
  const amount = money(formData.get("operation_amount"));
  const notes = text(formData.get("operation_notes"), 1000) || null;
  if (!entryDate || !new Set(["income", "expense"]).has(entryType) || label.length < 2 || amount <= 0) {
    redirect("/dashboard/comptabilite?error=invalid");
  }

  const { supabase, user } = await requireManager();
  const { error } = await supabase.from("accounting_entries").insert({
    entry_date: entryDate,
    entry_type: entryType,
    category,
    label,
    amount,
    notes,
    created_by: user.id,
  });
  if (error) redirect("/dashboard/comptabilite?error=save");
  revalidatePath("/dashboard/comptabilite");
  redirect("/dashboard/comptabilite?saved=1");
}

export async function deleteAccountingEntry(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const { supabase } = await requireManager();
  if (id > 0) await supabase.from("accounting_entries").delete().eq("id", id);
  revalidatePath("/dashboard/comptabilite");
  redirect("/dashboard/comptabilite?deleted=1");
}

function normalizeEventDate(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function saveEvent(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const title = text(formData.get("title"), 160);
  const description = text(formData.get("description"), 4000);
  const location = text(formData.get("location"), 160);
  const startsAt = normalizeEventDate(text(formData.get("starts_at"), 40));
  const endsAt = normalizeEventDate(text(formData.get("ends_at"), 40));
  const status = text(formData.get("status"), 20);
  const registrationOpen = checkbox(formData.get("registration_open"));
  if (title.length < 2 || !startsAt || !new Set(["draft", "published", "cancelled", "completed"]).has(status)) {
    redirect("/dashboard/evenements?error=invalid");
  }

  const { supabase, user } = await requireManager();
  const payload = {
    title,
    description,
    location,
    starts_at: startsAt,
    ends_at: endsAt,
    status,
    registration_open: registrationOpen,
    updated_at: new Date().toISOString(),
    created_by: user.id,
  };
  const result = id > 0
    ? await supabase.from("events").update(payload).eq("id", id)
    : await supabase.from("events").insert(payload);
  if (result.error) redirect("/dashboard/evenements?error=save");

  revalidatePath("/evenements", "layout");
  revalidatePath("/dashboard/evenements");
  redirect("/dashboard/evenements?saved=1");
}

export async function deleteEvent(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const { supabase } = await requireManager();
  if (id > 0) await supabase.from("events").delete().eq("id", id);
  revalidatePath("/evenements", "layout");
  revalidatePath("/dashboard/evenements");
  redirect("/dashboard/evenements?deleted=1");
}

export async function submitHomologationRequest(formData: FormData) {
  const requestType = text(formData.get("request_type"), 20);
  if (!new Set(["vehicle", "team"]).has(requestType)) redirect("/circuit/administration-sportive?error=invalid");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const applicantName = getRpName(data.user) || text(formData.get("applicant_name"), 100);
  if (applicantName.length < 2) redirect("/profil");

  const payload = requestType === "vehicle"
    ? {
        vehicle_name: text(formData.get("vehicle_name"), 120),
        vehicle_model: text(formData.get("vehicle_model"), 120),
        plate: text(formData.get("plate"), 50),
        category: text(formData.get("category"), 80),
        modifications: text(formData.get("modifications"), 2000),
        notes: text(formData.get("notes"), 2000),
      }
    : {
        team_name: text(formData.get("team_name"), 120),
        owner_name: text(formData.get("owner_name"), 120) || applicantName,
        drivers: text(formData.get("drivers"), 2000),
        vehicles: text(formData.get("vehicles"), 2000),
        colors: text(formData.get("colors"), 200),
        notes: text(formData.get("notes"), 2000),
      };

  const requiredValue = requestType === "vehicle" ? payload.vehicle_name : payload.team_name;
  if (!requiredValue || String(requiredValue).length < 2) {
    const path = requestType === "vehicle" ? "homologation-vehicules" : "homologation-ecuries";
    redirect(`/circuit/administration-sportive/${path}?error=invalid`);
  }

  const { error } = await supabase.from("homologation_requests").insert({
    user_id: data.user.id,
    request_type: requestType,
    applicant_name: applicantName,
    payload,
  });
  const path = requestType === "vehicle" ? "homologation-vehicules" : "homologation-ecuries";
  if (error) redirect(`/circuit/administration-sportive/${path}?error=save`);
  revalidatePath(`/circuit/administration-sportive/${path}`);
  revalidatePath("/dashboard/homologations");
  redirect(`/circuit/administration-sportive/${path}?sent=1`);
}

export async function updateHomologationRequest(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const status = text(formData.get("status"), 20);
  const adminNote = text(formData.get("admin_note"), 2000) || null;
  if (id <= 0 || !new Set(["pending", "reviewing", "approved", "rejected"]).has(status)) {
    redirect("/dashboard/homologations?error=invalid");
  }

  const { supabase } = await requireManager();
  const { error } = await supabase.from("homologation_requests").update({
    status,
    admin_note: adminNote,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) redirect("/dashboard/homologations?error=save");
  revalidatePath("/dashboard/homologations");
  revalidatePath("/circuit/administration-sportive/homologation-vehicules");
  revalidatePath("/circuit/administration-sportive/homologation-ecuries");
  revalidatePath("/profil");
  redirect("/dashboard/homologations?saved=1");
}
