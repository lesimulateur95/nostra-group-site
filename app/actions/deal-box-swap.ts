"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_PATH = "/evenements/a-prendre-ou-a-laisser";
const MANAGER_PATH =
  "/dashboard/jeux/a-prendre-ou-a-laisser";

export type DealBoxSwapActionResult = {
  ok: boolean;
  error?: string;
};

function clean(
  value: FormDataEntryValue | null,
  max = 100,
): string {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function errorCode(error: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null): string {
  const value = `${error?.message ?? ""} ${
    error?.details ?? ""
  } ${error?.hint ?? ""}`.toLowerCase();

  if (value.includes("manager_required")) return "manager";
  if (value.includes("swap_already_pending")) return "pending";
  if (value.includes("session_not_playing")) return "status";
  if (value.includes("invalid_box")) return "box";
  if (value.includes("swap_not_found")) return "missing";
  if (value.includes("swap_not_choosing")) return "choice";
  if (value.includes("not_authenticated")) return "auth";

  return "save";
}

function refreshDealPages() {
  revalidatePath(PUBLIC_PATH);
  revalidatePath(MANAGER_PATH);
  revalidatePath("/dashboard");
}

async function requireManager() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  return supabase;
}

export async function triggerDealBoxSwap(
  formData: FormData,
) {
  const sessionId = clean(formData.get("session_id"), 80);

  if (!sessionId) {
    redirect(`${MANAGER_PATH}?swap_error=session`);
  }

  const supabase = await requireManager();

  const { error } = await (supabase as any).rpc(
    "nostra_trigger_deal_box_swap",
    {
      p_session_id: sessionId,
    },
  );

  if (error) {
    redirect(
      `${MANAGER_PATH}?swap_error=${errorCode(error)}`,
    );
  }

  refreshDealPages();
  redirect(`${MANAGER_PATH}?swap_called=1`);
}

export async function answerDealBoxSwap(
  decision: "keep" | "change",
): Promise<DealBoxSwapActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return { ok: false, error: "auth" };
  }

  const { error } = await (supabase as any).rpc(
    "nostra_answer_deal_box_swap",
    {
      p_decision: decision,
    },
  );

  if (error) {
    return {
      ok: false,
      error: errorCode(error),
    };
  }

  refreshDealPages();
  return { ok: true };
}

export async function chooseNewDealBox(
  boxNumber: number,
): Promise<DealBoxSwapActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return { ok: false, error: "auth" };
  }

  const { error } = await (supabase as any).rpc(
    "nostra_choose_new_deal_box",
    {
      p_box_number: boxNumber,
    },
  );

  if (error) {
    return {
      ok: false,
      error: errorCode(error),
    };
  }

  refreshDealPages();
  return { ok: true };
}
