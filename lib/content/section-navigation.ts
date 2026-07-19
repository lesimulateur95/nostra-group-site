import type { SidebarNavItem } from "@/components/site/sidebar-nav";
import { createClient } from "@/lib/supabase/server";
import type { EditableSiteSection } from "@/lib/content/site-content";
import { getNavigationOrder, sortByStoredOrder } from "@/lib/content/navigation-order";

export type CustomPageSection = Exclude<EditableSiteSection, "circuit">;

export type BuiltInSectionCategory = {
  key: string;
  label: string;
  href: string;
  editableSlug: string;
};

export const BUILT_IN_SECTION_CATEGORIES: Record<
  CustomPageSection,
  BuiltInSectionCategory[]
> = {
  motors: [
    { key: "presentation", label: "Présentation", href: "/motors", editableSlug: "motors-presentation" },
    { key: "catalogue", label: "Catalogue", href: "/motors/catalogue", editableSlug: "motors-catalogue" },
    { key: "fidelite", label: "Programme fidélité", href: "/motors/fidelite", editableSlug: "motors-fidelite" },
    { key: "contact", label: "Contact & commandes", href: "/motors/contact", editableSlug: "motors-contact" },
  ],
  evenements: [
    { key: "presentation", label: "Présentation", href: "/evenements", editableSlug: "evenements-presentation" },
    { key: "agenda", label: "Agenda", href: "/evenements/agenda", editableSlug: "evenements-agenda" },
    { key: "jeux", label: "Jeux", href: "/evenements/jeux", editableSlug: "evenements-jeux" },
    {
      key: "inscriptions",
      label: "Inscriptions",
      href: "/evenements/inscriptions",
      editableSlug: "evenements-inscriptions",
    },
  ],
};

type RawCustomSectionPage = {
  id: number;
  category_key: string;
  category_label: string;
  slug: string;
  label: string;
  title: string;
  content: string;
  sort_order: number;
  visible: boolean;
};

export type CustomSectionPage = Omit<
  RawCustomSectionPage,
  "category_key" | "slug"
> & {
  section: CustomPageSection;
  category_key: string;
  slug: string;
  stored_category_key: string;
  stored_slug: string;
};


export function sectionHiddenPagesSlug(section: CustomPageSection): string {
  return `__hidden_pages__:${section}`;
}

export async function getHiddenSectionPageKeys(
  section: CustomPageSection,
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_pages")
    .select("content")
    .eq("slug", sectionHiddenPagesSlug(section))
    .maybeSingle();

  if (error || !data?.content) return new Set();

  try {
    const parsed = JSON.parse(String(data.content));
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

function sectionCategoryPrefix(section: CustomPageSection): string {
  return `${section}:`;
}

function sectionSlugPrefix(section: CustomPageSection): string {
  return `${section}-`;
}

function toPublicPage(
  section: CustomPageSection,
  row: RawCustomSectionPage,
): CustomSectionPage {
  const categoryPrefix = sectionCategoryPrefix(section);
  const slugPrefix = sectionSlugPrefix(section);
  return {
    ...row,
    section,
    stored_category_key: row.category_key,
    stored_slug: row.slug,
    category_key: row.category_key.startsWith(categoryPrefix)
      ? row.category_key.slice(categoryPrefix.length)
      : row.category_key,
    slug: row.slug.startsWith(slugPrefix)
      ? row.slug.slice(slugPrefix.length)
      : row.slug,
  };
}

export async function getCustomSectionPages(
  section: CustomPageSection,
): Promise<CustomSectionPage[]> {
  const supabase = await createClient();
  const prefix = sectionCategoryPrefix(section);
  const { data, error } = await supabase
    .from("custom_circuit_pages")
    .select(
      "id,category_key,category_label,slug,label,title,content,sort_order,visible",
    )
    .like("category_key", `${prefix}%`)
    .order("category_label")
    .order("sort_order")
    .order("label");

  if (error) return [];
  return ((data ?? []) as RawCustomSectionPage[]).map((row) =>
    toPublicPage(section, row),
  );
}

export async function getCustomSectionPage(
  section: CustomPageSection,
  slug: string,
): Promise<CustomSectionPage | null> {
  const supabase = await createClient();
  const storedSlug = `${sectionSlugPrefix(section)}${slug}`;
  const prefix = sectionCategoryPrefix(section);
  const { data, error } = await supabase
    .from("custom_circuit_pages")
    .select(
      "id,category_key,category_label,slug,label,title,content,sort_order,visible",
    )
    .eq("slug", storedSlug)
    .like("category_key", `${prefix}%`)
    .eq("visible", true)
    .maybeSingle();

  if (error || !data) return null;
  return toPublicPage(section, data as RawCustomSectionPage);
}

export async function getSectionNavigation(
  section: CustomPageSection,
): Promise<SidebarNavItem[]> {
  const [customPages, storedOrder, hiddenPageKeys] = await Promise.all([
    getCustomSectionPages(section),
    getNavigationOrder(section),
    getHiddenSectionPageKeys(section),
  ]);
  const builtIns = BUILT_IN_SECTION_CATEGORIES[section];
  const visible = customPages.filter((page) => page.visible);
  const byCategory = new Map<string, CustomSectionPage[]>();

  for (const page of visible) {
    const current = byCategory.get(page.category_key) ?? [];
    current.push(page);
    byCategory.set(page.category_key, current);
  }

  const items: SidebarNavItem[] = [];

  for (const category of builtIns) {
    const attached = byCategory.get(category.key) ?? [];
    byCategory.delete(category.key);
    const builtInVisible = !hiddenPageKeys.has(category.editableSlug);

    if (!builtInVisible && attached.length === 0) continue;

    if (attached.length === 0) {
      items.push({ key: category.key, href: category.href, label: category.label });
      continue;
    }

    const children = sortByStoredOrder(
      [
        ...(builtInVisible
          ? [{ key: `builtin-${category.key}`, href: category.href, label: "Vue d’ensemble" }]
          : []),
        ...attached.map((page) => ({
          key: `custom-${page.id}`,
          href: `/${section}/personnalise/${page.slug}`,
          label: page.label,
        })),
      ],
      storedOrder.children[category.key],
      (child) => child.key,
    );

    items.push({
      key: category.key,
      href: children[0]?.href ?? category.href,
      label: category.label,
      children,
    });
  }

  for (const [categoryKey, pages] of byCategory.entries()) {
    const first = pages[0];
    if (!first) continue;
    const children = sortByStoredOrder(
      pages.map((page) => ({
        key: `custom-${page.id}`,
        href: `/${section}/personnalise/${page.slug}`,
        label: page.label,
      })),
      storedOrder.children[categoryKey],
      (child) => child.key,
    );
    items.push({
      key: categoryKey,
      href: children[0]?.href ?? `/${section}/personnalise/${first.slug}`,
      label: first.category_label || categoryKey,
      children,
    });
  }

  return sortByStoredOrder(items, storedOrder.categories, (item) => item.key ?? item.href);
}
