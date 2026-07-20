
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type DealActionResult = {
  ok: boolean;
  error?: string;
};

function integer(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(
  value: FormDataEntryValue | null,
  maxLength: number,
): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function errorCode(error: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null): string {
  const value = `${error?.message ?? ""} ${error?.details ?? ""} ${
    error?.hint ?? ""
  }`.toLowerCase();

  if (value.includes("setup")) return "setup";
  if (value.includes("no_open_edition")) return "closed";
  if (value.includes("session_exists")) return "exists";
  if (value.includes("invalid_box")) return "box";
  if (value.includes("banker_call_pending")) return "banker";
  if (value.includes("invalid_session_status")) return "status";
  if (value.includes("not_authenticated")) return "auth";
  return "save";
}

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { supabase, authenticated: false as const };
  }

  return { supabase, authenticated: true as const };
}

export async function startDealGame(): Promise<DealActionResult> {
  const { supabase, authenticated } = await requireUser();
  if (!authenticated) return { ok: false, error: "auth" };

  const { error } = await supabase.rpc("nostra_start_deal_game");
  if (error) return { ok: false, error: errorCode(error) };

  revalidatePath("/evenements/a-prendre-ou-a-laisser");
  return { ok: true };
}

export async function chooseDealBox(
  boxNumber: number,
): Promise<DealActionResult> {
  const { supabase, authenticated } = await requireUser();
  if (!authenticated) return { ok: false, error: "auth" };

  const { error } = await supabase.rpc("nostra_choose_deal_box", {
    p_box_number: boxNumber,
  });
  if (error) return { ok: false, error: errorCode(error) };

  revalidatePath("/evenements/a-prendre-ou-a-laisser");
  return { ok: true };
}

export async function openDealBox(
  boxNumber: number,
): Promise<DealActionResult> {
  const { supabase, authenticated } = await requireUser();
  if (!authenticated) return { ok: false, error: "auth" };

  const { error } = await supabase.rpc("nostra_open_deal_box", {
    p_box_number: boxNumber,
  });
  if (error) return { ok: false, error: errorCode(error) };

  revalidatePath("/evenements/a-prendre-ou-a-laisser");
  revalidatePath("/dashboard/jeux/a-prendre-ou-a-laisser");
  return { ok: true };
}

export async function answerDealBankerOffer(
  decision: "accept" | "decline",
): Promise<DealActionResult> {
  const { supabase, authenticated } = await requireUser();
  if (!authenticated) return { ok: false, error: "auth" };

  const { error } = await supabase.rpc(
    "nostra_answer_deal_banker_offer",
    {
      p_decision: decision,
    },
  );
  if (error) return { ok: false, error: errorCode(error) };

  revalidatePath("/evenements/a-prendre-ou-a-laisser");
  revalidatePath("/dashboard/jeux/a-prendre-ou-a-laisser");
  return { ok: true };
}

export async function createDealEdition(formData: FormData) {
  const title =
    text(formData.get("title"), 120) || "À Prendre ou à Laisser";
  const mode = text(formData.get("mode"), 20);
  const rawPrizes = text(formData.get("prizes"), 8000);

  const prizes = rawPrizes
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 24);

  if (mode !== "random" && prizes.length !== 24) {
    redirect(
      "/dashboard/jeux/a-prendre-ou-a-laisser?error=prizes",
    );
  }

  const { supabase, authenticated } = await requireUser();
  if (!authenticated) redirect("/");

  const { error } = await supabase.rpc(
    "nostra_create_deal_edition",
    {
      p_title: title,
      p_prizes: mode === "random" ? null : prizes,
      p_use_random: mode === "random",
    },
  );

  if (error) {
    redirect(
      `/dashboard/jeux/a-prendre-ou-a-laisser?error=${errorCode(
        error,
      )}`,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/jeux/a-prendre-ou-a-laisser");
  revalidatePath("/evenements/a-prendre-ou-a-laisser");
  redirect(
    "/dashboard/jeux/a-prendre-ou-a-laisser?created=1",
  );
}

export async function triggerDealBankerCall(formData: FormData) {
  const sessionId = text(formData.get("session_id"), 80);
  const offer = text(formData.get("offer"), 500);

  if (!sessionId || offer.length < 2) {
    redirect(
      "/dashboard/jeux/a-prendre-ou-a-laisser?error=offer",
    );
  }

  const { supabase, authenticated } = await requireUser();
  if (!authenticated) redirect("/");

  const { error } = await supabase.rpc(
    "nostra_trigger_deal_banker_call",
    {
      p_session_id: sessionId,
      p_offer_text: offer,
    },
  );

  if (error) {
    redirect(
      `/dashboard/jeux/a-prendre-ou-a-laisser?error=${errorCode(
        error,
      )}`,
    );
  }

  revalidatePath("/dashboard/jeux/a-prendre-ou-a-laisser");
  revalidatePath("/evenements/a-prendre-ou-a-laisser");
  redirect(
    "/dashboard/jeux/a-prendre-ou-a-laisser?called=1",
  );
}

export async function stopDealSession(formData: FormData) {
  const sessionId = text(formData.get("session_id"), 80);
  if (!sessionId) {
    redirect(
      "/dashboard/jeux/a-prendre-ou-a-laisser?error=session",
    );
  }

  const { supabase, authenticated } = await requireUser();
  if (!authenticated) redirect("/");

  const { error } = await supabase.rpc(
    "nostra_stop_deal_session",
    {
      p_session_id: sessionId,
    },
  );

  if (error) {
    redirect(
      `/dashboard/jeux/a-prendre-ou-a-laisser?error=${errorCode(
        error,
      )}`,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/jeux/a-prendre-ou-a-laisser");
  revalidatePath("/evenements/a-prendre-ou-a-laisser");
  redirect(
    "/dashboard/jeux/a-prendre-ou-a-laisser?stopped=1",
  );
}

export async function closeDealEdition() {
  const { supabase, authenticated } = await requireUser();
  if (!authenticated) redirect("/");

  const { error } = await supabase.rpc(
    "nostra_close_deal_edition",
  );

  if (error) {
    redirect(
      `/dashboard/jeux/a-prendre-ou-a-laisser?error=${errorCode(
        error,
      )}`,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/jeux/a-prendre-ou-a-laisser");
  revalidatePath("/evenements/a-prendre-ou-a-laisser");
  redirect(
    "/dashboard/jeux/a-prendre-ou-a-laisser?closed=1",
  );
}
