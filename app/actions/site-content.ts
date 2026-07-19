"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasDashboardAccess } from "@/lib/auth/access";
import {
  EDITABLE_PAGE_SLUGS,
  getEditablePageDashboardRoute,
  getEditablePageRoute,
  getEditablePageSection,
} from "@/lib/content/site-content";
import { createClient } from "@/lib/supabase/server";

function normalize(value: FormDataEntryValue | null, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n/g, "\n").trim().slice(0, maxLength);
}

async function requireEditorAccess() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!(await hasDashboardAccess(data.user))) redirect("/accueil");
  return { supabase, user: data.user };
}

function revalidateSiteSection(slug: string) {
  const section = getEditablePageSection(slug);
  revalidatePath(getEditablePageRoute(slug));
  revalidatePath(`/${section === "evenements" ? "evenements" : section}`, "layout");
  revalidatePath(getEditablePageDashboardRoute(slug));
  revalidatePath("/dashboard/contenu");
}

export async function saveSitePage(formData: FormData) {
  const slug = normalize(formData.get("slug"), 80);
  const title = normalize(formData.get("title"), 120);
  const content = normalize(formData.get("content"), 30000);
  const dashboardRoute = getEditablePageDashboardRoute(slug);

  if (!EDITABLE_PAGE_SLUGS.has(slug) || title.length < 2 || content.length < 2) {
    redirect(`${dashboardRoute}?error=invalid_content#page-${encodeURIComponent(slug)}`);
  }

  const { supabase, user } = await requireEditorAccess();
  const { error } = await supabase.from("site_pages").upsert(
    { slug, title, content, updated_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: "slug" },
  );

  if (error) redirect(`${dashboardRoute}?error=save_failed#page-${encodeURIComponent(slug)}`);
  revalidateSiteSection(slug);
  redirect(`${dashboardRoute}?saved=${encodeURIComponent(slug)}#page-${encodeURIComponent(slug)}`);
}

export async function restoreDefaultSitePage(formData: FormData) {
  const slug = normalize(formData.get("slug"), 80);
  const dashboardRoute = getEditablePageDashboardRoute(slug);
  if (!EDITABLE_PAGE_SLUGS.has(slug)) redirect(`${dashboardRoute}?error=invalid_content`);

  const { supabase } = await requireEditorAccess();
  const { error } = await supabase.from("site_pages").delete().eq("slug", slug);
  if (error) redirect(`${dashboardRoute}?error=save_failed#page-${encodeURIComponent(slug)}`);

  revalidateSiteSection(slug);
  redirect(`${dashboardRoute}?restored=${encodeURIComponent(slug)}#page-${encodeURIComponent(slug)}`);
}
