"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { parisLocalDateTimeToIso } from "@/lib/dates/paris";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 40), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireMotorsStaff() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.some((role) => ["manager", "employee", "commercial"].includes(role))) {
    redirect("/accueil");
  }
  return supabase;
}

function revalidateReservations() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reservations-vehicules");
  revalidatePath("/dashboard/commandes");
  revalidatePath("/profil");
  revalidatePath("/profil/reservations-vehicules");
  revalidatePath("/profil/commandes");
}

export async function updateVehicleReservationFollowUp(formData: FormData) {
  const reservationId = integer(formData.get("reservation_id"));
  const nextStatus = text(formData.get("status"), 30) || null;
  const allowed = new Set(["paid_full", "preparing", "ready", "completed"]);

  if (reservationId <= 0 || (nextStatus && !allowed.has(nextStatus))) {
    redirect("/dashboard/reservations-vehicules?error=invalid");
  }

  const supabase = await requireMotorsStaff();
  const { error } = await (supabase as any).rpc(
    "update_vehicle_reservation_followup_v96",
    {
      p_reservation_id: reservationId,
      p_status: nextStatus,
      p_assigned_staff: text(formData.get("assigned_staff"), 180) || null,
      p_payment_due_at: parisLocalDateTimeToIso(
        text(formData.get("payment_due_at"), 40),
      ),
      p_admin_note: text(formData.get("admin_note"), 3000) || null,
      p_internal_note: text(formData.get("internal_note"), 5000) || null,
    },
  );

  if (error) {
    const value = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
    const code = value.includes("reservation_status_locked")
      ? "status"
      : value.includes("pgrst202") || value.includes("followup_v96")
        ? "setup-v96"
        : "save";
    redirect(`/dashboard/reservations-vehicules?error=${code}`);
  }

  revalidateReservations();
  redirect("/dashboard/reservations-vehicules?followup_saved=1");
}
