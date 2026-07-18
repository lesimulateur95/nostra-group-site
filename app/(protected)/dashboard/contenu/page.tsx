import { restoreDefaultSitePage, saveSitePage } from "@/app/actions/site-content";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DEFAULT_EDITOR_CONTENT } from "@/lib/content/default-editor-content";
import { EDITABLE_PAGE_CONFIG, getAllSitePages } from "@/lib/content/site-content";
import { SITE_CONTENT_SETUP_SQL } from "@/lib/content/setup-sql";

export default async function DashboardContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved : null;
  const restored = typeof params.restored === "string" ? params.restored : null;
  const error = typeof params.error === "string" ? params.error : null;
  const sitePages = await getAllSitePages();

  return (
    <DashboardShell>
      <DashboardHeader title="Modification des pages" description="Retrouve ici uniquement l’éditeur des textes du Nostra Circuit. Les autres outils restent séparés dans le dashboard principal." />

      {saved && <div className="dashboard-feedback dashboard-feedback-success">La page a bien été enregistrée.</div>}
      {restored && <div className="dashboard-feedback">Le contenu intégré par défaut a été restauré.</div>}
      {error && <div className="dashboard-feedback dashboard-feedback-error">Impossible d’enregistrer la page.</div>}

      {!sitePages.configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer l’éditeur de contenu</h2>
          <details>
            <summary>Afficher le code SQL</summary>
            <pre>{SITE_CONTENT_SETUP_SQL}</pre>
          </details>
        </section>
      )}

      <section className="content-editor-grid dashboard-editor-list">
        {EDITABLE_PAGE_CONFIG.map((page) => {
          const stored = sitePages.pages.get(page.slug);
          const defaults = DEFAULT_EDITOR_CONTENT[page.slug];
          return (
            <article className="content-editor-card" key={page.slug}>
              <div className="content-editor-head">
                <div>
                  <span className="module-status module-status-live">Modifiable</span>
                  <h3>{page.label}</h3>
                </div>
                <a href={page.route} target="_blank" rel="noreferrer">Voir la page ↗</a>
              </div>

              <form action={saveSitePage} className="content-editor-form">
                <input type="hidden" name="slug" value={page.slug} />
                <label>
                  Titre de la page
                  <input name="title" defaultValue={stored?.title || defaults.title} required maxLength={120} />
                </label>
                <label>
                  Contenu publié
                  <textarea name="content" defaultValue={stored?.content || defaults.content} required rows={14} maxLength={30000} />
                </label>
                <button className="btn content-save-button" type="submit" disabled={!sitePages.configured}>Enregistrer les modifications</button>
              </form>

              {stored && (
                <form action={restoreDefaultSitePage} className="restore-form">
                  <input type="hidden" name="slug" value={page.slug} />
                  <button type="submit" disabled={!sitePages.configured}>Restaurer le contenu intégré</button>
                </form>
              )}
            </article>
          );
        })}
      </section>
    </DashboardShell>
  );
}
