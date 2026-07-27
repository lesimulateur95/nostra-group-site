"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { parisLocalDateTimeToIso } from "@/lib/dates/paris";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt(text(value, 40), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function recruitmentError(error: { message?: string | null; code?: string | null } | null | undefined) {
  const value = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (value.includes("application_already_active")) return "already-active";
  if (value.includes("interview_date_required")) return "interview-date";
  if (value.includes("invalid_application")) return "invalid";
  if (value.includes("forbidden")) return "forbidden";
  if (value.includes("pgrst202") || value.includes("recruitment_applications")) {
    return "setup";
  }
  return "save";
}

async function requireRecruitmentManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/dashboard");
  return { supabase, user: data.user };
}

function revalidateRecruitment() {
  revalidatePath("/recrutement");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/recrutement/candidatures");
  revalidatePath("/dashboard/recrutement/annonce-discord");
}

export async function submitRecruitmentApplication(formData: FormData) {
  const position = text(formData.get("position"), 160);
  const availability = text(formData.get("availability"), 1000);
  const motivation = text(formData.get("motivation"), 5000);

  if (!position || availability.length < 3 || motivation.length < 20) {
    redirect("/recrutement?error=invalid");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const metadata = data.user.user_metadata ?? {};
  const candidateName =
    text(formData.get("candidate_name"), 180) ||
    getRpName(data.user) ||
    getDiscordName(data.user) ||
    "Candidat Nostra Group";
  const discordName =
    text(formData.get("discord_name"), 180) || getDiscordName(data.user) || null;
  const phone =
    text(formData.get("phone"), 80) ||
    (typeof metadata.phone === "string" ? metadata.phone.trim() : "") ||
    null;

  const { data: result, error } = await (supabase as any).rpc(
    "submit_recruitment_application_v96",
    {
      p_candidate_name: candidateName,
      p_discord_name: discordName,
      p_phone: phone,
      p_position: position,
      p_availability: availability,
      p_motivation: motivation,
      p_experience: text(formData.get("experience"), 5000) || null,
      p_strengths: text(formData.get("strengths"), 3000) || null,
    },
  );

  if (error) {
    redirect(`/recrutement?error=${recruitmentError(error)}`);
  }

  const response =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const number =
    typeof response.application_number === "string"
      ? response.application_number
      : "envoyée";

  revalidateRecruitment();
  redirect(`/recrutement?sent=${encodeURIComponent(number)}`);
}

export async function reviewRecruitmentApplication(formData: FormData) {
  const applicationId = integer(formData.get("application_id"));
  const status = text(formData.get("status"), 30);
  const allowed = new Set([
    "new",
    "reviewing",
    "interview",
    "accepted",
    "refused",
    "archived",
  ]);

  if (applicationId <= 0 || !allowed.has(status)) {
    redirect("/dashboard/recrutement/candidatures?error=invalid");
  }

  const { supabase } = await requireRecruitmentManager();
  const interviewAt = parisLocalDateTimeToIso(
    text(formData.get("interview_at"), 40),
  );
  if (status === "interview" && !interviewAt) {
    redirect(
      "/dashboard/recrutement/candidatures?error=interview-date",
    );
  }

  const { error } = await (supabase as any).rpc(
    "review_recruitment_application_v96",
    {
      p_application_id: applicationId,
      p_status: status,
      p_assigned_to: text(formData.get("assigned_to"), 180) || null,
      p_interview_at: interviewAt,
      p_internal_notes: text(formData.get("internal_notes"), 5000) || null,
      p_manager_response: text(formData.get("manager_response"), 5000) || null,
      p_history_note: text(formData.get("history_note"), 2000) || null,
    },
  );

  if (error) {
    redirect(
      `/dashboard/recrutement/candidatures?error=${recruitmentError(error)}`,
    );
  }

  revalidateRecruitment();
  redirect("/dashboard/recrutement/candidatures?saved=1");
}
