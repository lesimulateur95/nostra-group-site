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

function isMissingDatabaseObject(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return code === "PGRST205" || code === "42P01" || message.includes("circuit_reservation_requests") || message.includes("schema cache");
}

function currentParisDateAndTime(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
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

export async function saveMotorsStatus(formData: FormData) {
  const status = text(formData.get("motors_status"), 30);
  const label = text(formData.get("motors_label"), 100);
  const message = text(formData.get("motors_message"), 500);
  const allowed = new Set(["open", "closed", "appointment", "inventory", "event"]);
  if (!allowed.has(status) || label.length < 2 || message.length < 2) redirect("/dashboard/circuit?motors_error=invalid");

  const { supabase, user } = await requireManager();
  const { error } = await supabase.from("motors_settings").upsert({
    id: 1,
    status,
    label,
    message,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) redirect("/dashboard/circuit?motors_error=save");

  revalidatePath("/motors", "layout");
  revalidatePath("/dashboard/circuit");
  revalidatePath("/dashboard");
  redirect("/dashboard/circuit?motors_saved=1");
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
  const championshipRaw = text(formData.get("championship"), 20) || "general";
  const championship = new Set(["general", "f1", "gt3rs"]).has(championshipRaw) ? championshipRaw : "general";
  const dashboardTarget = text(formData.get("dashboard_target"), 40) === "championnats" ? "/dashboard/championnats" : "/dashboard/evenements";
  if (title.length < 2 || !startsAt || !new Set(["draft", "published", "cancelled", "completed"]).has(status)) {
    redirect(`${dashboardTarget}?error=invalid`);
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
    championship,
    updated_at: new Date().toISOString(),
    created_by: user.id,
  };
  const result = id > 0
    ? await supabase.from("events").update(payload).eq("id", id)
    : await supabase.from("events").insert(payload);
  if (result.error) redirect(`${dashboardTarget}?error=save`);

  revalidatePath("/evenements", "layout");
  revalidatePath("/circuit/championnat-f1/calendrier");
  revalidatePath("/circuit/championnat-gt3rs/calendrier");
  revalidatePath("/dashboard/evenements");
  revalidatePath("/dashboard/championnats");
  redirect(`${dashboardTarget}?saved=1`);
}

export async function deleteEvent(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const dashboardTarget = text(formData.get("dashboard_target"), 40) === "championnats" ? "/dashboard/championnats" : "/dashboard/evenements";
  const { supabase } = await requireManager();
  if (id > 0) await supabase.from("events").delete().eq("id", id);
  revalidatePath("/evenements", "layout");
  revalidatePath("/circuit/championnat-f1/calendrier");
  revalidatePath("/circuit/championnat-gt3rs/calendrier");
  revalidatePath("/dashboard/evenements");
  revalidatePath("/dashboard/championnats");
  redirect(`${dashboardTarget}?deleted=1`);
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


export async function deleteHomologationRequest(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  if (id <= 0) redirect("/dashboard/homologations?error=invalid");

  const { supabase } = await requireManager();
  const { error } = await supabase
    .from("homologation_requests")
    .delete()
    .eq("id", id);

  if (error) redirect("/dashboard/homologations?error=delete");

  revalidatePath("/dashboard/homologations");
  revalidatePath("/circuit/administration-sportive/homologation-vehicules");
  revalidatePath("/circuit/administration-sportive/homologation-ecuries");
  revalidatePath("/profil");
  redirect("/dashboard/homologations?deleted=1");
}

function validReservationDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validReservationTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function submitCircuitReservation(formData: FormData) {
  const firstName = text(formData.get("first_name"), 80);
  const lastName = text(formData.get("last_name"), 80);
  const reservationDate = text(formData.get("reservation_date"), 20);
  const reservationTime = text(formData.get("reservation_time"), 10);
  const reason = text(formData.get("reason"), 1500);

  if (firstName.length < 2 || lastName.length < 2 || !validReservationDate(reservationDate) || !validReservationTime(reservationTime) || reason.length < 3) {
    redirect("/circuit/reservations/demande?error=invalid");
  }

  const parisNow = currentParisDateAndTime();
  if (reservationDate < parisNow.date || (reservationDate === parisNow.date && reservationTime <= parisNow.time)) {
    redirect("/circuit/reservations/demande?error=past");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { data: conflict, error: conflictError } = await supabase
    .from("circuit_reservation_requests")
    .select("id")
    .eq("reservation_date", reservationDate)
    .eq("reservation_time", reservationTime)
    .eq("status", "approved")
    .maybeSingle();
  if (isMissingDatabaseObject(conflictError)) redirect("/circuit/reservations/demande?error=setup");
  if (conflictError) redirect("/circuit/reservations/demande?error=save");
  if (conflict) redirect("/circuit/reservations/demande?error=occupied");

  const { error } = await supabase.from("circuit_reservation_requests").insert({
    user_id: data.user.id,
    first_name: firstName,
    last_name: lastName,
    reservation_date: reservationDate,
    reservation_time: reservationTime,
    reason,
  });
  if (isMissingDatabaseObject(error)) redirect("/circuit/reservations/demande?error=setup");
  if (error) redirect("/circuit/reservations/demande?error=save");

  revalidatePath("/circuit/reservations/demande");
  revalidatePath("/dashboard/reservations");
  redirect("/circuit/reservations/demande?sent=1");
}

export async function updateCircuitReservation(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const status = text(formData.get("status"), 20);
  const adminNote = text(formData.get("admin_note"), 1500) || null;
  if (id <= 0 || !new Set(["pending", "approved", "rejected", "cancelled"]).has(status)) {
    redirect("/dashboard/reservations?error=invalid");
  }

  const { supabase } = await requireManager();
  if (status === "approved") {
    const { data: request } = await supabase
      .from("circuit_reservation_requests")
      .select("reservation_date,reservation_time")
      .eq("id", id)
      .maybeSingle();
    if (request) {
      const { data: conflict } = await supabase
        .from("circuit_reservation_requests")
        .select("id")
        .eq("reservation_date", request.reservation_date)
        .eq("reservation_time", request.reservation_time)
        .eq("status", "approved")
        .neq("id", id)
        .maybeSingle();
      if (conflict) redirect("/dashboard/reservations?error=occupied");
    }
  }

  const { error } = await supabase
    .from("circuit_reservation_requests")
    .update({ status, admin_note: adminNote, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) redirect("/dashboard/reservations?error=save");

  revalidatePath("/dashboard/reservations");
  revalidatePath("/circuit/reservations/demande");
  revalidatePath("/circuit/reservations/validees");
  revalidatePath("/profil");
  redirect("/dashboard/reservations?saved=1");
}

export async function deleteCircuitReservation(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  if (id <= 0) redirect("/dashboard/reservations?error=invalid");

  const { supabase } = await requireManager();
  const { error } = await supabase
    .from("circuit_reservation_requests")
    .delete()
    .eq("id", id);
  if (error) redirect("/dashboard/reservations?error=delete");

  revalidatePath("/dashboard/reservations");
  revalidatePath("/circuit/reservations/demande");
  revalidatePath("/circuit/reservations/validees");
  revalidatePath("/profil");
  redirect("/dashboard/reservations?deleted=1");
}

function isMissingTeamRegistrationObject(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return error.code === "PGRST205" || error.code === "42P01" || message.includes("team_registration_requests") || message.includes("schema cache");
}

function yesNoChoice(value: FormDataEntryValue | null): boolean | null {
  const choice = text(value, 10).toLowerCase();
  if (choice === "yes") return true;
  if (choice === "no") return false;
  return null;
}

export async function submitTeamRegistration(formData: FormData) {
  const registrationType = text(formData.get("registration_type"), 20);
  const allowedTypes = new Set(["f1", "gt3rs", "both"]);
  const applicantName = text(formData.get("applicant_name"), 120);
  const teamName = text(formData.get("team_name"), 120);
  const teamDirector = text(formData.get("team_director"), 120);
  const requestedNumberF1 = text(formData.get("requested_number_f1"), 30) || null;
  const requestedNumberGt3rs = text(formData.get("requested_number_gt3rs"), 30) || null;
  const hasF1License = yesNoChoice(formData.get("has_f1_license"));
  const hasGt3rsLicense = yesNoChoice(formData.get("has_gt3rs_license"));
  const notes = text(formData.get("notes"), 2500) || null;
  const returnPath = "/circuit/administration-sportive/creation-ecurie";

  if (!allowedTypes.has(registrationType) || applicantName.length < 2 || teamName.length < 2 || teamDirector.length < 2) {
    redirect(`${returnPath}?error=invalid`);
  }
  if ((registrationType === "f1" || registrationType === "both") && (!requestedNumberF1 || hasF1License === null)) {
    redirect(`${returnPath}?error=invalid`);
  }
  if ((registrationType === "gt3rs" || registrationType === "both") && (!requestedNumberGt3rs || hasGt3rsLicense === null)) {
    redirect(`${returnPath}?error=invalid`);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const { error } = await supabase.from("team_registration_requests").insert({
    user_id: data.user.id,
    registration_type: registrationType,
    applicant_name: applicantName,
    team_name: teamName,
    team_director: teamDirector,
    requested_number_f1: registrationType === "gt3rs" ? null : requestedNumberF1,
    requested_number_gt3rs: registrationType === "f1" ? null : requestedNumberGt3rs,
    has_f1_license: registrationType === "gt3rs" ? false : Boolean(hasF1License),
    has_gt3rs_license: registrationType === "f1" ? false : Boolean(hasGt3rsLicense),
    notes,
  });

  if (isMissingTeamRegistrationObject(error)) redirect(`${returnPath}?error=setup`);
  if (error) redirect(`${returnPath}?error=save`);

  revalidatePath(returnPath);
  revalidatePath("/dashboard/inscriptions-ecuries");
  revalidatePath("/dashboard");
  redirect(`${returnPath}?sent=${registrationType}`);
}

export async function updateTeamRegistration(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const status = text(formData.get("status"), 20);
  const adminNote = text(formData.get("admin_note"), 2500) || null;
  if (id <= 0 || !new Set(["pending", "reviewing", "approved", "rejected"]).has(status)) {
    redirect("/dashboard/inscriptions-ecuries?error=invalid");
  }

  const { supabase } = await requireManager();
  const { error } = await supabase
    .from("team_registration_requests")
    .update({ status, admin_note: adminNote, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (isMissingTeamRegistrationObject(error)) redirect("/dashboard/inscriptions-ecuries?error=setup");
  if (error) redirect("/dashboard/inscriptions-ecuries?error=save");

  revalidatePath("/dashboard/inscriptions-ecuries");
  revalidatePath("/dashboard");
  revalidatePath("/profil");
  redirect("/dashboard/inscriptions-ecuries?saved=1");
}

export async function deleteTeamRegistration(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  if (id <= 0) redirect("/dashboard/inscriptions-ecuries?error=invalid");

  const { supabase } = await requireManager();
  const { error } = await supabase
    .from("team_registration_requests")
    .delete()
    .eq("id", id);

  if (isMissingTeamRegistrationObject(error)) redirect("/dashboard/inscriptions-ecuries?error=setup");
  if (error) redirect("/dashboard/inscriptions-ecuries?error=delete");

  revalidatePath("/dashboard/inscriptions-ecuries");
  revalidatePath("/dashboard");
  revalidatePath("/profil");
  redirect("/dashboard/inscriptions-ecuries?deleted=1");
}
