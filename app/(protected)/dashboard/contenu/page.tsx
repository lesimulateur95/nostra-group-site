import {
  deleteCustomCircuitPage,
  saveCustomCircuitPage,
  setBuiltInCircuitPageVisibility,
} from "@/app/actions/admin-management";
import { restoreDefaultSitePage, saveSitePage } from "@/app/actions/site-content";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BUILT_IN_CIRCUIT_CATEGORIES, getCustomCircuitPages, getHiddenCircuitPageKeys } from "@/lib/content/circuit-navigation";
import { DEFAULT_EDITOR_CONTENT } from "@/lib/content/default-editor-content";
import { EDITABLE_PAGE_CONFIG, getAllSitePages } from "@/lib/content/site-content";
import { SITE_CONTENT_SETUP_SQL } from "@/lib/content/setup-sql";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved : null;
  const restored = typeof params.restored === "string" ? params.restored : null;
  const error = typeof params.error === "string" ? params.error : null;
  const [sitePages, customPages, hiddenPageKeys] = await Promise.all([
    getAllSitePages(),
    getCustomCircuitPages(),
    getHiddenCircuitPageKeys(),
  ]);

  const grouped = new Map<string, typeof EDITABLE_PAGE_CONFIG[number][]>();
  for (const page of EDITABLE_PAGE_CONFIG) {
    const current = grouped.get(page.category) ?? [];
    current.push(page);
    grouped.set(page.category, current);
  }

  return (
    <DashboardShell>
      <DashboardHeader
        title="Modification des pages"
        description="Chaque sous-catégorie possède désormais son propre contenu. Modifier une page ne change plus les autres pages."
      />

      {saved && <div className="dashboard-feedback dashboard-feedback-success">La page « {saved} » a bien été enregistrée.</div>}
      {restored && <div className="dashboard-feedback">Le contenu intégré de « {restored} » a été restauré.</div>}
      {params.custom_saved && <div className="dashboard-feedback dashboard-feedback-success">La page personnalisée a été enregistrée.</div>}
      {params.custom_deleted && <div className="dashboard-feedback">La page personnalisée a été supprimée.</div>}
      {params.visibility_saved && <div className="dashboard-feedback dashboard-feedback-success">La visibilité de la page a été mise à jour.</div>}
      {error && <div className="dashboard-feedback dashboard-feedback-error">Une modification n’a pas pu être enregistrée. Vérifie les champs puis réessaie.</div>}

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

      <section className="dashboard-section-heading dashboard-section-heading-tight">
        <p className="eyebrow">PAGES INTÉGRÉES — VERSION V9</p>
        <h2>Toutes les pages sont affichées et modifiables</h2>
        <p>Il n’y a plus de catégories repliées : les {EDITABLE_PAGE_CONFIG.length} pages et sous-pages sont visibles ci-dessous, chacune avec son propre formulaire et sa propre clé.</p>
      </section>

      <section className="category-editor-list">
        {[...grouped.entries()].map(([category, pages]) => (
          <section className="category-editor category-editor-expanded" key={category}>
            <div className="category-editor-heading">
              <span>{category}</span>
              <small>{pages.length} page(s) indépendantes</small>
            </div>
            <div className="content-editor-grid dashboard-editor-list">
              {pages.map((page) => {
                const stored = sitePages.pages.get(page.slug);
                const defaults = DEFAULT_EDITOR_CONTENT[page.slug];
                const hidden = hiddenPageKeys.has(page.slug);
                return (
                  <article className={`content-editor-card ${hidden ? "content-editor-card-hidden" : ""}`} id={`page-${page.slug}`} key={page.slug}>
                    <div className="content-editor-head">
                      <div>
                        <span className={`module-status ${hidden ? "module-status-hidden" : "module-status-live"}`}>{hidden ? "Masquée du site" : "Visible et modifiable"}</span>
                        <h3>{page.label}</h3>
                        <small className="page-unique-key">Clé indépendante : {page.slug}</small>
                      </div>
                      <a href={page.route} target="_blank" rel="noreferrer">Voir la page ↗</a>
                    </div>

                    <form action={saveSitePage} className="content-editor-form">
                      <input type="hidden" name="slug" value={page.slug} />
                      <label>
                        Titre de cette page uniquement
                        <input name="title" defaultValue={stored?.title || defaults.title} required maxLength={120} autoComplete="off" />
                      </label>
                      <label>
                        Contenu de cette page uniquement
                        <textarea name="content" defaultValue={stored?.content || defaults.content} required rows={14} maxLength={30000} />
                      </label>
                      <button className="btn content-save-button" type="submit" disabled={!sitePages.configured}>Enregistrer cette page</button>
                    </form>

                    <div className="editor-secondary-actions">
                      {stored && (
                        <form action={restoreDefaultSitePage} className="restore-form">
                          <input type="hidden" name="slug" value={page.slug} />
                          <button type="submit" disabled={!sitePages.configured}>Restaurer le contenu intégré</button>
                        </form>
                      )}
                      <form action={setBuiltInCircuitPageVisibility}>
                        <input type="hidden" name="page_key" value={page.slug} />
                        <input type="hidden" name="hidden" value={hidden ? "false" : "true"} />
                        <button className={hidden ? "visibility-button" : "visibility-button visibility-button-danger"} type="submit">
                          {hidden ? "Réafficher sur le site" : "Supprimer du menu du site"}
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </section>

      <section className="dashboard-section-heading" id="custom-pages">
        <p className="eyebrow">PAGES PERSONNALISÉES</p>
        <h2>Ajouter ou supprimer une page sans refaire le code</h2>
        <p>Tu peux rattacher une nouvelle page à une catégorie existante ou créer une nouvelle catégorie dans le menu.</p>
      </section>

      <article className="backoffice-panel custom-page-create-panel">
        <div className="panel-heading"><span className="panel-icon">＋</span><div><h2>Créer une nouvelle page</h2><p>Elle apparaîtra immédiatement dans le menu du Nostra Circuit après enregistrement.</p></div></div>
        <form action={saveCustomCircuitPage} className="backoffice-form backoffice-form-wide" autoComplete="off">
          <label>Catégorie existante
            <select name="category_key" defaultValue="presentation">
              {BUILT_IN_CIRCUIT_CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
              <option value="pages-personnalisees">Nouvelle catégorie personnalisée</option>
            </select>
          </label>
          <label>Nom de la nouvelle catégorie<input name="category_label" placeholder="Seulement si catégorie personnalisée" /></label>
          <label>Ordre d’affichage<input type="number" name="sort_order" defaultValue="100" min="0" /></label>
          <label>Nom dans le menu<input name="label" required placeholder="Exemple : Records du circuit" /></label>
          <label>Titre de la page<input name="title" required placeholder="Exemple : Records officiels" /></label>
          <label>Adresse courte facultative<input name="slug" placeholder="records-officiels" /></label>
          <label className="form-span-3">Contenu<textarea name="content" required rows={10} placeholder="Écris ici le contenu de la nouvelle page." /></label>
          <label className="checkbox-label"><input type="checkbox" name="visible" defaultChecked /> Page visible dans le menu</label>
          <button className="btn" type="submit">Créer la page</button>
        </form>
      </article>

      <section className="custom-page-admin-list">
        {customPages.length === 0 && <div className="backoffice-panel empty-state">Aucune page personnalisée créée.</div>}
        {customPages.map((page) => (
          <article className="backoffice-panel" key={page.id}>
            <div className="content-editor-head">
              <div><span className="module-status module-status-live">Page personnalisée</span><h3>{page.category_label} — {page.label}</h3><small className="page-unique-key">/circuit/personnalise/{page.slug}</small></div>
              <a href={`/circuit/personnalise/${page.slug}`} target="_blank" rel="noreferrer">Voir la page ↗</a>
            </div>
            <form action={saveCustomCircuitPage} className="backoffice-form backoffice-form-wide" autoComplete="off">
              <input type="hidden" name="id" value={page.id} />
              <label>Clé de catégorie<input name="category_key" defaultValue={page.category_key} required /></label>
              <label>Nom de catégorie<input name="category_label" defaultValue={page.category_label} required /></label>
              <label>Ordre<input type="number" name="sort_order" defaultValue={page.sort_order} min="0" /></label>
              <label>Nom dans le menu<input name="label" defaultValue={page.label} required /></label>
              <label>Titre<input name="title" defaultValue={page.title} required /></label>
              <label>Adresse<input name="slug" defaultValue={page.slug} required /></label>
              <label className="form-span-3">Contenu<textarea name="content" defaultValue={page.content} required rows={10} /></label>
              <label className="checkbox-label"><input type="checkbox" name="visible" defaultChecked={page.visible} /> Visible</label>
              <button className="btn" type="submit">Enregistrer cette page</button>
            </form>
            <form action={deleteCustomCircuitPage} className="danger-form">
              <input type="hidden" name="id" value={page.id} />
              <button type="submit">Supprimer définitivement cette page personnalisée</button>
            </form>
          </article>
        ))}
      </section>
    </DashboardShell>
  );
}
