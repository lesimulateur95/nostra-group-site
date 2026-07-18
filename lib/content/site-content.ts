import { createClient } from "@/lib/supabase/server";

export const EDITABLE_PAGE_CONFIG = [
  { slug: "circuit-presentation", label: "Présentation du Nostra Circuit", route: "/circuit" },
  { slug: "circuit-reglement", label: "Règlement du circuit", route: "/circuit/reglement" },
  { slug: "licence-reglement", label: "Règlement des licences pilotes", route: "/circuit/administration-sportive/reglement-licences" },
  { slug: "licence-tarifs", label: "Tarifs des licences pilotes", route: "/circuit/administration-sportive/tarifs-licences" },
  { slug: "homologation-vehicules", label: "Homologation des véhicules", route: "/circuit/administration-sportive/homologation-vehicules" },
  { slug: "homologation-ecuries", label: "Homologation des écuries", route: "/circuit/administration-sportive/homologation-ecuries" },
  { slug: "journal-officiel", label: "Journal officiel", route: "/circuit/journal-officiel" },
  { slug: "reservations", label: "Réservations", route: "/circuit/reservations" },
  { slug: "championnat-f1", label: "Championnat F1", route: "/circuit/championnat-f1" },
  { slug: "championnat-gt3rs", label: "Championnat Porsche GT3 RS", route: "/circuit/championnat-gt3rs" },
  { slug: "classements", label: "Classements", route: "/circuit/classement" },
] as const;

export type EditablePageSlug = (typeof EDITABLE_PAGE_CONFIG)[number]["slug"];

export type SitePageRecord = {
  slug: EditablePageSlug;
  title: string;
  content: string;
  updated_at?: string | null;
};

export const EDITABLE_PAGE_SLUGS = new Set<string>(EDITABLE_PAGE_CONFIG.map((page) => page.slug));

export function getEditablePageRoute(slug: string): string {
  return EDITABLE_PAGE_CONFIG.find((page) => page.slug === slug)?.route ?? "/dashboard";
}

export async function getSitePage(slug: EditablePageSlug): Promise<SitePageRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_pages")
    .select("slug,title,content,updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data || !data.content?.trim()) return null;
  return data as SitePageRecord;
}

export async function getAllSitePages(): Promise<{
  configured: boolean;
  pages: Map<string, SitePageRecord>;
  errorMessage?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_pages")
    .select("slug,title,content,updated_at")
    .order("slug");

  if (error) {
    return {
      configured: false,
      pages: new Map(),
      errorMessage: error.message,
    };
  }

  const pages = new Map<string, SitePageRecord>();
  for (const row of data ?? []) pages.set(row.slug, row as SitePageRecord);
  return { configured: true, pages };
}
