"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  return { supabase, user: data.user };
}

function refreshBadgePages() {
  revalidatePath("/dashboard/badges");
  revalidatePath("/dashboard/citoyens");
  revalidatePath("/profil");
  revalidatePath("/profil/badges");
}

export async function createProfileBadgeAction(formData: FormData) {
  const { supabase } = await requireManager();
  const label = clean(formData.get("label"), 80);
  const description = clean(formData.get("description"), 240);
  const icon = clean(formData.get("icon"), 12) || "🏅";
  const category = clean(formData.get("category"), 50) || "Général";
  const codeInput = clean(formData.get("code"), 60).toLowerCase();
  const code = (codeInput || label)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

  if (label.length < 2 || code.length < 2) return;

  await supabase.from("profile_badge_catalog").upsert(
    {
      code,
      label,
      description,
      icon,
      category,
      is_active: true,
    },
    { onConflict: "code" },
  );

  refreshBadgePages();
}

export async function grantProfileBadgeAction(formData: FormData) {
  const { supabase } = await requireManager();
  const userId = clean(formData.get("user_id"), 80);
  const badgeId = clean(formData.get("badge_id"), 80);
  const note = clean(formData.get("note"), 300);

  if (!userId || !badgeId) return;

  await supabase.rpc("grant_profile_badge", {
    p_user_id: userId,
    p_badge_id: badgeId,
    p_note: note || null,
  });

  refreshBadgePages();
}

export async function revokeProfileBadgeAction(formData: FormData) {
  const { supabase } = await requireManager();
  const userId = clean(formData.get("user_id"), 80);
  const badgeId = clean(formData.get("badge_id"), 80);

  if (!userId || !badgeId) return;

  await supabase.rpc("revoke_profile_badge", {
    p_user_id: userId,
    p_badge_id: badgeId,
  });

  refreshBadgePages();
}

export async function refreshAutomaticProfileBadgesAction() {
  const { supabase } = await requireManager();
  await supabase.rpc("refresh_all_profile_badges");
  refreshBadgePages();
}
