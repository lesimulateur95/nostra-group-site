"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasDashboardAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(typeof value === "string" ? value : "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value: FormDataEntryValue | null): boolean {
  return value === "1" || value === "true" || value === "on";
}


function withResultParam(url: string, key: string, value: string): string {
  const [base, hash] = url.split("#", 2);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
}

function safeReturnTo(value: FormDataEntryValue | null, vehicleId: number): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw.startsWith("/dashboard/catalogue")) return raw;
  return `/dashboard/catalogue?type=all#vehicule-${vehicleId}`;
}

export async function setVehicleShowroomVisibility(formData: FormData) {
  const vehicleId = integer(formData.get("vehicle_id"));
  const visible = booleanValue(formData.get("visible"));
  const returnTo = safeReturnTo(formData.get("return_to"), vehicleId);

  if (vehicleId <= 0) redirect(withResultParam(returnTo, "showroom_error", "invalid"));

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");
  if (!(await hasDashboardAccess(data.user))) redirect("/accueil");

  const { data: result, error } = await supabase.rpc("set_vehicle_showroom_v152", {
    p_vehicle_id: vehicleId,
    p_visible: visible,
  });

  if (error) {
    const code = /function|does not exist|showroom_visible/i.test(error.message ?? "")
      ? "setup"
      : /forbidden/i.test(error.message ?? "")
        ? "forbidden"
        : "save";
    redirect(withResultParam(returnTo, "showroom_error", code));
  }

  if (!result) {
    redirect(withResultParam(returnTo, "showroom_error", "not-found"));
  }

  revalidatePath("/dashboard/catalogue");
  revalidatePath("/motors/showroom");
  revalidatePath("/motors");

  redirect(withResultParam(returnTo, "showroom_saved", visible ? "added" : "removed"));
}
