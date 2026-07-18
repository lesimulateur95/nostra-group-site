import Link from "next/link";
import { HashRouteRedirect } from "@/components/site/hash-route-redirect";
import { EditablePage } from "@/components/site/editable-page";
import { getCircuitNavigation } from "@/lib/content/circuit-navigation";
import { getEditablePageRoute, type EditablePageSlug } from "@/lib/content/site-content";

export async function CircuitCategoryOverview({
  slug,
  categoryKey,
  eyebrow,
  title,
  description,
  pages,
}: {
  slug: EditablePageSlug;
  categoryKey: string;
  eyebrow: string;
  title: string;
  description: string;
  pages: Array<{ href: string; title: string; description: string }>;
}) {
  const fallback = (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      <p className="lead">{description}</p>
    </>
  );

  const navigation = await getCircuitNavigation();
  const category = navigation.find((item) => item.key === categoryKey);
  const overviewRoute = getEditablePageRoute(slug);
  const descriptions = new Map(pages.map((page) => [page.href, page.description]));
  const titles = new Map(pages.map((page) => [page.href, page.title]));
  const links = (category?.children ?? [])
    .filter((page) => page.href !== overviewRoute)
    .map((page) => ({
      href: page.href,
      title: titles.get(page.href) ?? page.label,
      description: descriptions.get(page.href) ?? "Ouvrir cette page du Nostra Circuit.",
    }));

  const hashRoutes = pages.map((page) => ({
    hash: page.href.split("/").filter(Boolean).at(-1) ?? "",
    href: page.href,
    aliases: page.href.endsWith("/piste") ? ["reglement-piste"] : [],
  }));

  return (
    <>
      <HashRouteRedirect routes={hashRoutes} />
      <EditablePage slug={slug} defaultTitle={title} eyebrow={eyebrow}>{fallback}</EditablePage>
      {links.length > 0 && (
        <section className="overview-link-section">
          <div className="overview-link-heading">
            <p className="eyebrow">ACCÈS RAPIDE</p>
            <h2>Choisir une page</h2>
          </div>
          <div className="admin-sport-grid overview-link-grid">
            {links.map((page) => (
              <Link className="admin-sport-card" href={page.href} key={page.href}>
                <span className="admin-card-arrow">→</span>
                <h3>{page.title}</h3>
                <p>{page.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
