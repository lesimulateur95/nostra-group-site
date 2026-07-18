import { notFound } from "next/navigation";
import { getCustomCircuitPage } from "@/lib/content/circuit-navigation";

export async function CustomCircuitPage({ slug }: { slug: string }) {
  const page = await getCustomCircuitPage(slug);
  if (!page) notFound();
  return (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">{page.category_label}</p>
        <h1 className="page-title">{page.title}</h1>
        <p className="content-updated">Page gérée depuis le Dashboard Gérant.</p>
      </header>
      <section className="document-section editable-document-copy">{page.content}</section>
    </article>
  );
}
