"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasDashboardAccess, isRoleKey } from "@/lib/auth/access";
import { BUILT_IN_CIRCUIT_CATEGORIES } from "@/lib/content/circuit-navigation";
import {
  EDITABLE_PAGE_SLUGS,
  type EditableSiteSection,
} from "@/lib/content/site-content";
import {
  BUILT_IN_SECTION_CATEGORIES,
  type CustomPageSection,
} from "@/lib/content/section-navigation";
import { createClient } from "@/lib/supabase/server";
import { navigationOrderSlug, normalizeNavigationOrder } from "@/lib/content/navigation-order";

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

  if (
    label.length < 2 ||
    title.length < 2 ||
    content.length < 2 ||
    slug.length < 2
  ) {
    redirect("/dashboard/contenu/circuit?error=custom_invalid#custom-pages");
  }

  const builtCategory = BUILT_IN_CIRCUIT_CATEGORIES.find(
    (category) => category.key === categoryKeyInput,
  );
  const categoryKey =
    builtCategory?.key || categoryKeyInput || "pages-personnalisees";
  const categoryLabel =
    builtCategory?.label || categoryLabelInput || "Pages personnalisées";

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

  const result =
    id > 0
      ? await supabase.from("custom_circuit_pages").update(payload).eq("id", id)
      : await supabase
          .from("custom_circuit_pages")
          .insert({ ...payload, created_by: user.id });

  if (result.error)
    redirect("/dashboard/contenu/circuit?error=custom_save#custom-pages");
  revalidatePath("/circuit", "layout");
  revalidatePath(`/circuit/personnalise/${slug}`);
  revalidatePath("/dashboard/contenu/circuit");
  redirect("/dashboard/contenu/circuit?custom_saved=1#custom-pages");
}

export async function deleteCustomCircuitPage(formData: FormData) {
  const id = integer(formData.get("id"), 0);
  const { supabase } = await requireDashboardAccess();
  if (id > 0) {
    const { data } = await supabase
      .from("custom_circuit_pages")
      .select("slug")
      .eq("id", id)
      .maybeSingle();
    await supabase.from("custom_circuit_pages").delete().eq("id", id);
    if (data?.slug) revalidatePath(`/circuit/personnalise/${data.slug}`);
  }
  revalidatePath("/circuit", "layout");
  revalidatePath("/dashboard/contenu/circuit");
  redirect("/dashboard/contenu/circuit?custom_deleted=1#custom-pages");
}

export async function setBuiltInCircuitPageVisibility(formData: FormData) {
  const pageKey = text(formData.get("page_key"), 100);
  const hidden = text(formData.get("hidden"), 10) === "true";
  if (!EDITABLE_PAGE_SLUGS.has(pageKey))
    redirect("/dashboard/contenu/circuit?error=visibility");

  const { supabase, user } = await requireDashboardAccess();
  if (hidden) {
    const { error } = await supabase.from("hidden_circuit_pages").upsert(
      {
        page_key: pageKey,
        hidden_at: new Date().toISOString(),
        hidden_by: user.id,
      },
      { onConflict: "page_key" },
    );
    if (error) redirect("/dashboard/contenu/circuit?error=visibility");
  } else {
    const { error } = await supabase
      .from("hidden_circuit_pages")
      .delete()
      .eq("page_key", pageKey);
    if (error) redirect("/dashboard/contenu/circuit?error=visibility");
  }

  revalidatePath("/circuit", "layout");
  revalidatePath("/dashboard/contenu/circuit");
  redirect(
    `/dashboard/contenu/circuit?visibility_saved=1#page-${encodeURIComponent(pageKey)}`,
  );
}

function isEditableSiteSection(value: string): value is EditableSiteSection {
  return value === "motors" || value === "circuit" || value === "evenements";
}

export async function saveNavigationOrder(formData: FormData) {
  const sectionValue = text(formData.get("section"), 30);
  const rawOrder = text(formData.get("order_json"), 40000);
  if (!isEditableSiteSection(sectionValue) || !rawOrder) {
    redirect("/dashboard/contenu?error=navigation_order");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOrder);
  } catch {
    redirect(`/dashboard/contenu/${sectionValue}?error=navigation_order#menu-order`);
  }

  const order = normalizeNavigationOrder(parsed);
  const { supabase, user } = await requireDashboardAccess();
  const { error } = await supabase.from("site_pages").upsert(
    {
      slug: navigationOrderSlug(sectionValue),
      title: `Ordre du menu ${sectionValue}`,
      content: JSON.stringify(order),
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: "slug" },
  );

  if (error) {
    redirect(`/dashboard/contenu/${sectionValue}?error=navigation_order#menu-order`);
  }

  const publicSection = sectionValue === "evenements" ? "/evenements" : `/${sectionValue}`;
  revalidatePath(publicSection, "layout");
  revalidatePath(`/dashboard/contenu/${sectionValue}`);
  redirect(`/dashboard/contenu/${sectionValue}?order_saved=1#menu-order`);
}

export async function updateMemberRole(formData: FormData) {
  const userId = text(formData.get("user_id"), 80);
  const role = text(formData.get("role"), 30);
  if (!userId || !isRoleKey(role)) redirect("/dashboard/membres?error=invalid");

  const { supabase } = await requireDashboardAccess();
  const { data: profile } = await supabase
    .from("member_profiles")
    .select("discord_id")
    .eq("user_id", userId)
    .maybeSingle();
  const finalRole =
    profile?.discord_id === "331843410962939908" ? "manager" : role;
  const { error } = await supabase
    .from("member_profiles")
    .update({ role: finalRole, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) redirect("/dashboard/membres?error=save");

  revalidatePath("/dashboard/membres");
  revalidatePath("/profil");
  redirect("/dashboard/membres?saved=1");
}

function isCustomPageSection(value: string): value is CustomPageSection {
  return value === "motors" || value === "evenements";
}

function customSectionDashboardRoute(section: CustomPageSection): string {
  return `/dashboard/contenu/${section}`;
}

export async function saveCustomSectionPage(formData: FormData) {
  const sectionValue = text(formData.get("section"), 30) as EditableSiteSection;
  if (!isCustomPageSection(sectionValue))
    redirect("/dashboard/contenu?error=custom_section");
  const section = sectionValue;
  const dashboardRoute = customSectionDashboardRoute(section);
  const id = integer(formData.get("id"), 0);
  const label = text(formData.get("label"), 100);
  const title = text(formData.get("title"), 120);
  const content = text(formData.get("content"), 30000);
  const rawSlug = text(formData.get("slug"), 80);
  const publicSlug = slugify(rawSlug || label || title);
  const storedSlug = `${section}-${publicSlug}`;
  const categoryKeyInput = slugify(text(formData.get("category_key"), 80));
  const categoryLabelInput = text(formData.get("category_label"), 100);
  const sortOrder = Math.max(0, integer(formData.get("sort_order"), 100));
  const visible = formData.get("visible") === "on";

  if (
    label.length < 2 ||
    title.length < 2 ||
    content.length < 2 ||
    publicSlug.length < 2
  ) {
    redirect(`${dashboardRoute}?error=custom_invalid#custom-pages`);
  }

  const builtCategory = BUILT_IN_SECTION_CATEGORIES[section].find(
    (category) => category.key === categoryKeyInput,
  );
  const categoryKey =
    builtCategory?.key || categoryKeyInput || "pages-personnalisees";
  const categoryLabel =
    builtCategory?.label || categoryLabelInput || "Pages personnalisées";
  const storedCategoryKey = `${section}:${categoryKey}`;

  const { supabase, user } = await requireDashboardAccess();
  const payload = {
    category_key: storedCategoryKey,
    category_label: categoryLabel,
    slug: storedSlug,
    label,
    title,
    content,
    sort_order: sortOrder,
    visible,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  const result =
    id > 0
      ? await supabase
          .from("custom_circuit_pages")
          .update(payload)
          .eq("id", id)
          .like("category_key", `${section}:%`)
      : await supabase
          .from("custom_circuit_pages")
          .insert({ ...payload, created_by: user.id });

  if (result.error)
    redirect(`${dashboardRoute}?error=custom_save#custom-pages`);
  revalidatePath(`/${section}`, "layout");
  revalidatePath(`/${section}/personnalise/${publicSlug}`);
  revalidatePath(dashboardRoute);
  redirect(`${dashboardRoute}?custom_saved=1#custom-pages`);
}

export async function deleteCustomSectionPage(formData: FormData) {
  const sectionValue = text(formData.get("section"), 30) as EditableSiteSection;
  if (!isCustomPageSection(sectionValue))
    redirect("/dashboard/contenu?error=custom_section");
  const section = sectionValue;
  const dashboardRoute = customSectionDashboardRoute(section);
  const id = integer(formData.get("id"), 0);
  const { supabase } = await requireDashboardAccess();

  if (id > 0) {
    const { data } = await supabase
      .from("custom_circuit_pages")
      .select("slug")
      .eq("id", id)
      .like("category_key", `${section}:%`)
      .maybeSingle();
    await supabase
      .from("custom_circuit_pages")
      .delete()
      .eq("id", id)
      .like("category_key", `${section}:%`);
    if (data?.slug) {
      const prefix = `${section}-`;
      const publicSlug = String(data.slug).startsWith(prefix)
        ? String(data.slug).slice(prefix.length)
        : String(data.slug);
      revalidatePath(`/${section}/personnalise/${publicSlug}`);
    }
  }

  revalidatePath(`/${section}`, "layout");
  revalidatePath(dashboardRoute);
  redirect(`${dashboardRoute}?custom_deleted=1#custom-pages`);
}
