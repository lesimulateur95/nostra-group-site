"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  return supabase;
}

export async function createMotorAppointment(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const customerName = field(formData, "customer_name");
  const phone = field(formData, "phone");
  const email = field(formData, "email");
  const appointmentDate = field(formData, "appointment_date");
  const appointmentTime = field(formData, "appointment_time");
  const vehicleSelection = field(formData, "vehicle_id");
  const customVehicleLabel = field(formData, "vehicle_label");
  const [vehicleId, selectedVehicleLabel] = vehicleSelection.split("|||", 2);
  const vehicleLabel = customVehicleLabel || selectedVehicleLabel || "";
  const reason = field(formData, "message");

  const selectedDate = new Date(`${appointmentDate}T${appointmentTime}:00`);

  if (
    !customerName ||
    !phone ||
    !appointmentDate ||
    !appointmentTime ||
    reason.length < 3 ||
    Number.isNaN(selectedDate.getTime()) ||
    selectedDate.getTime() < Date.now() - 60_000
  ) {
    redirect("/motors/rendez-vous?error=missing");
  }

  const { error } = await (supabase as any)
    .from("motors_appointments")
    .insert({
      user_id: data.user.id,
      customer_name: customerName,
      phone,
      email: email || null,
      // Valeur technique conservée pour rester compatible avec la table
      // existante. Le véritable motif libre est enregistré dans message.
      appointment_type: "showroom",
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      vehicle_id: vehicleId || null,
      vehicle_label: vehicleLabel || null,
      message: reason,
      status: "pending",
    });

  if (error) {
    redirect("/motors/rendez-vous?error=database");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/rendez-vous-motors");
  redirect("/motors/rendez-vous?sent=1");
}

export async function updateMotorAppointment(formData: FormData) {
  const supabase = await requireManager();

  const id = field(formData, "id");
  const status = field(formData, "status");
  const directionNote = field(formData, "direction_note");

  if (
    !id ||
    !["pending", "confirmed", "declined", "completed", "cancelled"].includes(
      status,
    )
  ) {
    redirect("/dashboard/rendez-vous-motors?error=invalid");
  }

  const { error } = await (supabase as any)
    .from("motors_appointments")
    .update({
      status,
      direction_note: directionNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    redirect("/dashboard/rendez-vous-motors?error=database");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/rendez-vous-motors");
  redirect("/dashboard/rendez-vous-motors?saved=1");
}

export async function deleteMotorAppointment(formData: FormData) {
  const supabase = await requireManager();
  const id = field(formData, "id");

  if (!id) {
    redirect("/dashboard/rendez-vous-motors?error=invalid");
  }

  const { error } = await (supabase as any)
    .from("motors_appointments")
    .delete()
    .eq("id", id);

  if (error) {
    redirect("/dashboard/rendez-vous-motors?error=delete");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/rendez-vous-motors");
  redirect("/dashboard/rendez-vous-motors?deleted=1");
}
