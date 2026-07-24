"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function positiveId(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") return 0;
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

export async function deleteSavTicketV74(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const id = positiveId(formData.get("id"));
  if (!id) {
    redirect("/dashboard/sav?error=invalid-id");
  }

  const { error } = await supabase.rpc("nostra_delete_sav_ticket_v74", {
    p_id: id,
  });

  if (error) {
    redirect(
      "/dashboard/sav?error=" +
        encodeURIComponent(error.message || "delete-failed"),
    );
  }

  revalidatePath("/dashboard/sav");
  revalidatePath("/motors/sav");
  redirect("/dashboard/sav?deleted=1");
}
