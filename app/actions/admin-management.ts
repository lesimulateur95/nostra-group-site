"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasDashboardAccess, isRoleKey } from "@/lib/auth/access";
import { BUILT_IN_CIRCUIT_CATEGORIES } from "@/lib/content/circuit-navigation";
import { EDITABLE_PAGE_SLUGS } from "@/lib/content/site-content";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null, max = 5000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = Number.parseInt(text(value, 30), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

async function requireDashboardAccess() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!(await hasDashboardAccess(data.user))) redirect("/accueil");
  return { supabase, user: data.user };
}

export async function saveCustomCircuitPage(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const label = text(formData.get("label"), 100);
  const title = text(formData.get("title"), 120);
  const content = text(formData.get("content"), 30000);
  const rawSlug = text(formData.get("slug"), 80);
  const slug = slugify(rawSlug || label || title);
  const categoryKeyInput = slugify(text(formData.get("category_key"), 80));
  const categoryLabelInput = text(formData.get("category_label"), 100);
  const sortOrder = Math.max(0, integer(formData.get("sort_order"), 100));
  const visible = formData.get("visible") === "on";

  if (label.length < 2 || title.length < 2 || content.length < 2 || slug.length < 2) {
    redirect("/dashboard/contenu?error=custom_invalid#custom-pages");
  }

  const builtCategory = BUILT_IN_CIRCUIT_CATEGORIES.find((category) => category.key === categoryKeyInput);
  const categoryKey = builtCategory?.key || categoryKeyInput || "pages-personnalisees";
  const categoryLabel = builtCategory?.label || categoryLabelInput || "Pages personnalisées";

  const { supabase, user } = await requireDashboardAccess();
  const payload = {
    category_key: categoryKey,
    category_label: categoryLabel,
    slug,
    label,
    title,
    content,
    sort_order: sortOrder,
    visible,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const result = id > 0
    ? await supabase.from("custom_circuit_pages").update(payload).eq("id", id)
    : await supabase.from("custom_circuit_pages").insert({ ...payload, created_by: user.id });

  if (result.error) redirect("/dashboard/contenu?error=custom_save#custom-pages");
  revalidatePath("/circuit", "layout");
  revalidatePath(`/circuit/personnalise/${slug}`);
  revalidatePath("/dashboard/contenu");
  redirect("/dashboard/contenu?custom_saved=1#custom-pages");
}

export async function deleteCustomCircuitPage(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const { supabase } = await requireDashboardAccess();
  if (id > 0) {
    const { data } = await supabase.from("custom_circuit_pages").select("slug").eq("id", id).maybeSingle();
    await supabase.from("custom_circuit_pages").delete().eq("id", id);
    if (data?.slug) revalidatePath(`/circuit/personnalise/${data.slug}`);
  }
  revalidatePath("/circuit", "layout");
  revalidatePath("/dashboard/contenu");
  redirect("/dashboard/contenu?custom_deleted=1#custom-pages");
}

export async function setBuiltInCircuitPageVisibility(formData: FormData) {
  const pageKey = text(formData.get("page_key"), 100);
  const hidden = text(formData.get("hidden"), 10) === "true";
  if (!EDITABLE_PAGE_SLUGS.has(pageKey)) redirect("/dashboard/contenu?error=visibility");

  const { supabase, user } = await requireDashboardAccess();
  if (hidden) {
    const { error } = await supabase.from("hidden_circuit_pages").upsert({
      page_key: pageKey,
      hidden_at: new Date().toISOString(),
      hidden_by: user.id,
    }, { onConflict: "page_key" });
    if (error) redirect("/dashboard/contenu?error=visibility");
  } else {
    const { error } = await supabase.from("hidden_circuit_pages").delete().eq("page_key", pageKey);
    if (error) redirect("/dashboard/contenu?error=visibility");
  }

  revalidatePath("/circuit", "layout");
  revalidatePath("/dashboard/contenu");
  redirect(`/dashboard/contenu?visibility_saved=1#page-${encodeURIComponent(pageKey)}`);
}

export async function updateMemberRole(formData: FormData) {
  const userId = text(formData.get("user_id"), 80);
  const role = text(formData.get("role"), 30);
  if (!userId || !isRoleKey(role)) redirect("/dashboard/membres?error=invalid");

  const { supabase } = await requireDashboardAccess();
  const { data: profile } = await supabase.from("member_profiles").select("discord_id").eq("user_id", userId).maybeSingle();
  const finalRole = profile?.discord_id === "331843410962939908" ? "manager" : role;
  const { error } = await supabase.from("member_profiles").update({ role: finalRole, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) redirect("/dashboard/membres?error=save");

  revalidatePath("/dashboard/membres");
  revalidatePath("/profil");
  redirect("/dashboard/membres?saved=1");
}
