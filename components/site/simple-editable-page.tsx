import { EditablePage } from "@/components/site/editable-page";
import { DEFAULT_EDITOR_CONTENT } from "@/lib/content/default-editor-content";
import type { EditablePageSlug } from "@/lib/content/site-content";

export function SimpleEditablePage({
  slug,
  title,
  eyebrow,
  intro,
}: {
  slug: EditablePageSlug;
  title: string;
  eyebrow: string;
  intro: string;
}) {
  const defaults = DEFAULT_EDITOR_CONTENT[slug];
  const fallback = (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{defaults?.title || title}</h1>
        <p className="document-intro">{intro}</p>
      </header>
      <section className="document-section editable-document-copy">
        {defaults?.content || "Cette page est prête à être complétée depuis le Dashboard Gérant."}
      </section>
    </article>
  );
  return <EditablePage slug={slug} defaultTitle={defaults?.title || title} eyebrow={eyebrow}>{fallback}</EditablePage>;
}
