import { redirect } from "next/navigation";
import { restoreDefaultSitePage, saveSitePage } from "@/app/actions/site-content";
import { Topbar } from "@/components/site/topbar";
import { getDiscordName, getRpName, getSiteRole, isManager } from "@/lib/auth/user-profile";
import { DEFAULT_EDITOR_CONTENT } from "@/lib/content/default-editor-content";
import { EDITABLE_PAGE_CONFIG, getAllSitePages } from "@/lib/content/site-content";
import { SITE_CONTENT_SETUP_SQL } from "@/lib/content/setup-sql";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!isManager(data.user)) redirect("/accueil");

  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved : null;
  const restored = typeof params.restored === "string" ? params.restored : null;
  const error = typeof params.error === "string" ? params.error : null;
  const sitePages = await getAllSitePages();

  return (
    <div className="site-shell">
      <Topbar />
      <main className="dashboard-main">
        <section className="dashboard-hero">
          <div>
            <span className="eyebrow">DIRECTION NOSTRA GROUP</span>
            <h1 className="page-title">Dashboard Gérant</h1>
            <p className="lead">
              Bienvenue {getRpName(data.user) || getDiscordName(data.user)}. Tu peux maintenant modifier réellement les pages du Nostra Circuit.
            </p>
          </div>
          <span className="manager-seal">{getSiteRole(data.user)}</span>
        </section>

        {saved && <div className="dashboard-feedback dashboard-feedback-success">La page a bien été enregistrée.</div>}
        {restored && <div className="dashboard-feedback">Le contenu intégré par défaut a été restauré.</div>}
        {error && <div className="dashboard-feedback dashboard-feedback-error">Impossible d’enregistrer. Vérifie que la base du dashboard est activée dans Supabase.</div>}

        {!sitePages.configured && (
          <section className="dashboard-setup">
            <div>
              <span className="module-status">Activation nécessaire</span>
              <h2>Activer les modifications du dashboard</h2>
              <p>Le site reste fonctionnel, mais Supabase doit recevoir cette table une seule fois pour enregistrer tes modifications.</p>
            </div>
            <details>
              <summary>Afficher le code SQL à copier dans Supabase</summary>
              <pre>{SITE_CONTENT_SETUP_SQL}</pre>
            </details>
            <ol>
              <li>Dans Supabase, ouvre <strong>SQL Editor</strong>.</li>
              <li>Crée une nouvelle requête, colle le code ci-dessus et clique sur <strong>Run</strong>.</li>
              <li>Actualise ensuite ce dashboard.</li>
            </ol>
          </section>
        )}

        <section className="dashboard-section-heading">
          <p className="eyebrow">Gestion du contenu</p>
          <h2>Pages du Nostra Circuit</h2>
          <p>Chaque bouton Enregistrer publie immédiatement le nouveau texte pour tous les membres connectés.</p>
        </section>

        <section className="content-editor-grid">
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
      </main>
    </div>
  );
}
