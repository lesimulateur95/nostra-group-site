"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

async function currentUserAndRoles() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return { supabase, user: null, roles: [] as string[] };
  }

  return {
    supabase,
    user: data.user,
    roles: await getUserRoleKeys(data.user),
  };
}

function hasMotorsStaffRole(roles: string[]): boolean {
  return roles.some((role) =>
    ["manager", "employee", "commercial"].includes(role),
  );
}

export async function createMotorAppointment(formData: FormData) {
  const { supabase, user } = await currentUserAndRoles();
  const customerName = field(formData, "customer_name");
  const phone = field(formData, "phone");
  const email = field(formData, "email");
  const appointmentType = field(formData, "appointment_type");
  const appointmentDate = field(formData, "appointment_date");
  const appointmentTime = field(formData, "appointment_time");
  const vehicleSelection = field(formData, "vehicle_id");
  const customVehicleLabel = field(formData, "vehicle_label");
  const [vehicleId, selectedVehicleLabel] = vehicleSelection.split("|||", 2);
  const vehicleLabel = customVehicleLabel || selectedVehicleLabel || "";
  const message = field(formData, "message");
  const selectedDate = new Date(`${appointmentDate}T${appointmentTime}:00`);

  if (
    !customerName ||
    !phone ||
    !appointmentDate ||
    !appointmentTime ||
    Number.isNaN(selectedDate.getTime()) ||
    selectedDate.getTime() < Date.now() - 60_000 ||
    !["showroom", "test_drive"].includes(appointmentType)
  ) {
    redirect("/nostra-motors/rendez-vous?error=missing");
  }

  const { error } = await (supabase as any).from("motors_appointments").insert({
    user_id: user?.id ?? null,
    customer_name: customerName,
    phone,
    email: email || null,
    appointment_type: appointmentType,
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    vehicle_id: vehicleId || null,
    vehicle_label: vehicleLabel || null,
    message: message || null,
    status: "pending",
  });

  if (error) redirect("/nostra-motors/rendez-vous?error=database");

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/rendez-vous-motors");
  redirect("/nostra-motors/rendez-vous?sent=1");
}

export async function updateMotorAppointment(formData: FormData) {
  const { supabase, user, roles } = await currentUserAndRoles();
  if (!user || !hasMotorsStaffRole(roles)) redirect("/accueil");

  const id = field(formData, "id");
  const status = field(formData, "status");
  const directionNote = field(formData, "direction_note");

  if (
    !id ||
    !["pending", "confirmed", "declined", "completed", "cancelled"].includes(
      status,
    )
  ) {
    return;
  }

  await (supabase as any)
    .from("motors_appointments")
    .update({
      status,
      direction_note: directionNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/rendez-vous-motors");
}

export async function updateMotorDelivery(formData: FormData) {
  const { supabase, user, roles } = await currentUserAndRoles();
  if (!user || !hasMotorsStaffRole(roles)) redirect("/accueil");

  const id = field(formData, "id");
  const deliveryStatus = field(formData, "delivery_status");
  const deliveryDate = field(formData, "delivery_date");
  const deliveryDriver = field(formData, "delivery_driver");
  const deliveryNotes = field(formData, "delivery_notes");

  if (
    !id ||
    ![
      "not_planned",
      "planned",
      "in_progress",
      "delivered",
      "cancelled",
    ].includes(deliveryStatus)
  ) {
    redirect("/dashboard/livraisons?error=invalid");
  }

  let normalizedDeliveryDate: string | null = null;
  if (deliveryDate) {
    const parsedDate = new Date(deliveryDate);
    if (Number.isNaN(parsedDate.getTime())) {
      redirect("/dashboard/livraisons?error=date");
    }
    normalizedDeliveryDate = parsedDate.toISOString();
  }

  const update: Record<string, unknown> = {
    delivery_status: deliveryStatus,
    delivery_date: normalizedDeliveryDate,
    delivery_driver: deliveryDriver || null,
    delivery_notes: deliveryNotes || null,
    updated_at: new Date().toISOString(),
  };

  // Le statut de commande existant utilise "completed", jamais "delivered".
  if (deliveryStatus === "delivered") update.status = "completed";

  const { data: updatedOrder, error } = await (supabase as any)
    .from("orders")
    .update(update)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !updatedOrder) {
    console.error("[Nostra Motors] Mise à jour de livraison impossible", error);
    redirect("/dashboard/livraisons?error=save");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/livraisons");
  revalidatePath("/dashboard/commandes");
  revalidatePath("/profil");
  revalidatePath("/profil/commandes");
  revalidatePath("/profil/documents");
  redirect("/dashboard/livraisons?saved=1");
}
