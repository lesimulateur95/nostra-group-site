import type { ReactNode } from "react";
import { getSitePage, type EditablePageSlug } from "@/lib/content/site-content";

export async function EditablePage({
  slug,
  eyebrow = "Nostra Circuit",
  defaultTitle,
  children,
}: {
  slug: EditablePageSlug;
  eyebrow?: string;
  defaultTitle: string;
  children: ReactNode;
}) {
  const customPage = await getSitePage(slug);

  if (!customPage) return children;

  return (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{customPage.title || defaultTitle}</h1>
        <p className="content-updated">Contenu mis à jour depuis le dashboard Gérant.</p>
      </header>
      <section className="document-section editable-document-copy">
        {customPage.content}
      </section>
    </article>
  );
}
