import { createClient } from "@/lib/supabase/server";
import type { EditableSiteSection } from "@/lib/content/site-content";

export type StoredNavigationOrder = {
  categories: string[];
  children: Record<string, string[]>;
};

const EMPTY_ORDER: StoredNavigationOrder = {
  categories: [],
  children: {},
};

export function navigationOrderSlug(section: EditableSiteSection): string {
  return `__navigation_${section}`;
}

function cleanKey(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 140) : "";
}

function uniqueKeys(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = cleanKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
    if (result.length >= 250) break;
  }
  return result;
}

export function normalizeNavigationOrder(value: unknown): StoredNavigationOrder {
  if (!value || typeof value !== "object") return EMPTY_ORDER;
  const candidate = value as { categories?: unknown; children?: unknown };
  const children: Record<string, string[]> = {};

  if (candidate.children && typeof candidate.children === "object" && !Array.isArray(candidate.children)) {
    for (const [rawCategoryKey, rawChildren] of Object.entries(candidate.children as Record<string, unknown>)) {
      const categoryKey = cleanKey(rawCategoryKey);
      if (!categoryKey) continue;
      children[categoryKey] = uniqueKeys(rawChildren);
      if (Object.keys(children).length >= 150) break;
    }
  }

  return {
    categories: uniqueKeys(candidate.categories),
    children,
  };
}

export async function getNavigationOrder(section: EditableSiteSection): Promise<StoredNavigationOrder> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_pages")
    .select("content")
    .eq("slug", navigationOrderSlug(section))
    .maybeSingle();

  if (error || !data?.content) return EMPTY_ORDER;
  try {
    return normalizeNavigationOrder(JSON.parse(String(data.content)));
  } catch {
    return EMPTY_ORDER;
  }
}

export function sortByStoredOrder<T>(
  items: T[],
  order: string[] | undefined,
  getKey: (item: T) => string,
): T[] {
  if (!order?.length) return [...items];
  const rank = new Map(order.map((key, index) => [key, index]));
  return items
    .map((item, fallbackIndex) => ({ item, fallbackIndex }))
    .sort((a, b) => {
      const aRank = rank.get(getKey(a.item));
      const bRank = rank.get(getKey(b.item));
      if (aRank === undefined && bRank === undefined) return a.fallbackIndex - b.fallbackIndex;
      if (aRank === undefined) return 1;
      if (bRank === undefined) return -1;
      return aRank - bRank;
    })
    .map(({ item }) => item);
}
