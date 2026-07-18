import { redirect } from "next/navigation";
import { saveRpProfile } from "@/app/actions/profile";
import { Topbar } from "@/components/site/topbar";
import {
  getAvatarUrl,
  getDiscordId,
  getDiscordName,
  getRpName,
  getSiteRole,
  hasRpProfile,
} from "@/lib/auth/user-profile";
import { getProfileCommerceData } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

type ProfilePageProps = {
  searchParams: Promise<{ error?: string }>;
};

function money(value: number | string) {
  return Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const params = await searchParams;
  const metadata = data.user.user_metadata ?? {};
  const avatarUrl = getAvatarUrl(data.user);
  const rpName = getRpName(data.user);
  const complete = hasRpProfile(data.user);
  const role = getSiteRole(data.user);
  const commerce = await getProfileCommerceData(data.user.id);
  const cartTotal = commerce.cart.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);

  const errorMessage =
    params.error === "invalid_name"
      ? "Entre un prénom et un nom RP valides, entre 2 et 32 caractères."
      : params.error === "save_failed"
        ? "Le profil n’a pas pu être sauvegardé. Réessaie dans un instant."
        : null;

  return (
    <div className="site-shell">
      <Topbar />
      <main className="profile-main">
        <section className="profile-heading">
          <span className="eyebrow">ESPACE PERSONNEL</span>
          <h1 className="page-title">Mon profil</h1>
          <p className="lead">Ton identité RP, tes commandes, ta fidélité, ton panier et tes factures sont regroupés dans ton espace personnel.</p>
        </section>

        <div className="profile-layout">
          <aside className="profile-card profile-summary">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="profile-avatar" src={avatarUrl} alt="Avatar Discord" />
            ) : (
              <div className="profile-avatar profile-avatar-fallback">NG</div>
            )}
            <div><span className="profile-label">Nom RP</span><strong className="profile-name">{rpName || "À compléter"}</strong></div>
            <dl className="profile-details">
              <div><dt>Compte Discord</dt><dd>{getDiscordName(data.user)}</dd></div>
              <div><dt>Rôle</dt><dd><span className="role-badge">{role}</span></dd></div>
              <div><dt>Identifiant Discord</dt><dd>{getDiscordId(data.user) ?? "Non détecté"}</dd></div>
              <div><dt>E-mail</dt><dd>{data.user.email ?? "Non communiqué"}</dd></div>
            </dl>
          </aside>

          <section className="profile-card profile-form-card">
            <div className="profile-form-title">
              <div><span className="eyebrow">IDENTITÉ RP</span><h2>{complete ? "Modifier mon identité" : "Créer mon identité RP"}</h2></div>
              {!complete && <span className="required-badge">Obligatoire</span>}
            </div>
            <p className="profile-help">Discord sert uniquement à sécuriser la connexion. Le site utilise ton prénom et ton nom RP.</p>
            {errorMessage && <p className="form-error">{errorMessage}</p>}
            <form action={saveRpProfile} className="profile-form">
              <label><span>Prénom RP</span><input name="rp_first_name" required minLength={2} maxLength={32} defaultValue={typeof metadata.rp_first_name === "string" ? metadata.rp_first_name : ""} placeholder="Exemple : Liam" autoComplete="off" /></label>
              <label><span>Nom RP</span><input name="rp_last_name" required minLength={2} maxLength={32} defaultValue={typeof metadata.rp_last_name === "string" ? metadata.rp_last_name : ""} placeholder="Exemple : Nostra" autoComplete="off" /></label>
              <button className="btn profile-submit" type="submit">{complete ? "Enregistrer les modifications" : "Valider mon profil"}</button>
            </form>
          </section>
        </div>

        {!commerce.configured && (
          <div className="dashboard-feedback">Les rubriques commerciales seront disponibles dès que le nouveau script SQL du Dashboard aura été exécuté.</div>
        )}

        <section className="profile-commerce-grid">
          <article className="profile-commerce-card loyalty-card">
            <div className="profile-commerce-head"><span>◆</span><div><p>STATUT DE FIDÉLITÉ</p><h2>{commerce.loyalty?.tier ?? "Aucun statut"}</h2></div></div>
            <dl>
              <div><dt>Achats comptabilisés</dt><dd>{commerce.loyalty?.purchases_count ?? 0}</dd></div>
              <div><dt>Remise actuelle</dt><dd>{Number(commerce.loyalty?.discount_percent ?? 0)} %</dd></div>
            </dl>
            <p className="commerce-hint">Silver après 5 achats · Gold après 15 · Black Signature après 20.</p>
          </article>

          <article className="profile-commerce-card">
            <div className="profile-commerce-head"><span>🛒</span><div><p>MON PANIER</p><h2>{commerce.cart.length} article(s)</h2></div></div>
            <div className="profile-mini-list">
              {commerce.cart.length === 0 && <p className="empty-state">Ton panier est vide.</p>}
              {commerce.cart.map((item) => <div key={item.id}><span>{item.quantity} × {item.item_name}</span><strong>{money(Number(item.unit_price) * Number(item.quantity))}</strong></div>)}
            </div>
            <footer><span>Total</span><strong>{money(cartTotal)}</strong></footer>
          </article>
        </section>

        <section className="profile-data-section">
          <div className="profile-data-heading"><div><p className="eyebrow">ESPACE CLIENT</p><h2>Mes commandes</h2></div><span>{commerce.orders.length}</span></div>
          <div className="profile-table-wrap">
            <table className="profile-data-table">
              <thead><tr><th>Numéro</th><th>Date</th><th>Statut</th><th>Total</th></tr></thead>
              <tbody>
                {commerce.orders.length === 0 && <tr><td colSpan={4} className="empty-table-cell">Aucune commande enregistrée.</td></tr>}
                {commerce.orders.map((order) => <tr key={order.id}><td><strong>{order.order_number}</strong></td><td>{new Date(order.created_at).toLocaleDateString("fr-FR")}</td><td><span className="order-status">{order.status}</span></td><td>{money(order.total)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="profile-data-section">
          <div className="profile-data-heading"><div><p className="eyebrow">DOCUMENTS</p><h2>Mes factures</h2></div><span>{commerce.invoices.length}</span></div>
          <div className="profile-table-wrap">
            <table className="profile-data-table">
              <thead><tr><th>Facture</th><th>Date</th><th>Statut</th><th>Montant</th><th>Document</th></tr></thead>
              <tbody>
                {commerce.invoices.length === 0 && <tr><td colSpan={5} className="empty-table-cell">Aucune facture disponible.</td></tr>}
                {commerce.invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoice_number}</strong></td><td>{new Date(invoice.issued_at).toLocaleDateString("fr-FR")}</td><td>{invoice.status}</td><td>{money(invoice.amount)}</td><td>{invoice.download_url ? <a href={invoice.download_url} target="_blank" rel="noreferrer">Ouvrir ↗</a> : "À venir"}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
