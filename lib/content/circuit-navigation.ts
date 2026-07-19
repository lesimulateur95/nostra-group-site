import { createClient } from "@/lib/supabase/server";
import { getNavigationOrder, sortByStoredOrder } from "@/lib/content/navigation-order";

export type CircuitNavPage = {
  key: string;
  href: string;
  label: string;
  editableSlug?: string;
  customId?: number;
  custom?: boolean;
};

export type CircuitNavCategory = {
  key: string;
  label: string;
  href: string;
  children: CircuitNavPage[];
  custom?: boolean;
};

export const BUILT_IN_CIRCUIT_CATEGORIES: CircuitNavCategory[] = [
  {
    key: "presentation",
    label: "Présentation",
    href: "/circuit",
    children: [
      { key: "circuit-presentation", href: "/circuit", label: "Vue d’ensemble", editableSlug: "circuit-presentation" },
      { key: "circuit-activities", href: "/circuit/presentation/activites", label: "Nos activités", editableSlug: "circuit-activities" },
      { key: "circuit-values", href: "/circuit/presentation/valeurs", label: "Nos valeurs", editableSlug: "circuit-values" },
      { key: "circuit-installations", href: "/circuit/presentation/installations", label: "Nos installations", editableSlug: "circuit-installations" },
    ],
  },
  {
    key: "administration-sportive",
    label: "Administration sportive",
    href: "/circuit/administration-sportive",
    children: [
      { key: "administration-sportive", href: "/circuit/administration-sportive", label: "Vue d’ensemble", editableSlug: "administration-sportive" },
      { key: "creation-ecurie", href: "/circuit/administration-sportive/creation-ecurie", label: "Création d’écurie", editableSlug: "creation-ecurie" },
      { key: "licence-reglement", href: "/circuit/administration-sportive/reglement-licences", label: "Règlement licences pilotes", editableSlug: "licence-reglement" },
      { key: "licence-tarifs", href: "/circuit/administration-sportive/tarifs-licences", label: "Tarifs licences pilotes", editableSlug: "licence-tarifs" },
      { key: "homologation-vehicules", href: "/circuit/administration-sportive/homologation-vehicules", label: "Homologation véhicules", editableSlug: "homologation-vehicules" },
      { key: "homologation-ecuries", href: "/circuit/administration-sportive/homologation-ecuries", label: "Homologation écuries", editableSlug: "homologation-ecuries" },
    ],
  },
  {
    key: "journal-officiel",
    label: "Journal officiel",
    href: "/circuit/journal-officiel",
    children: [
      { key: "journal-officiel", href: "/circuit/journal-officiel", label: "Vue d’ensemble", editableSlug: "journal-officiel" },
      { key: "journal-communiques", href: "/circuit/journal-officiel/communiques", label: "Communiqués", editableSlug: "journal-communiques" },
      { key: "journal-decisions", href: "/circuit/journal-officiel/decisions", label: "Décisions", editableSlug: "journal-decisions" },
      { key: "journal-resultats", href: "/circuit/journal-officiel/resultats", label: "Résultats homologués", editableSlug: "journal-resultats" },
    ],
  },
  {
    key: "reservations",
    label: "Réservations",
    href: "/circuit/reservations",
    children: [
      { key: "reservations", href: "/circuit/reservations", label: "Vue d’ensemble", editableSlug: "reservations" },
      { key: "reservations-demande", href: "/circuit/reservations/demande", label: "Demande de créneau", editableSlug: "reservations-demande" },
      { key: "reservations-validees", href: "/circuit/reservations/validees", label: "Réservations validées", editableSlug: "reservations-validees" },
      { key: "reservations-conditions", href: "/circuit/reservations/conditions", label: "Conditions d’accès", editableSlug: "reservations-conditions" },
    ],
  },
  {
    key: "reglement",
    label: "Règlement",
    href: "/circuit/reglement",
    children: [
      { key: "circuit-reglement", href: "/circuit/reglement", label: "Règlement général", editableSlug: "circuit-reglement" },
      { key: "circuit-reglement-piste", href: "/circuit/reglement/piste", label: "Règlement en piste", editableSlug: "circuit-reglement-piste" },
    ],
  },
  {
    key: "championnat-f1",
    label: "Championnat F1",
    href: "/circuit/championnat-f1",
    children: [
      { key: "championnat-f1", href: "/circuit/championnat-f1", label: "Vue d’ensemble", editableSlug: "championnat-f1" },
      { key: "f1-calendrier", href: "/circuit/championnat-f1/calendrier", label: "Calendrier", editableSlug: "f1-calendrier" },
      { key: "f1-participants", href: "/circuit/championnat-f1/participants", label: "Pilotes & écuries", editableSlug: "f1-participants" },
      { key: "f1-resultats", href: "/circuit/championnat-f1/resultats", label: "Résultats", editableSlug: "f1-resultats" },
    ],
  },
  {
    key: "championnat-gt3rs",
    label: "Championnat GT3 RS",
    href: "/circuit/championnat-gt3rs",
    children: [
      { key: "championnat-gt3rs", href: "/circuit/championnat-gt3rs", label: "Vue d’ensemble", editableSlug: "championnat-gt3rs" },
      { key: "gt3-calendrier", href: "/circuit/championnat-gt3rs/calendrier", label: "Calendrier", editableSlug: "gt3-calendrier" },
      { key: "gt3-participants", href: "/circuit/championnat-gt3rs/participants", label: "Pilotes", editableSlug: "gt3-participants" },
      { key: "gt3-resultats", href: "/circuit/championnat-gt3rs/resultats", label: "Résultats", editableSlug: "gt3-resultats" },
    ],
  },
  {
    key: "classements",
    label: "Classements",
    href: "/circuit/classement",
    children: [
      { key: "classements", href: "/circuit/classement", label: "Vue d’ensemble", editableSlug: "classements" },
      { key: "classement-f1", href: "/circuit/classement/f1", label: "Classement F1", editableSlug: "classement-f1" },
      { key: "classement-ecuries", href: "/circuit/classement/ecuries", label: "Classement écuries", editableSlug: "classement-ecuries" },
      { key: "classement-gt3rs", href: "/circuit/classement/gt3rs", label: "Classement GT3 RS", editableSlug: "classement-gt3rs" },
    ],
  },
];

export type CustomCircuitPage = {
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

export async function getCustomCircuitPages(): Promise<CustomCircuitPage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_circuit_pages")
    .select("id,category_key,category_label,slug,label,title,content,sort_order,visible")
    .order("category_label")
    .order("sort_order")
    .order("label");
  if (error) return [];

  // Les pages Motors et Événements partagent encore la même table historique,
  // mais elles sont préfixées. On les exclut strictement du Nostra Circuit.
  return ((data ?? []) as CustomCircuitPage[]).filter((page) =>
    !page.category_key.startsWith("motors:") &&
    !page.category_key.startsWith("evenements:") &&
    !page.slug.startsWith("motors-") &&
    !page.slug.startsWith("evenements-")
  );
}

export async function getCustomCircuitPage(slug: string): Promise<CustomCircuitPage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_circuit_pages")
    .select("id,category_key,category_label,slug,label,title,content,sort_order,visible")
    .eq("slug", slug)
    .eq("visible", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as CustomCircuitPage;
}

export async function getHiddenCircuitPageKeys(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("hidden_circuit_pages").select("page_key");
  if (error) return new Set();
  return new Set((data ?? []).map((row) => String(row.page_key)));
}

export async function getCircuitNavigation(): Promise<CircuitNavCategory[]> {
  const [customPages, hidden, storedOrder] = await Promise.all([
    getCustomCircuitPages(),
    getHiddenCircuitPageKeys(),
    getNavigationOrder("circuit"),
  ]);

  const categories = BUILT_IN_CIRCUIT_CATEGORIES.map((category) => {
    const children = category.children.filter((page) => !hidden.has(page.key));
    return { ...category, href: children[0]?.href ?? category.href, children: [...children] };
  }).filter((category) => category.children.length > 0);

  const builtInByKey = new Map(categories.map((category) => [category.key, category]));
  const customGroups = new Map<string, CircuitNavCategory>();

  for (const page of customPages) {
    if (!page.visible) continue;
    const child: CircuitNavPage = {
      key: `custom-${page.id}`,
      href: `/circuit/personnalise/${page.slug}`,
      label: page.label,
      customId: page.id,
      custom: true,
    };

    const builtInCategory = builtInByKey.get(page.category_key);
    if (builtInCategory) {
      builtInCategory.children.push(child);
      continue;
    }

    const key = page.category_key || "personnalise";
    const existing = customGroups.get(key) ?? {
      key,
      label: page.category_label || "Pages personnalisées",
      href: child.href,
      children: [],
      custom: true,
    };
    existing.children.push(child);
    if (existing.children.length === 1) existing.href = child.href;
    customGroups.set(key, existing);
  }

  const allCategories = [...categories, ...customGroups.values()].map((category) => {
    const children = sortByStoredOrder(
      category.children,
      storedOrder.children[category.key],
      (child) => child.key,
    );
    return { ...category, href: children[0]?.href ?? category.href, children };
  });

  return sortByStoredOrder(allCategories, storedOrder.categories, (category) => category.key);
}
