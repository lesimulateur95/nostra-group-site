import {
  deleteCustomCircuitPage,
  deleteCustomSectionPage,
  saveCustomCircuitPage,
  saveCustomSectionPage,
  setBuiltInCircuitPageVisibility,
  setBuiltInSectionPageVisibility,
} from "@/app/actions/admin-management";
import { restoreDefaultSitePage, saveSitePage } from "@/app/actions/site-content";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NavigationOrderEditor } from "@/components/dashboard/navigation-order-editor";
import {
  BUILT_IN_CIRCUIT_CATEGORIES,
  getCircuitNavigation,
  getCustomCircuitPages,
  getHiddenCircuitPageKeys,
} from "@/lib/content/circuit-navigation";
import { DEFAULT_EDITOR_CONTENT } from "@/lib/content/default-editor-content";
import {
  BUILT_IN_SECTION_CATEGORIES,
  getCustomSectionPages,
  getHiddenSectionPageKeys,
  getSectionNavigation,
  type CustomPageSection,
} from "@/lib/content/section-navigation";
import {
  getAllSitePages,
  getEditablePagesBySection,
  type EditableSiteSection,
} from "@/lib/content/site-content";
import { SITE_CONTENT_SETUP_SQL } from "@/lib/content/setup-sql";

const SECTION_COPY: Record<EditableSiteSection, { title: string; description: string; eyebrow: string }> = {
  motors: {
    title: "Modifier Nostra Motors",
    description: "Modifie les pages existantes et crée librement de nouvelles pages ou rubriques Nostra Motors.",
    eyebrow: "GESTION NOSTRA MOTORS",
  },
  circuit: {
    title: "Modifier Nostra Circuit",
    description: "Chaque page et sous-page du circuit possède son propre titre et son propre contenu.",
    eyebrow: "GESTION NOSTRA CIRCUIT",
  },
  evenements: {
    title: "Modifier Jeux & Événements",
    description: "Modifie les pages existantes et crée librement de nouvelles pages ou rubriques Jeux & Événements.",
    eyebrow: "GESTION ÉVÉNEMENTS & JEUX",
  },
};

export async function SiteSectionEditor({
  section,
  searchParams,
}: {
  section: EditableSiteSection;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const copy = SECTION_COPY[section];
  const saved = typeof searchParams.saved === "string" ? searchParams.saved : null;
  const restored = typeof searchParams.restored === "string" ? searchParams.restored : null;
  const error = typeof searchParams.error === "string" ? searchParams.error : null;
  const pagesForSection = getEditablePagesBySection(section);

  const [sitePages, customPages, hiddenPageKeys, navigationItems] = await Promise.all([
    getAllSitePages(),
    section === "circuit" ? getCustomCircuitPages() : getCustomSectionPages(section as CustomPageSection),
    section === "circuit"
      ? getHiddenCircuitPageKeys()
      : getHiddenSectionPageKeys(section as CustomPageSection),
    section === "circuit" ? getCircuitNavigation() : getSectionNavigation(section as CustomPageSection),
  ]);

  const navigationOrderItems = navigationItems.map((item) => ({
    key: item.key ?? item.href,
    label: item.label,
    children: (item.children ?? []).map((child) => ({
      key: child.key ?? child.href,
      label: child.label,
    })),
  }));

  const grouped = new Map<string, typeof pagesForSection>();
  for (const page of pagesForSection) {
    const current = grouped.get(page.category) ?? [];
    current.push(page);
    grouped.set(page.category, current);
  }

  const customSaveAction = section === "circuit" ? saveCustomCircuitPage : saveCustomSectionPage;
  const customDeleteAction = section === "circuit" ? deleteCustomCircuitPage : deleteCustomSectionPage;
  const availableCategories = section === "circuit"
    ? BUILT_IN_CIRCUIT_CATEGORIES
    : BUILT_IN_SECTION_CATEGORIES[section as CustomPageSection];
  const sectionDisplayName = section === "circuit"
    ? "Nostra Circuit"
    : section === "motors"
      ? "Nostra Motors"
      : "Jeux & Événements";

  return (
    <DashboardShell>
      <DashboardHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <nav className="dashboard-editor-switcher" aria-label="Choisir une partie du site à modifier">
        <a className={section === "motors" ? "is-active" : ""} href="/dashboard/contenu/motors">Nostra Motors</a>
        <a className={section === "circuit" ? "is-active" : ""} href="/dashboard/contenu/circuit">Nostra Circuit</a>
        <a className={section === "evenements" ? "is-active" : ""} href="/dashboard/contenu/evenements">Jeux & Événements</a>
      </nav>

      {saved && <div className="dashboard-feedback dashboard-feedback-success">La page « {saved} » a bien été enregistrée.</div>}
      {restored && <div className="dashboard-feedback">Le contenu intégré de « {restored} » a été restauré.</div>}
      {searchParams.custom_saved && <div className="dashboard-feedback dashboard-feedback-success">La page personnalisée a été enregistrée.</div>}
      {searchParams.custom_deleted && <div className="dashboard-feedback">La page personnalisée a été supprimée.</div>}
      {searchParams.visibility_saved && <div className="dashboard-feedback dashboard-feedback-success">La visibilité de la page a été mise à jour.</div>}
      {searchParams.order_saved && <div className="dashboard-feedback dashboard-feedback-success">Le nouvel ordre du menu a été enregistré.</div>}
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

      {sitePages.configured && (
        <NavigationOrderEditor section={section} initialItems={navigationOrderItems} />
      )}

      <section className="dashboard-section-heading dashboard-section-heading-tight">
        <p className="eyebrow">PAGES INTÉGRÉES</p>
        <h2>{pagesForSection.length} page(s) modifiables séparément</h2>
        <p>Chaque formulaire correspond à une seule page. Enregistrer ici ne modifiera aucune autre page.</p>
      </section>

      <section className="category-editor-list">
        {[...grouped.entries()].map(([category, pages]) => (
          <section className="category-editor category-editor-expanded" key={category}>
            <div className="category-editor-heading">
              <span>{category}</span>
              <small>{pages.length} page(s) indépendante(s)</small>
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
                        <span className={`module-status ${hidden ? "module-status-hidden" : "module-status-live"}`}>
                          {hidden ? "Masquée du site" : "Visible et modifiable"}
                        </span>
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
                      <form action={section === "circuit" ? setBuiltInCircuitPageVisibility : setBuiltInSectionPageVisibility}>
                        {section !== "circuit" && <input type="hidden" name="section" value={section} />}
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
        <h2>Ajouter ou supprimer une page sans repasser par moi</h2>
        <p>Choisis une rubrique existante ou crée une nouvelle rubrique. La nouvelle page apparaîtra automatiquement dans le menu de {sectionDisplayName}.</p>
      </section>

      <article className="backoffice-panel custom-page-create-panel">
        <div className="panel-heading">
          <span className="panel-icon">＋</span>
          <div>
            <h2>Créer une nouvelle page {sectionDisplayName}</h2>
            <p>Tu pourras ensuite la modifier, la masquer ou la supprimer depuis cette même page.</p>
          </div>
        </div>
        <form action={customSaveAction} className="backoffice-form backoffice-form-wide" autoComplete="off">
          {section !== "circuit" && <input type="hidden" name="section" value={section} />}
          <label>Catégorie existante
            <select name="category_key" defaultValue="presentation">
              {availableCategories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
              <option value="pages-personnalisees">Nouvelle catégorie personnalisée</option>
            </select>
          </label>
          <label>Nom de la nouvelle catégorie<input name="category_label" placeholder="Seulement si catégorie personnalisée" /></label>
          <label>Ordre d’affichage<input type="number" name="sort_order" defaultValue="100" min="0" /></label>
          <label>Nom dans le menu<input name="label" required placeholder="Exemple : Nouveautés" /></label>
          <label>Titre de la page<input name="title" required placeholder="Exemple : Nos dernières nouveautés" /></label>
          <label>Adresse courte facultative<input name="slug" placeholder="nouveautes" /></label>
          <label className="form-span-3">Contenu<textarea name="content" required rows={10} placeholder="Écris ici le contenu de la nouvelle page." /></label>
          <label className="checkbox-label"><input type="checkbox" name="visible" defaultChecked /> Page visible dans le menu</label>
          <button className="btn" type="submit">Créer la page</button>
        </form>
      </article>

      <section className="custom-page-admin-list">
        {customPages.length === 0 && <div className="backoffice-panel empty-state">Aucune page personnalisée créée dans cette partie du site.</div>}
        {customPages.map((page) => {
          const publicHref = section === "circuit" ? `/circuit/personnalise/${page.slug}` : `/${section}/personnalise/${page.slug}`;
          return (
            <article className="backoffice-panel" key={page.id}>
              <div className="content-editor-head">
                <div>
                  <span className="module-status module-status-live">Page personnalisée</span>
                  <h3>{page.category_label} — {page.label}</h3>
                  <small className="page-unique-key">{publicHref}</small>
                </div>
                <a href={publicHref} target="_blank" rel="noreferrer">Voir la page ↗</a>
              </div>
              <form action={customSaveAction} className="backoffice-form backoffice-form-wide" autoComplete="off">
                <input type="hidden" name="id" value={page.id} />
                {section !== "circuit" && <input type="hidden" name="section" value={section} />}
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
              <form action={customDeleteAction} className="danger-form">
                <input type="hidden" name="id" value={page.id} />
                {section !== "circuit" && <input type="hidden" name="section" value={section} />}
                <button type="submit">Supprimer définitivement cette page personnalisée</button>
              </form>
            </article>
          );
        })}
      </section>
    </DashboardShell>
  );
}
