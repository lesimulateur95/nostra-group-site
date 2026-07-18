"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isManager } from "@/lib/auth/user-profile";
import {
  EDITABLE_PAGE_SLUGS,
  getEditablePageRoute,
} from "@/lib/content/site-content";
import { createClient } from "@/lib/supabase/server";

function normalize(value: FormDataEntryValue | null, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, maxLength);
}

export async function saveSitePage(formData: FormData) {
  const slug = normalize(formData.get("slug"), 80);
  const title = normalize(formData.get("title"), 120);
  const content = normalize(formData.get("content"), 30000);

  if (!EDITABLE_PAGE_SLUGS.has(slug) || title.length < 2 || content.length < 2) {
    redirect("/dashboard?error=invalid_content");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!isManager(data.user)) redirect("/accueil");

  const { error } = await supabase.from("site_pages").upsert(
    {
      slug,
      title,
      content,
      updated_by: data.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  );

  if (error) redirect("/dashboard?error=save_failed");

  revalidatePath(getEditablePageRoute(slug));
  revalidatePath("/dashboard");
  redirect(`/dashboard?saved=${encodeURIComponent(slug)}`);
}

export async function restoreDefaultSitePage(formData: FormData) {
  const slug = normalize(formData.get("slug"), 80);
  if (!EDITABLE_PAGE_SLUGS.has(slug)) redirect("/dashboard?error=invalid_content");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!isManager(data.user)) redirect("/accueil");

  const { error } = await supabase.from("site_pages").delete().eq("slug", slug);
  if (error) redirect("/dashboard?error=save_failed");

  revalidatePath(getEditablePageRoute(slug));
  revalidatePath("/dashboard");
  redirect(`/dashboard?restored=${encodeURIComponent(slug)}`);
}
