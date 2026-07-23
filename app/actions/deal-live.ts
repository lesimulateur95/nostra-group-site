"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const DASHBOARD_PATH = "/dashboard/jeux/a-prendre-ou-a-laisser";
const PUBLIC_PATH = "/evenements/a-prendre-ou-a-laisser";

function formText(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

async function requireManager() {
  const supabase = await createClient();
  const authResult = await supabase.auth.getUser();

  if (!authResult.data.user) {
    redirect("/");
  }

  const roles = await getUserRoleKeys(authResult.data.user);
  if (!roles.includes("manager")) {
    redirect("/accueil");
  }

  return supabase;
}

function refreshDealLive() {
  revalidatePath(DASHBOARD_PATH);
  revalidatePath(PUBLIC_PATH);
  revalidatePath("/evenements");
  revalidatePath("/dashboard");
}

function errorCode(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("no_open_edition")) return "edition";
  if (normalized.includes("profile_name_required")) return "profile";
  if (normalized.includes("invalid_citizen")) return "citizen";
  if (normalized.includes("manager_required")) return "access";
  return "save";
}

export async function launchDealGameForCitizen(formData: FormData) {
  const citizenId = formText(formData, "citizen_id");
  if (!citizenId) {
    redirect(`${DASHBOARD_PATH}?live_error=citizen`);
  }

  const supabase = await requireManager();
  const { error } = await supabase.rpc(
    "nostra_launch_deal_game_for_citizen",
    { p_user_id: citizenId },
  );

  if (error) {
    redirect(
      `${DASHBOARD_PATH}?live_error=${errorCode(error.message ?? "")}`,
    );
  }

  refreshDealLive();
  redirect(`${DASHBOARD_PATH}?live_started=1`);
}

export async function endDealLiveGame() {
  const supabase = await requireManager();
  const { error } = await supabase.rpc("nostra_end_deal_live_game");

  if (error) {
    redirect(
      `${DASHBOARD_PATH}?live_error=${errorCode(error.message ?? "")}`,
    );
  }

  refreshDealLive();
  redirect(`${DASHBOARD_PATH}?live_stopped=1`);
}
