"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAvatarUrl, getDiscordId, getDiscordName } from "@/lib/auth/user-profile";
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

  // Synchronisation de l’espace membres. Cette partie est ignorée tant que le nouveau SQL n’est pas installé.
  await supabase.from("member_profiles").upsert({
    user_id: userData.user.id,
    discord_id: getDiscordId(userData.user),
    discord_name: getDiscordName(userData.user),
    email: userData.user.email ?? null,
    avatar_url: getAvatarUrl(userData.user),
    rp_first_name: firstName,
    rp_last_name: lastName,
    role: getDiscordId(userData.user) === "331843410962939908" ? "manager" : undefined,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  revalidatePath("/profil");
  revalidatePath("/dashboard/membres");
  redirect("/accueil");
}
