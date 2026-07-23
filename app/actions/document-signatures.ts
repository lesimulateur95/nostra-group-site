"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

function textValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function signNostraDocument(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const documentId = textValue(formData.get("document_id"));
  const signerName = textValue(formData.get("signer_name"));
  const consent = formData.get("consent") === "on";

  if (!documentId || !signerName || !consent) {
    const query = new URLSearchParams({
      error: "Le nom et l’acceptation de la signature sont obligatoires.",
    });
    redirect(`/profil/documents/signature/${documentId || "inconnu"}?${query}`);
  }

  const { data: verificationCode, error } = await (supabase as any).rpc(
    "sign_nostra_document",
    {
      p_document_id: documentId,
      p_signer_name: signerName,
      p_consent: consent,
    },
  );

  if (error) {
    const query = new URLSearchParams({ error: error.message });
    redirect(`/profil/documents/signature/${documentId}?${query}`);
  }

  revalidatePath("/profil/documents");
  revalidatePath(`/profil/documents/signature/${documentId}`);
  revalidatePath("/dashboard/documents-signes");

  const query = new URLSearchParams({ signed: "1" });
  if (verificationCode) query.set("code", String(verificationCode));
  redirect(`/profil/documents/signature/${documentId}?${query}`);
}

export async function changeNostraDocumentStatus(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  if (!roles.includes("manager")) redirect("/accueil");

  const documentId = textValue(formData.get("document_id"));
  const status = textValue(formData.get("status"));

  if (!documentId || !["valid", "cancelled"].includes(status)) {
    redirect(
      "/dashboard/documents-signes?error=" +
        encodeURIComponent("Document ou statut invalide."),
    );
  }

  const { error } = await (supabase as any).rpc("set_nostra_document_status", {
    p_document_id: documentId,
    p_status: status,
  });

  if (error) {
    redirect(
      "/dashboard/documents-signes?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/documents-signes");
  revalidatePath("/profil/documents");
  redirect(`/dashboard/documents-signes?updated=${status}`);
}
