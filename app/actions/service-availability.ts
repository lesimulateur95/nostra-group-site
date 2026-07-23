"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasDashboardAccess } from "@/lib/auth/access";
import {
  isServiceKey,
  SERVICE_DEFINITIONS,
} from "@/lib/system/service-availability";
import { createClient } from "@/lib/supabase/server";

export async function setServiceAvailability(formData: FormData) {
  const serviceKey = formData.get("service_key");
  const isOpen = formData.get("is_open") === "true";

  if (!isServiceKey(serviceKey)) {
    throw new Error("Service Nostra Circuit invalide.");
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/");
  if (!(await hasDashboardAccess(authData.user))) redirect("/accueil");

  const { data, error } = await (supabase as any)
    .from("nostra_service_availability")
    .update({
      is_open: isOpen,
      updated_at: new Date().toISOString(),
      updated_by: authData.user.id,
    })
    .eq("service_key", serviceKey)
    .select("service_key")
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      "Impossible de modifier l’ouverture du service. Vérifie que le SQL V54 a bien été exécuté.",
    );
  }

  revalidatePath(SERVICE_DEFINITIONS[serviceKey].publicPath);
  revalidatePath("/dashboard/licences-pilotes");
  revalidatePath("/dashboard/homologations");
  revalidatePath("/dashboard/inscriptions-ecuries");
}
