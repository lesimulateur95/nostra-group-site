import Link from "next/link";

import { redirect } from "next/navigation";

import { saveRpProfile } from "@/app/actions/profile";

import { placeCartOrder, removeCartItem } from "@/app/actions/orders";

import { checkoutTombolaCart, removeTombolaCart } from "@/app/actions/tombola";
import { checkoutBingoCart, removeBingoCart } from "@/app/actions/bingo";

import { ProfileNavigation } from "@/components/profile/profile-navigation";

import { NotificationLauncher } from "@/components/profile/notification-launcher";

import { MailboxLauncher } from "@/components/profile/mailbox-launcher";

import {

 getAvatarUrl,

 getDiscordId,

 getDiscordName,

 getRpName,

 hasRpProfile,

} from "@/lib/auth/user-profile";
import { getOwnBingoCards, getOwnBingoCart, getOwnHomologationRequests, getOwnTeamRegistrationRequests, getOwnTombolaCart, getOwnTombolaTickets, getOwnWheelSpins, getProfileCommerceData } from "@/lib/backoffice/data";

import { getUnreadNotificationCount } from "@/lib/notifications/data";

import { getMyMailboxOverview } from "@/lib/mail/data";

import { getUserRoleLabel } from "@/lib/auth/access";

import { createClient } from "@/lib/supabase/server";
import styles from "./profile-top-layout.module.css";

type ProfilePageProps = {

 searchParams: Promise<{ error?: string; order_sent?: string; order_error?: string; cart_removed?: string; cart_error?: string; tombola_added?: string; tombola_removed?: string; tombola_cart_error?: string; tombola_order_error?: string; bingo_added?: string; bingo_removed?: string; bingo_cart_error?: string; bingo_order_error?: string }>;

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
 const [role, commerce, homologations, teamRegistrations, wheelSpins, tombolaCart, tombolaTickets, bingoCart, bingoCards, unreadNotifications, mailboxOverview] = await Promise.all([

 getUserRoleLabel(data.user),

 getProfileCommerceData(data.user.id),

 getOwnHomologationRequests(data.user.id),

 getOwnTeamRegistrationRequests(data.user.id),

 getOwnWheelSpins(data.user.id),

 getOwnTombolaCart(data.user.id),

 getOwnTombolaTickets(data.user.id),

 getOwnBingoCart(data.user.id),
 getOwnBingoCards(data.user.id),

 getUnreadNotificationCount(data.user.id),

 getMyMailboxOverview(),

 ]);

 const cartTotal = commerce.cart.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);

 const tombolaCartTotal = tombolaCart ? Number(tombolaCart.unit_price) * Number(tombolaCart.quantity) : 0;

 const bingoCartTotal = bingoCart ? Number(bingoCart.unit_price) * Number(bingoCart.quantity) : 0;

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

 <div className={styles.rightColumn}>

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

 <MailboxLauncher

 address={mailboxOverview.mailbox?.address ?? null}

 configured={mailboxOverview.configured}
 initialUnreadCount={mailboxOverview.unread}

 />

 <NotificationLauncher initialUnreadCount={unreadNotifications} />

 </div>

 </div>

 <ProfileNavigation orders={commerce.orders.length} homologations={homologations.length} teams={teamRegistrations.length} documents={commerce.invoices.length} games={wheelSpins.length + tombolaTickets.length + bingoCards.length} />
 {!commerce.configured && <div className="dashboard-feedback">Les rubriques commerciales seront disponibles dès que le script SQL du Dashboard aura été exécuté.</div>}

 {params.order_sent && <div className="dashboard-feedback dashboard-feedback-success">Commande <strong>{params.order_sent}</strong> envoyée à Nostra Motors. Le stock a été réservé automatiquement.</div>}

 {params.cart_removed && <div className="dashboard-feedback dashboard-feedback-success">L’article a été retiré de ton panier.</div>}
 {params.cart_error && <div className="dashboard-feedback dashboard-feedback-error">Impossible de retirer cet article du panier.</div>}

 {params.tombola_added && <div className="dashboard-feedback dashboard-feedback-success">Les tickets de tombola ont été ajoutés à ton panier.</div>}

 {params.tombola_removed && <div className="dashboard-feedback dashboard-feedback-success">Les tickets de tombola ont été retirés de ton panier.</div>}
 {params.tombola_cart_error && <div className="dashboard-feedback dashboard-feedback-error">Impossible de modifier le panier de la tombola.</div>}

 {params.tombola_order_error && <div className="dashboard-feedback dashboard-feedback-error">La commande de tickets n’a pas pu être validée. Vérifie que la tombola est encore ouverte.</div>}

 {params.bingo_added && <div className="dashboard-feedback dashboard-feedback-success">Les grilles de Bingo ont été ajoutées à ton panier.</div>}
 {params.bingo_removed && <div className="dashboard-feedback dashboard-feedback-success">Les grilles de Bingo ont été retirées de ton panier.</div>}

 {params.bingo_cart_error && <div className="dashboard-feedback dashboard-feedback-error">Impossible de modifier le panier du Bingo.</div>}

 {params.bingo_order_error && <div className="dashboard-feedback dashboard-feedback-error">La commande de grilles n’a pas pu être validée. Vérifie que les ventes sont encore ouvertes.</div>}
 {orderErrorMessage && <div className="dashboard-feedback dashboard-feedback-error">{orderErrorMessage}</div>}

 <section className="profile-commerce-grid">

 <article className="profile-commerce-card loyalty-card">

 <div className="profile-commerce-head"><span>◆</span><div><p>STATUT DE FIDÉLITÉ</p><h2>{commerce.loyalty?.tier ?? "Aucun statut"}</h2></div></div>

 <dl>

 <div><dt>Achats comptabilisés</dt><dd>{commerce.loyalty?.purchases_count ?? 0}</dd></div>
 <div><dt>Remise actuelle</dt><dd>{Number(commerce.loyalty?.discount_percent ?? 0)} %</dd></div>

 </dl>

 <p className="commerce-hint">Silver après 15 achats · Gold après 35 · Black Signature après 60.</p>

 </article>

 <article className="profile-commerce-card">

 <div className="profile-commerce-head"><span></span><div><p>MON PANIER</p><h2>{commerce.cart.length + (tombolaCart ? 1 : 0) + (bingoCart ? 1 : 0)} article(s)</h2></div></div>

 <div className="profile-mini-list">
 {commerce.cart.length === 0 && !tombolaCart && !bingoCart && <p className="empty-state">Ton panier est vide.</p>}

 {commerce.cart.map((item) => (

 <div className="profile-cart-row" key={item.id}>

 <span>{item.quantity} × {item.item_name}</span>

 <strong>{money(Number(item.unit_price) * Number(item.quantity))}</strong>

 <form action={removeCartItem}><input type="hidden" name="id" value={item.id} /><button type="submit" aria-label={`Retirer ${item.item_name} du panier`}>Supprimer</button></form>
 </div>

 ))}

 {tombolaCart && (

 <div className="profile-cart-row profile-cart-row-tombola">

 <span>{tombolaCart.quantity} × Ticket Tombola</span>

 <strong>{money(tombolaCartTotal)}</strong>

 <form action={removeTombolaCart}><button type="submit">Supprimer</button></form>

 </div>

 )}

 {bingoCart && (

 <div className="profile-cart-row profile-cart-row-bingo">

 <span>{bingoCart.quantity} × Grille Bingo</span>

 <strong>{money(bingoCartTotal)}</strong>
 <form action={removeBingoCart}><button type="submit">Supprimer</button></form>

 </div>

 )}

 </div>

 <footer><span>Total du panier</span><strong>{money(cartTotal + tombolaCartTotal + bingoCartTotal)}</strong></footer>

 {commerce.cart.length > 0 && (

 <form action={placeCartOrder} className="profile-order-form">
 <label><span>Message pour Nostra Motors <small>(facultatif)</small></span><textarea name="customer_note" rows={3} maxLength={1500} placeholder="Exemple : couleur souhaitée, disponibilité pour la livraison…" /></label>

 <button className="btn" type="submit" disabled={!commerce.ordersConfigured}>Commander les véhicules</button>

 {!commerce.ordersConfigured && <p>Active d’abord le module depuis <strong>Dashboard → Commandes Nostra Motors</strong>.</p>}

 </form>

 )}

 {tombolaCart && (
 <form action={checkoutTombolaCart} className="profile-order-form profile-tombola-checkout">

 <p className="commerce-hint">La commande Tombola distribue immédiatement {tombolaCart.quantity} numéro(s) aléatoire(s) et unique(s). Tu les retrouveras dans Profil → Jeux.</p>

 <button className="btn" type="submit">Commander mes tickets Tombola</button>

 </form>

 )}

 {bingoCart && (

 <form action={checkoutBingoCart} className="profile-order-form profile-bingo-checkout">
 <p className="commerce-hint">La commande Bingo génère immédiatement {bingoCart.quantity} carton(s), avec 24 numéros et la case centrale Nostra Motors.</p>

 <button className="btn" type="submit">Commander mes grilles Bingo</button>

 </form>

 )}

 </article>

 </section>

 </>

 );
}
