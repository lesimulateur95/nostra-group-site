import { notFound } from "next/navigation";
import {
  getCustomSectionPage,
  type CustomPageSection,
} from "@/lib/content/section-navigation";

export async function CustomSectionPage({
  section,
  slug,
}: {
  section: CustomPageSection;
  slug: string;
}) {
  const page = await getCustomSectionPage(section, slug);
  if (!page) notFound();

  return (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">{page.category_label}</p>
        <h1 className="page-title">{page.title}</h1>
        <p className="content-updated">
          Page gérée depuis le Dashboard Gérant.
        </p>
      </header>
      <section className="document-section editable-document-copy">
        {page.content}
      </section>
    </article>
  );
}
