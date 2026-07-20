"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getAvatarUrl,
  getDiscordId,
  getDiscordName,
} from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

function normalizeName(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function normalizeText(
  value: FormDataEntryValue | null,
  maxLength: number,
): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\r\n/g, "\n").slice(0, maxLength);
}

function isValidRpName(value: string): boolean {
  return (
    value.length >= 2 &&
    value.length <= 32 &&
    /^[\p{L}][\p{L}\p{M}' -]*$/u.test(value)
  );
}

function isValidPhone(value: string): boolean {
  return (
    value.length === 0 ||
    (value.length >= 3 &&
      value.length <= 40 &&
      /^[0-9+().\s-]+$/.test(value))
  );
}

export async function saveRpProfile(formData: FormData) {
  const firstName = normalizeName(formData.get("rp_first_name"));
  const lastName = normalizeName(formData.get("rp_last_name"));
  const phone = normalizeText(formData.get("phone"), 40);
  const address = normalizeText(formData.get("address"), 500);

  if (!isValidRpName(firstName) || !isValidRpName(lastName)) {
    redirect("/profil?error=invalid_name");
  }

  if (!isValidPhone(phone)) {
    redirect("/profil?error=invalid_phone");
  }

  if (address.length > 0 && address.length < 5) {
    redirect("/profil?error=invalid_address");
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/");

  const { error } = await supabase.auth.updateUser({
    data: {
      rp_first_name: firstName,
      rp_last_name: lastName,
      phone,
      address,
      profile_completed: true,
    },
  });

  if (error) redirect("/profil?error=save_failed");

  const discordId = getDiscordId(userData.user);

  const profileSync = await supabase.from("member_profiles").upsert(
    {
      user_id: userData.user.id,
      discord_id: discordId,
      discord_name: getDiscordName(userData.user),
      email: userData.user.email ?? null,
      avatar_url: getAvatarUrl(userData.user),
      rp_first_name: firstName,
      rp_last_name: lastName,
      phone: phone || null,
      address: address || null,
      role: discordId === "331843410962939908" ? "manager" : undefined,
      roles:
        discordId === "331843410962939908" ? ["manager"] : undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (
    profileSync.error &&
    (profileSync.error.code === "42703" ||
      profileSync.error.code === "PGRST204")
  ) {
    redirect("/profil?error=profile_setup");
  }

  revalidatePath("/profil");
  revalidatePath("/dashboard/membres");
  redirect("/profil?profile_saved=1");
}
