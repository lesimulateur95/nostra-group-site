"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function normalizeName(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function isValidRpName(value: string): boolean {
  return value.length >= 2 && value.length <= 32 && /^[\p{L}][\p{L}\p{M}' -]*$/u.test(value);
}

export async function saveRpProfile(formData: FormData) {
  const firstName = normalizeName(formData.get("rp_first_name"));
  const lastName = normalizeName(formData.get("rp_last_name"));

  if (!isValidRpName(firstName) || !isValidRpName(lastName)) {
    redirect("/profil?error=invalid_name");
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/");

  const { error } = await supabase.auth.updateUser({
    data: {
      rp_first_name: firstName,
      rp_last_name: lastName,
      profile_completed: true,
    },
  });

  if (error) redirect("/profil?error=save_failed");
  redirect("/accueil");
}
