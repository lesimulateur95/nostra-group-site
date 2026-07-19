import { createClient } from "@/lib/supabase/server";

export type EditableSiteSection = "motors" | "circuit" | "evenements";

export const EDITABLE_PAGE_CONFIG = [
  { slug: "motors-presentation", label: "Nostra Motors — Présentation", route: "/motors", category: "Présentation", section: "motors" },
  { slug: "motors-catalogue", label: "Nostra Motors — Catalogue", route: "/motors/catalogue", category: "Catalogue", section: "motors" },
  { slug: "motors-fidelite", label: "Nostra Motors — Programme fidélité", route: "/motors/fidelite", category: "Programme fidélité", section: "motors" },

  { slug: "circuit-presentation", label: "Présentation — Vue d’ensemble", route: "/circuit", category: "Présentation", section: "circuit" },
  { slug: "circuit-activities", label: "Présentation — Nos activités", route: "/circuit/presentation/activites", category: "Présentation", section: "circuit" },
  { slug: "circuit-values", label: "Présentation — Nos valeurs", route: "/circuit/presentation/valeurs", category: "Présentation", section: "circuit" },
  { slug: "circuit-installations", label: "Présentation — Nos installations", route: "/circuit/presentation/installations", category: "Présentation", section: "circuit" },

  { slug: "administration-sportive", label: "Administration sportive — Vue d’ensemble", route: "/circuit/administration-sportive", category: "Administration sportive", section: "circuit" },
  { slug: "creation-ecurie", label: "Administration sportive — Création d’écurie", route: "/circuit/administration-sportive/creation-ecurie", category: "Administration sportive", section: "circuit" },
  { slug: "licence-reglement", label: "Règlement des licences pilotes", route: "/circuit/administration-sportive/reglement-licences", category: "Administration sportive", section: "circuit" },
  { slug: "licence-tarifs", label: "Tarifs des licences pilotes", route: "/circuit/administration-sportive/tarifs-licences", category: "Administration sportive", section: "circuit" },
  { slug: "homologation-vehicules", label: "Homologation des véhicules", route: "/circuit/administration-sportive/homologation-vehicules", category: "Administration sportive", section: "circuit" },
  { slug: "homologation-ecuries", label: "Homologation des écuries", route: "/circuit/administration-sportive/homologation-ecuries", category: "Administration sportive", section: "circuit" },

  { slug: "journal-officiel", label: "Journal officiel — Vue d’ensemble", route: "/circuit/journal-officiel", category: "Journal officiel", section: "circuit" },
  { slug: "journal-communiques", label: "Journal officiel — Communiqués", route: "/circuit/journal-officiel/communiques", category: "Journal officiel", section: "circuit" },
  { slug: "journal-decisions", label: "Journal officiel — Décisions", route: "/circuit/journal-officiel/decisions", category: "Journal officiel", section: "circuit" },
  { slug: "journal-resultats", label: "Journal officiel — Résultats homologués", route: "/circuit/journal-officiel/resultats", category: "Journal officiel", section: "circuit" },

  { slug: "reservations", label: "Réservations — Vue d’ensemble", route: "/circuit/reservations", category: "Réservations", section: "circuit" },
  { slug: "reservations-demande", label: "Réservations — Demande de créneau", route: "/circuit/reservations/demande", category: "Réservations", section: "circuit" },
  { slug: "reservations-validees", label: "Réservations — Créneaux validés", route: "/circuit/reservations/validees", category: "Réservations", section: "circuit" },
  { slug: "reservations-conditions", label: "Réservations — Conditions d’accès", route: "/circuit/reservations/conditions", category: "Réservations", section: "circuit" },

  { slug: "circuit-reglement", label: "Règlement général", route: "/circuit/reglement", category: "Règlement", section: "circuit" },
  { slug: "circuit-reglement-piste", label: "Règlement en piste", route: "/circuit/reglement/piste", category: "Règlement", section: "circuit" },

  { slug: "championnat-f1", label: "Championnat F1 — Vue d’ensemble", route: "/circuit/championnat-f1", category: "Championnat F1", section: "circuit" },
  { slug: "f1-calendrier", label: "Championnat F1 — Calendrier", route: "/circuit/championnat-f1/calendrier", category: "Championnat F1", section: "circuit" },
  { slug: "f1-participants", label: "Championnat F1 — Pilotes & écuries", route: "/circuit/championnat-f1/participants", category: "Championnat F1", section: "circuit" },
  { slug: "f1-resultats", label: "Championnat F1 — Résultats", route: "/circuit/championnat-f1/resultats", category: "Championnat F1", section: "circuit" },

  { slug: "championnat-gt3rs", label: "Championnat GT3 RS — Vue d’ensemble", route: "/circuit/championnat-gt3rs", category: "Championnat GT3 RS", section: "circuit" },
  { slug: "gt3-calendrier", label: "Championnat GT3 RS — Calendrier", route: "/circuit/championnat-gt3rs/calendrier", category: "Championnat GT3 RS", section: "circuit" },
  { slug: "gt3-participants", label: "Championnat GT3 RS — Pilotes", route: "/circuit/championnat-gt3rs/participants", category: "Championnat GT3 RS", section: "circuit" },
  { slug: "gt3-resultats", label: "Championnat GT3 RS — Résultats", route: "/circuit/championnat-gt3rs/resultats", category: "Championnat GT3 RS", section: "circuit" },

  { slug: "classements", label: "Classements — Vue d’ensemble", route: "/circuit/classement", category: "Classements", section: "circuit" },
  { slug: "classement-f1", label: "Classements — F1", route: "/circuit/classement/f1", category: "Classements", section: "circuit" },
  { slug: "classement-ecuries", label: "Classements — Écuries", route: "/circuit/classement/ecuries", category: "Classements", section: "circuit" },
  { slug: "classement-gt3rs", label: "Classements — GT3 RS", route: "/circuit/classement/gt3rs", category: "Classements", section: "circuit" },

  { slug: "evenements-presentation", label: "Événements & Jeux — Présentation", route: "/evenements", category: "Présentation", section: "evenements" },
  { slug: "evenements-agenda", label: "Événements & Jeux — Agenda", route: "/evenements/agenda", category: "Agenda", section: "evenements" },
  { slug: "evenements-jeux", label: "Événements & Jeux — Jeux", route: "/evenements/jeux", category: "Jeux", section: "evenements" },
  { slug: "evenements-inscriptions", label: "Événements & Jeux — Inscriptions", route: "/evenements/inscriptions", category: "Inscriptions", section: "evenements" },
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
  return EDITABLE_PAGE_CONFIG.find((page) => page.slug === slug)?.route ?? "/dashboard/contenu";
}

export function getEditablePageSection(slug: string): EditableSiteSection {
  return EDITABLE_PAGE_CONFIG.find((page) => page.slug === slug)?.section ?? "circuit";
}

export function getEditablePageDashboardRoute(slug: string): string {
  return `/dashboard/contenu/${getEditablePageSection(slug)}`;
}

export function getEditablePagesBySection(section: EditableSiteSection) {
  return EDITABLE_PAGE_CONFIG.filter((page) => page.section === section);
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

  if (error) return { configured: false, pages: new Map(), errorMessage: error.message };
  const pages = new Map<string, SitePageRecord>();
  for (const row of data ?? []) pages.set(row.slug, row as SitePageRecord);
  return { configured: true, pages };
}
