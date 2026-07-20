
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(
  value: FormDataEntryValue | null,
  maxLength: number,
): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function integer(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  return supabase;
}

export async function saveHomeReview(formData: FormData) {
  const rating = integer(formData.get("rating"));
  const title = text(formData.get("title"), 120);
  const comment = text(formData.get("comment"), 1500);

  if (
    rating < 1 ||
    rating > 5 ||
    comment.length < 10
  ) {
    redirect("/accueil?review_error=invalid#avis-clients");
  }

  const supabase = await requireUser();
  const { error } = await supabase.rpc(
    "nostra_upsert_home_review",
    {
      p_rating: rating,
      p_title: title || null,
      p_comment: comment,
    },
  );

  if (error) {
    redirect("/accueil?review_error=save#avis-clients");
  }

  revalidatePath("/accueil");
  redirect("/accueil?review_saved=1#avis-clients");
}

export async function deleteMyHomeReview() {
  const supabase = await requireUser();
  const { error } = await supabase.rpc(
    "nostra_delete_my_home_review",
  );

  if (error) {
    redirect("/accueil?review_error=delete#avis-clients");
  }

  revalidatePath("/accueil");
  redirect("/accueil?review_deleted=1#avis-clients");
}
