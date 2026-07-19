import { redirect } from "next/navigation";
import { saveRpProfile } from "@/app/actions/profile";
import { placeCartOrder, removeCartItem } from "@/app/actions/orders";
import { ProfileNavigation } from "@/components/profile/profile-navigation";
import {
  getAvatarUrl,
  getDiscordId,
  getDiscordName,
  getRpName,
  hasRpProfile,
} from "@/lib/auth/user-profile";
import { getOwnHomologationRequests, getOwnTeamRegistrationRequests, getProfileCommerceData } from "@/lib/backoffice/data";
import { getUserRoleLabel } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

type ProfilePageProps = {
  searchParams: Promise<{ error?: string; order_sent?: string; order_error?: string; cart_removed?: string; cart_error?: string }>;
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
  const [role, commerce, homologations, teamRegistrations] = await Promise.all([
    getUserRoleLabel(data.user),
    getProfileCommerceData(data.user.id),
    getOwnHomologationRequests(data.user.id),
    getOwnTeamRegistrationRequests(data.user.id),
  ]);
  const cartTotal = commerce.cart.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);

  const orderErrorMessage =
    params.order_error === "empty" ? "Ton panier est vide."
      : params.order_error === "setup" ? "La liaison stock, panier et commandes doit être activée depuis le Dashboard."
        : params.order_error === "stock" ? "La quantité demandée n’est plus disponible. Retire l’article concerné ou réduis ton panier."
          : params.order_error === "unavailable" ? "Un véhicule de ton panier n’est plus publié dans le catalogue."
            : params.order_error === "cart-refresh" ? "Ton panier contient une ancienne ligne qui n’est plus liée au catalogue. Retire-la puis ajoute de nouveau le véhicule."
              : params.order_error ? "La commande n’a pas pu être envoyée. Réessaie dans un instant." : null;

  const errorMessage =
    params.error === "invalid_name" ? "Entre un prénom et un nom RP valides, entre 2 et 32 caractères."
      : params.error === "save_failed" ? "Le profil n’a pas pu être sauvegardé. Réessaie dans un instant." : null;

  return (
    <>
      <section className="profile-heading">
        <span className="eyebrow">ESPACE PERSONNEL</span>
        <h1 className="page-title">Mon profil</h1>
        <p className="lead">Ton identité, ton panier et tous tes dossiers sont maintenant rangés dans des pages séparées.</p>
      </section>

      <div className="profile-layout">
        <aside className="profile-card profile-summary">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="profile-avatar" src={avatarUrl} alt="Avatar Discord" />
          ) : <div className="profile-avatar profile-avatar-fallback">NG</div>}
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

      <ProfileNavigation orders={commerce.orders.length} homologations={homologations.length} teams={teamRegistrations.length} documents={commerce.invoices.length} />

      {!commerce.configured && <div className="dashboard-feedback">Les rubriques commerciales seront disponibles dès que le script SQL du Dashboard aura été exécuté.</div>}
      {params.order_sent && <div className="dashboard-feedback dashboard-feedback-success">Commande <strong>{params.order_sent}</strong> envoyée à Nostra Motors. Le stock a été réservé automatiquement.</div>}
      {params.cart_removed && <div className="dashboard-feedback dashboard-feedback-success">L’article a été retiré de ton panier.</div>}
      {params.cart_error && <div className="dashboard-feedback dashboard-feedback-error">Impossible de retirer cet article du panier.</div>}
      {orderErrorMessage && <div className="dashboard-feedback dashboard-feedback-error">{orderErrorMessage}</div>}

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
            {commerce.cart.map((item) => (
              <div className="profile-cart-row" key={item.id}>
                <span>{item.quantity} × {item.item_name}</span>
                <strong>{money(Number(item.unit_price) * Number(item.quantity))}</strong>
                <form action={removeCartItem}><input type="hidden" name="id" value={item.id} /><button type="submit" aria-label={`Retirer ${item.item_name} du panier`}>Supprimer</button></form>
              </div>
            ))}
          </div>
          <footer><span>Total</span><strong>{money(cartTotal)}</strong></footer>
          {commerce.cart.length > 0 && (
            <form action={placeCartOrder} className="profile-order-form">
              <label><span>Message pour Nostra Motors <small>(facultatif)</small></span><textarea name="customer_note" rows={3} maxLength={1500} placeholder="Exemple : couleur souhaitée, disponibilité pour la livraison…" /></label>
              <button className="btn" type="submit" disabled={!commerce.ordersConfigured}>Passer la commande</button>
              {!commerce.ordersConfigured && <p>Active d’abord le module depuis <strong>Dashboard → Commandes Nostra Motors</strong>.</p>}
            </form>
          )}
        </article>
      </section>
    </>
  );
}
