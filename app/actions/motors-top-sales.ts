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

  return { supabase, user: data.user };
}

function revalidateTopSales() {
  revalidatePath("/accueil");
  revalidatePath("/motors/top-ventes");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/top-ventes");
}

export async function addTopSaleVehicle(formData: FormData) {
  const { supabase, user } = await requireManager();
  const vehicleId = field(formData, "vehicle_id");

  if (!vehicleId) {
    redirect("/dashboard/top-ventes?error=vehicle");
  }

  const { error } = await (supabase as any)
    .from("motors_top_sales")
    .upsert(
      {
        vehicle_id: vehicleId,
        created_by: user.id,
      },
      {
        onConflict: "vehicle_id",
        ignoreDuplicates: true,
      },
    );

  if (error) {
    redirect("/dashboard/top-ventes?error=database");
  }

  revalidateTopSales();
  redirect("/dashboard/top-ventes?added=1");
}

export async function deleteTopSaleVehicle(formData: FormData) {
  const { supabase } = await requireManager();
  const announcementId = field(formData, "announcement_id");

  if (!announcementId) {
    redirect("/dashboard/top-ventes?error=invalid");
  }

  const { error } = await (supabase as any)
    .from("motors_top_sales")
    .delete()
    .eq("id", announcementId);

  if (error) {
    redirect("/dashboard/top-ventes?error=database");
  }

  revalidateTopSales();
  redirect("/dashboard/top-ventes?deleted=1");
}
