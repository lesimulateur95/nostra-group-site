"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function deleteOwnProfileDocument(formData: FormData) {
  const rawId = formData.get("document_id");
  const documentId =
    typeof rawId === "string" ? Number.parseInt(rawId, 10) : Number.NaN;

  if (!Number.isFinite(documentId) || documentId <= 0) {
    throw new Error("Document invalide.");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/");

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", documentId)
    .eq("user_id", data.user.id);

  if (error) {
    throw new Error("Le document n’a pas pu être supprimé.");
  }

  revalidatePath("/profil/documents");
}
