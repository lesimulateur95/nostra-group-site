"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { MEMBER_ROLE_OPTIONS } from "@/lib/member-roles/data";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 100): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");
  return supabase;
}

export async function updateMemberRoles(formData: FormData) {
  const userId = text(formData.get("user_id"), 80);
  const selected = formData
    .getAll("roles")
    .map((value) => text(value, 40).toLowerCase())
    .filter((value) =>
      MEMBER_ROLE_OPTIONS.includes(
        value as (typeof MEMBER_ROLE_OPTIONS)[number],
      ),
    );

  if (!userId) redirect("/dashboard/membres?error=invalid");
  if (!selected.includes("citizen")) selected.unshift("citizen");

  const supabase = await requireManager();
  const { error } = await (supabase as any).rpc("update_member_roles_v114", {
    p_user_id: userId,
    p_roles: selected,
  });

  if (error) {
    const value = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
    const code = value.includes("pgrst202")
      ? "setup"
      : value.includes("member_not_found")
        ? "member"
        : "save";
    redirect(`/dashboard/membres?error=${code}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/membres");
  revalidatePath("/profil");
  redirect("/dashboard/membres?saved=1");
}
