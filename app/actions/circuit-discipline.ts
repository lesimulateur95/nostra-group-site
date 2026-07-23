"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const DISCIPLINE_PATH = "/commissaires/sanctions-disciplinaires";

function text(value: FormDataEntryValue | null, max = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function numberValue(value: FormDataEntryValue | null): number {
  const parsed = Number(typeof value === "string" ? value : 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: FormDataEntryValue | null): string | null {
  const result = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : null;
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  return { supabase, user: data.user };
}

function revalidateDisciplinePages() {
  revalidatePath(DISCIPLINE_PATH);
  revalidatePath("/commissaires");
  revalidatePath("/dashboard");
  revalidatePath("/profil");
  revalidatePath("/profil/discipline");
  revalidatePath("/profil/licences");
}

function rpcErrorCode(error: unknown): string {
  const candidate = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const message = `${candidate?.code ?? ""} ${candidate?.message ?? ""} ${candidate?.details ?? ""} ${candidate?.hint ?? ""}`.toLowerCase();

  if (message.includes("licence_not_found")) return "licence";
  if (message.includes("invalid_points")) return "points";
  if (message.includes("invalid_suspension_dates")) return "dates";
  if (message.includes("reason_required")) return "reason";
  if (message.includes("manager_required")) return "permission";
  if (message.includes("not_found")) return "missing";
  return "save";
}

export async function createCircuitDisciplinaryAction(formData: FormData) {
  const { supabase } = await requireManager();

  const licenceId = text(formData.get("licence_id"), 120);
  const actionType = text(formData.get("action_type"), 40);
  const severity = text(formData.get("severity"), 20) || "minor";
  const reason = text(formData.get("reason"), 2000);
  const eventName = text(formData.get("event_name"), 160);
  const note = text(formData.get("note"), 3000);
  const penaltyAmount = Math.max(0, numberValue(formData.get("penalty_amount")));
  const pointsRemoved = Math.trunc(
    Math.max(0, numberValue(formData.get("points_removed"))),
  );
  const suspensionStartsOn = dateValue(formData.get("suspension_starts_on"));
  const suspensionEndsOn = dateValue(formData.get("suspension_ends_on"));

  if (!licenceId || reason.length < 3) {
    redirect(`${DISCIPLINE_PATH}?error=invalid`);
  }

  const { data, error } = await (supabase as any).rpc(
    "nostra_create_circuit_disciplinary_action",
    {
      p_licence_id: licenceId,
      p_action_type: actionType,
      p_severity: severity,
      p_reason: reason,
      p_event_name: eventName || null,
      p_note: note || null,
      p_penalty_amount: penaltyAmount,
      p_points_removed: pointsRemoved,
      p_suspension_starts_on: suspensionStartsOn,
      p_suspension_ends_on: suspensionEndsOn,
    },
  );

  if (error) {
    redirect(`${DISCIPLINE_PATH}?error=${rpcErrorCode(error)}`);
  }

  const result = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const caseNumber = String(result.case_number ?? "dossier");

  revalidateDisciplinePages();
  redirect(`${DISCIPLINE_PATH}?success=created&case=${encodeURIComponent(caseNumber)}`);
}

export async function cancelCircuitDisciplinaryAction(formData: FormData) {
  const { supabase } = await requireManager();
  const actionId = Math.trunc(numberValue(formData.get("action_id")));
  const reason = text(formData.get("cancellation_reason"), 2000);

  if (actionId <= 0 || reason.length < 3) {
    redirect(`${DISCIPLINE_PATH}?error=cancel`);
  }

  const { error } = await (supabase as any).rpc(
    "nostra_cancel_circuit_disciplinary_action",
    {
      p_action_id: actionId,
      p_reason: reason,
    },
  );

  if (error) {
    redirect(`${DISCIPLINE_PATH}?error=${rpcErrorCode(error)}`);
  }

  revalidateDisciplinePages();
  redirect(`${DISCIPLINE_PATH}?success=cancelled`);
}

export async function completeCircuitDisciplinaryAction(formData: FormData) {
  const { supabase } = await requireManager();
  const actionId = Math.trunc(numberValue(formData.get("action_id")));
  const reason = text(formData.get("completion_reason"), 2000);

  if (actionId <= 0) {
    redirect(`${DISCIPLINE_PATH}?error=complete`);
  }

  const { error } = await (supabase as any).rpc(
    "nostra_complete_circuit_disciplinary_action",
    {
      p_action_id: actionId,
      p_reason: reason || null,
    },
  );

  if (error) {
    redirect(`${DISCIPLINE_PATH}?error=${rpcErrorCode(error)}`);
  }

  revalidateDisciplinePages();
  redirect(`${DISCIPLINE_PATH}?success=completed`);
}
