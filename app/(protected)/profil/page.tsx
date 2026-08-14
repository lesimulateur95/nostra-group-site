import Link from "next/link";

import { redirect } from "next/navigation";

import {
 checkoutVehicleReservationBalances,
 checkoutVehicleReservationDeposits,
 placeCartOrder,
 removeCartItem,
} from "@/app/actions/orders";

import { checkoutTombolaCart, removeTombolaCart } from "@/app/actions/tombola";
import { checkoutBingoCart, removeBingoCart } from "@/app/actions/bingo";
import { checkoutPilotLicenseCart, removePilotLicenseCart } from "@/app/actions/licenses";
import { checkoutContractRenewals } from "@/app/actions/contracts";

import { ProfileNavigation } from "@/components/profile/profile-navigation";
import { LoyaltyCard } from "@/components/loyalty/loyalty-card";
import { IdentityCard } from "@/components/profile/identity-card";
import { ClearCatalogueSelectionV1601 } from "@/components/motors/clear-catalogue-selection-v1601";
import { DeliveryAddressPickerV161 } from "@/components/motors/delivery-address-picker-v161";
import { VehicleHoldCountdownV161 } from "@/components/motors/vehicle-hold-countdown-v161";

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
import { getOwnPilotLicenseCart } from "@/lib/licenses/data";
import { getAcademyLicenseEligibilityV140 } from "@/lib/racing-academy/license-requirements";
import { getPilotLicenseServiceKey, getServiceAvailability } from "@/lib/system/service-availability";

import { getUnreadNotificationCount } from "@/lib/notifications/data";

import { getMyMailboxOverview } from "@/lib/mail/data";

import { getUserRoleLabel } from "@/lib/auth/access";

import { createClient } from "@/lib/supabase/server";
import { calculateDeliveryTransportPlanV160, calculateHomeDeliveryFeeV160, formatDeliveryTransportPlanV160 } from "@/lib/nostra-motors/delivery-v160";
import { getMyDeliveryAddressesV161, getMyVehicleHoldSummaryV161 } from "@/lib/nostra-motors/v161-data";
import { getOwnVehicleReservations } from "@/lib/vehicle-reservations/data";
import { getOwnVehicleTradeInRequests } from "@/lib/vehicle-trade-ins/data";
import { getOwnSearchMandatesV134 } from "@/lib/vehicle-search-mandates/data";
import { getOwnVehicleConsignmentsV134 } from "@/lib/vehicle-consignments/data";
import { getActiveLoyaltyCard, getLoyaltyDiscountPercent } from "@/lib/loyalty-cards/data";
import { getOwnMemberRoles, MEMBER_ROLE_LABELS, type MemberRoleKey } from "@/lib/member-roles/data";
import { getOwnContractCart } from "@/lib/contracts/data";
import { getOwnVehicleFinancingApplications } from "@/lib/vehicle-financing/data";
import styles from "./profile-top-layout.module.css";

type ProfilePageProps = {

 searchParams: Promise<{ setup?: string; error?: string; profile_saved?: string; vehicle_added?: string; selection_added?: string; reservation_added?: string; reservation_paid?: string; reservation_error?: string; balance_paid?: string; balance_error?: string; order_sent?: string; order_error?: string; cart_removed?: string; cart_error?: string; tombola_added?: string; tombola_removed?: string; tombola_cart_error?: string; tombola_order_error?: string; bingo_added?: string; bingo_removed?: string; bingo_cart_error?: string; bingo_order_error?: string; license_added?: string; license_removed?: string; license_paid?: string; license_order_error?: string; contract_paid?: string; contract_error?: string }>;

};

function money(value: number | string) {
 return Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {

 const supabase = await createClient();

 const { data } = await supabase.auth.getUser();

 if (!data.user) redirect("/");

 const params = await searchParams;

 await (supabase as any).rpc("nostra_cleanup_expired_holds_v161");

 const metadata = data.user.user_metadata ?? {};

 const { data: steamProfile } = await supabase
  .from("member_profiles")
  .select("steam_id")
  .eq("user_id", data.user.id)
  .maybeSingle();

 const steamId =
  typeof steamProfile?.steam_id === "string" && steamProfile.steam_id.trim()
   ? steamProfile.steam_id
   : typeof metadata.steam_id === "string" && metadata.steam_id.trim()
    ? metadata.steam_id
    : null;

 const avatarUrl = getAvatarUrl(data.user);

 const rpName = getRpName(data.user);

 const complete = hasRpProfile(data.user);
 const [role, commerce, homologations, teamRegistrations, wheelSpins, tombolaCart, tombolaTickets, bingoCart, bingoCards, licenseCart, unreadNotifications, mailboxOverview, vehicleReservations, vehicleTradeIns, activeLoyaltyCard, memberRoles, contractCart, vehicleFinancing, searchMandates, vehicleConsignments] = await Promise.all([

 getUserRoleLabel(data.user),

 getProfileCommerceData(data.user.id),

 getOwnHomologationRequests(data.user.id),

 getOwnTeamRegistrationRequests(data.user.id),

 getOwnWheelSpins(data.user.id),

 getOwnTombolaCart(data.user.id),

 getOwnTombolaTickets(data.user.id),

 getOwnBingoCart(data.user.id),
 getOwnBingoCards(data.user.id),

 getOwnPilotLicenseCart(data.user.id),


 getUnreadNotificationCount(data.user.id),

 getMyMailboxOverview(),

 getOwnVehicleReservations(data.user.id),

 getOwnVehicleTradeInRequests(data.user.id),

 getActiveLoyaltyCard(data.user.id),

 getOwnMemberRoles(data.user.id),

 getOwnContractCart(data.user.id),

 getOwnVehicleFinancingApplications(data.user.id),

 getOwnSearchMandatesV134(data.user.id),

 getOwnVehicleConsignmentsV134(data.user.id),

 ]);

 const [deliveryAddressesV161, vehicleHoldSummaryV161] = await Promise.all([
  getMyDeliveryAddressesV161(data.user.id),
  getMyVehicleHoldSummaryV161(data.user.id),
 ]);

 const normalVehicleCart = commerce.cart.filter((item) => ["vehicle", "delivery"].includes(String(item.item_type)));
 const vehicleCartLines = commerce.cart.filter((item) => item.item_type === "vehicle" && Number(item.vehicle_id) > 0);
 const cartVehicleIds = [...new Set(vehicleCartLines.map((item) => Number(item.vehicle_id)).filter((id) => Number.isFinite(id) && id > 0))];
 const { data: cartVehicleCatalogRows } = cartVehicleIds.length > 0
  ? await supabase.from("catalog_vehicles").select("id,catalog_type").in("id", cartVehicleIds)
  : { data: [] as Array<{ id: number; catalog_type: string | null }> };
 const cartCatalogTypeByVehicleId = new Map<number, string>(
  ((cartVehicleCatalogRows ?? []) as Array<{ id: number; catalog_type: string | null }>).map((row) => [
   Number(row.id),
   String(row.catalog_type ?? "standard"),
  ]),
 );
 const eligibleDeliveryVehicleLines = vehicleCartLines.filter((item) => {
  const catalogType = cartCatalogTypeByVehicleId.get(Number(item.vehicle_id)) ?? "standard";
  return !["concession", "heavy"].includes(catalogType);
 });
 const eligibleDeliveryVehicleCount = eligibleDeliveryVehicleLines.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
 const eligibleDeliveryVehicleValue = eligibleDeliveryVehicleLines.reduce((sum, item) => sum + Math.max(0, Number(item.unit_price) || 0) * Math.max(1, Number(item.quantity) || 1), 0);
 const estimatedHomeDeliveryFee = calculateHomeDeliveryFeeV160(eligibleDeliveryVehicleValue);
 const deliveryTransportPlan = calculateDeliveryTransportPlanV160(eligibleDeliveryVehicleCount);
 const deliveryTransportLabel = formatDeliveryTransportPlanV160(deliveryTransportPlan);
 const hasHomeDeliveryInCart = commerce.cart.some((item) => item.item_type === "delivery");
 const excludedDeliveryVehicleCount = vehicleCartLines.reduce((sum, item) => {
  const catalogType = cartCatalogTypeByVehicleId.get(Number(item.vehicle_id)) ?? "standard";
  return ["concession", "heavy"].includes(catalogType) ? sum + Math.max(1, Number(item.quantity) || 1) : sum;
 }, 0);
 const profileDeliveryPhone = typeof metadata.phone === "string" ? metadata.phone : "";
 const profileDeliveryAddress = typeof metadata.address === "string" ? metadata.address : "";
 const reservationDepositCart = commerce.cart.filter((item) => item.item_type === "reservation_deposit");
 const reservationBalanceCart = commerce.cart.filter((item) => item.item_type === "reservation_balance");
 const financingPaymentCart = commerce.cart.filter((item) => ["financing_deposit", "financing_installment"].includes(String(item.item_type)));
 const cartTotal = commerce.cart.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
 const loyaltyDiscountPercent = getLoyaltyDiscountPercent(
  activeLoyaltyCard?.tier ?? commerce.loyalty?.tier,
 );

 const tombolaCartTotal = tombolaCart ? Number(tombolaCart.unit_price) * Number(tombolaCart.quantity) : 0;

 const bingoCartTotal = bingoCart ? Number(bingoCart.unit_price) * Number(bingoCart.quantity) : 0;

 const licenseCartTotal = licenseCart ? Number(licenseCart.unit_price) : 0;
 const [licensePurchaseService, academyEligibility] = licenseCart
  ? await Promise.all([
      getServiceAvailability(getPilotLicenseServiceKey(licenseCart.license_code)),
      getAcademyLicenseEligibilityV140(data.user.id, licenseCart.license_code),
    ])
  : [null, null];
 const canCheckoutPilotLicense = Boolean(
  licenseCart && academyEligibility?.eligible && licensePurchaseService?.isOpen !== false,
 );

 const contractCartTotal = contractCart.items.reduce((sum, item) => sum + Number(item.amount), 0);

 const orderErrorMessage =
 params.order_error === "empty" ? "Ton panier est vide."

 : params.order_error === "setup" ? "La liaison stock, panier et commandes doit être activée depuis le Dashboard."

 : params.order_error === "stock" ? "La quantité demandée n’est plus disponible. Retire l’article concerné ou réduis ton panier."

 : params.order_error === "unavailable" ? "Un véhicule de ton panier n’est plus publié dans le catalogue."
 : params.order_error === "tier-required" ? "Achat bloqué : au moins un véhicule de ton panier est réservé à un autre grade de fidélité (Silver, Gold ou Black Signature)."
 : params.order_error === "cart-refresh" ? "Ton panier contient une ancienne ligne qui n’est plus liée au catalogue. Retire-la puis ajoute de nouveau le véhicule."
 : params.order_error === "promo-unknown" ? "Ce code promotionnel n’existe pas."
 : params.order_error === "promo-disabled" ? "Ce code promotionnel est désactivé."
 : params.order_error === "promo-date" ? "Ce code promotionnel n’est pas utilisable à cette date."
 : params.order_error === "promo-scope" ? "Ce code promotionnel ne s’applique pas aux commandes Nostra Motors."
 : params.order_error === "promo-minimum" ? "Le montant minimum demandé par ce code promotionnel n’est pas atteint."
 : params.order_error === "promo-limit" ? "La limite d’utilisation de ce code promotionnel est atteinte."
 : params.order_error === "delivery" ? "Choisis un mode de récupération valide pour la commande."
 : params.order_error === "address" ? "Renseigne une adresse complète pour la livraison à domicile."
 : params.order_error === "phone" ? "Renseigne un numéro de téléphone pour la livraison."
 : params.order_error === "hold-expired" ? "La réservation temporaire du stock a expiré. Les véhicules concernés ont été libérés : refais ta sélection si tu veux les commander."
 : params.order_error === "hold-reserved" ? "Un véhicule de ton panier vient d’être temporairement réservé par un autre citoyen."
 : params.order_error ? "La commande n’a pas pu être envoyée. Réessaie dans un instant." : null;

 const errorMessage =

 params.error === "invalid_name" ? "Entre un prénom et un nom RP valides, entre 2 et 32 caractères."

 : params.error === "invalid_phone" ? "Le numéro de téléphone contient des caractères invalides."

 : params.error === "invalid_address" ? "L’adresse renseignée est trop courte."

 : params.error === "profile_setup" ? "Exécute le SQL V42.5 pour activer le téléphone et l’adresse dans le profil."

 : params.error === "save_failed" ? "Le profil n’a pas pu être sauvegardé. Réessaie dans un instant." : null;

 return (
  <>
   {params.selection_added && <ClearCatalogueSelectionV1601 />}

 <section className="profile-heading">

 <span className="eyebrow">ESPACE PERSONNEL</span>

 <h1 className="page-title">Mon profil</h1>

 <p className="lead">Ton identité, ton panier et tous tes dossiers sont maintenant rangés dans des pages séparées.</p>

 </section>

 {params.setup === "required" && (
   <div className="dashboard-feedback dashboard-feedback-error" style={{marginBottom:22}}>
     <strong>Profil incomplet.</strong> Merci de remplir vos informations personnelles dans votre profil : prénom et nom. Tant que ces informations ne sont pas enregistrées, les autres services du site restent bloqués.
   </div>
 )}

 <div className="profile-layout">

 <aside className="profile-card profile-summary">

 {avatarUrl ? (

 // eslint-disable-next-line @next/next/no-img-element

 <img className="profile-avatar" src={avatarUrl} alt="Avatar Discord" />
 ) : <div className="profile-avatar profile-avatar-fallback">NG</div>}

 <div><span className="profile-label">Nom RP</span><strong className="profile-name">{rpName || "À compléter"}</strong></div>

 <dl className="profile-details">

 <div><dt>Compte Discord</dt><dd>{getDiscordName(data.user)}</dd></div>

 <div><dt>Rôles</dt><dd className="profile-role-list-v114">{memberRoles.map((roleKey) => <span className="role-badge" key={roleKey}>{MEMBER_ROLE_LABELS[roleKey as MemberRoleKey] ?? roleKey}</span>)}</dd></div>

 <div><dt>Identifiant Discord</dt><dd>{getDiscordId(data.user) ?? "Non détecté"}</dd></div>
 <div><dt>Identifiant Steam</dt><dd>{steamId ?? "Non lié"}</dd></div>
 <div><dt>E-mail</dt><dd>{data.user.email ?? "Non communiqué"}</dd></div>

 </dl>

 </aside>

 <div className={styles.rightColumn}>

 <IdentityCard
 complete={complete}
 firstName={typeof metadata.rp_first_name === "string" ? metadata.rp_first_name : ""}
 lastName={typeof metadata.rp_last_name === "string" ? metadata.rp_last_name : ""}
 phone={typeof metadata.phone === "string" ? metadata.phone : ""}
 address={typeof metadata.address === "string" ? metadata.address : ""}
 discordName={getDiscordName(data.user)}
 discordId={getDiscordId(data.user) ?? "Non détecté"}
 email={data.user.email ?? "Non communiqué"}
 role={role}
 errorMessage={errorMessage}
 saved={params.profile_saved === "1"}
 />

 <MailboxLauncher

 address={mailboxOverview.mailbox?.address ?? null}

 configured={mailboxOverview.configured}
 initialUnreadCount={mailboxOverview.unread}

 />

 <NotificationLauncher initialUnreadCount={unreadNotifications} />

 </div>

 </div>

 <ProfileNavigation orders={commerce.orders.length} reservations={vehicleReservations.length} financing={vehicleFinancing.length} tradeIns={vehicleTradeIns.length} searchMandates={searchMandates.length} consignments={vehicleConsignments.length} homologations={homologations.length} teams={teamRegistrations.length} documents={commerce.invoices.length} games={wheelSpins.length + tombolaTickets.length + bingoCards.length} />
 {!commerce.configured && <div className="dashboard-feedback">Les rubriques commerciales seront disponibles dès que le script SQL du Dashboard aura été exécuté.</div>}

 {params.vehicle_added && <div className="dashboard-feedback dashboard-feedback-success">{Number(params.vehicle_added) > 1 ? `${Number(params.vehicle_added)} véhicules et le mode de récupération choisi ont été ajoutés à ton panier.` : "Le véhicule et son mode de récupération ont été ajoutés à ton panier au prix total."}</div>}

 {params.reservation_added && <div className="dashboard-feedback dashboard-feedback-success">L’acompte de réservation de 15 % a été ajouté à ton panier.</div>}

 {params.reservation_paid && <div className="dashboard-feedback dashboard-feedback-success">Acompte payé. La réservation est maintenant en attente de validation par Nostra Motors.</div>}

 {params.balance_paid && <div className="dashboard-feedback dashboard-feedback-success">Solde payé. La réservation est devenue une commande Nostra Motors.</div>}

 {params.reservation_error && <div className="dashboard-feedback dashboard-feedback-error">La réservation n’a pas pu être enregistrée. Vérifie le stock ou une éventuelle réservation déjà active.</div>}

 {params.balance_error && <div className="dashboard-feedback dashboard-feedback-error">Le solde n’a pas pu être payé. Recharge la page ou contacte Nostra Motors.</div>}

 {params.order_sent && <div className="dashboard-feedback dashboard-feedback-success">Commande <strong>{params.order_sent}</strong> envoyée à Nostra Motors. Le stock a été réservé automatiquement.</div>}

 {params.cart_removed && <div className="dashboard-feedback dashboard-feedback-success">L’article a été retiré de ton panier.</div>}
 {params.cart_error && <div className="dashboard-feedback dashboard-feedback-error">{params.cart_error === "locked" ? "Le solde d’une réservation validée ne peut pas être retiré du panier." : "Impossible de retirer cet article du panier."}</div>}

 {params.tombola_added && <div className="dashboard-feedback dashboard-feedback-success">Les tickets de tombola ont été ajoutés à ton panier.</div>}

 {params.tombola_removed && <div className="dashboard-feedback dashboard-feedback-success">Les tickets de tombola ont été retirés de ton panier.</div>}
 {params.tombola_cart_error && <div className="dashboard-feedback dashboard-feedback-error">Impossible de modifier le panier de la tombola.</div>}

 {params.tombola_order_error && <div className="dashboard-feedback dashboard-feedback-error">La commande de tickets n’a pas pu être validée. Vérifie que la tombola est encore ouverte.</div>}

 {params.bingo_added && <div className="dashboard-feedback dashboard-feedback-success">Les grilles de Bingo ont été ajoutées à ton panier.</div>}
 {params.bingo_removed && <div className="dashboard-feedback dashboard-feedback-success">Les grilles de Bingo ont été retirées de ton panier.</div>}

 {params.bingo_cart_error && <div className="dashboard-feedback dashboard-feedback-error">Impossible de modifier le panier du Bingo.</div>}

 {params.bingo_order_error && <div className="dashboard-feedback dashboard-feedback-error">La commande de grilles n’a pas pu être validée. Vérifie que les ventes sont encore ouvertes.</div>}
 {params.license_added && <div className="dashboard-feedback dashboard-feedback-success">La demande de licence et le certificat médical ont été ajoutés à ton panier.</div>}

 {params.license_removed && <div className="dashboard-feedback dashboard-feedback-success">La demande de licence a été retirée de ton panier.</div>}

 {params.license_paid && <div className="dashboard-feedback dashboard-feedback-success">Paiement enregistré. La demande <strong>{params.license_paid}</strong> est disponible dans Profil → Documents & factures.</div>}

 {params.license_order_error && <div className="dashboard-feedback dashboard-feedback-error">{params.license_order_error === "academy" ? "Paiement bloqué : une qualification Nostra Racing Academy valide est obligatoire." : params.license_order_error === "academy-specific" ? "Paiement bloqué : tu dois réussir la formation Academy prévue pour cette licence." : params.license_order_error === "academy-expired" ? "Paiement bloqué : ta qualification Academy nécessaire a expiré." : params.license_order_error === "prerequisite" ? "Paiement bloqué : la licence de niveau inférieur exigée est absente, expirée ou suspendue." : params.license_order_error === "license-suspended" ? "Paiement bloqué : cette licence est actuellement suspendue." : params.license_order_error === "license-revoked" ? "Paiement bloqué : cette licence a été retirée par la Direction." : params.license_order_error === "closed" ? "Paiement bloqué : l’achat de cette licence est actuellement clôturé par la Direction." : params.license_order_error === "setup" ? "Paiement bloqué : le contrôle Academy V140 doit être activé par la Direction." : "La demande de licence n’a pas pu être payée. Vérifie que le dossier est toujours présent dans ton panier."}</div>}

 {params.contract_paid && <div className="dashboard-feedback dashboard-feedback-success">Paiement enregistré pour {params.contract_paid} reconduction(s) de contrat.</div>}
 {params.contract_error && <div className="dashboard-feedback dashboard-feedback-error">{params.contract_error === "empty" ? "Aucune reconduction de contrat n’est actuellement à payer." : params.contract_error === "setup" ? "Le module Contrats doit être activé avec le SQL V114." : "Le paiement du contrat n’a pas pu être enregistré."}</div>}

 {orderErrorMessage && <div className="dashboard-feedback dashboard-feedback-error">{orderErrorMessage}</div>}

 {vehicleHoldSummaryV161.configured && vehicleHoldSummaryV161.count > 0 && vehicleHoldSummaryV161.expiresAt && (
  <VehicleHoldCountdownV161 expiresAt={vehicleHoldSummaryV161.expiresAt} vehicleCount={vehicleHoldSummaryV161.count} />
 )}

 <section className="profile-commerce-grid profile-commerce-grid-v115">

 <article className="profile-commerce-card">

 <div className="profile-commerce-head"><span></span><div><p>MON PANIER</p><h2>{commerce.cart.length + (tombolaCart ? 1 : 0) + (bingoCart ? 1 : 0) + (licenseCart ? 1 : 0) + contractCart.items.length} article(s)</h2></div></div>

 <div className="profile-mini-list">
 {commerce.cart.length === 0 && !tombolaCart && !bingoCart && !licenseCart && contractCart.items.length === 0 && <p className="empty-state">Ton panier est vide.</p>}

 {commerce.cart.map((item) => {
 const isDeposit = item.item_type === "reservation_deposit";
 const isBalance = item.item_type === "reservation_balance";
 const isFinancingPayment = ["financing_deposit", "financing_installment"].includes(String(item.item_type));
 return (
 <div className={`profile-cart-row${isDeposit ? " profile-cart-row-reservation" : ""}${isBalance ? " profile-cart-row-balance" : ""}${isFinancingPayment ? " profile-cart-row-financing-v125" : ""}`} key={item.id}>
 <span>
 {item.quantity} × {item.item_name}
 {isDeposit && <small className="order-client-note">Acompte de 15 % · validation de la concession requise</small>}
 {isBalance && <small className="order-client-note">Solde de 85 % après validation · montant verrouillé</small>}
 {isFinancingPayment && <small className="order-client-note">Paiement de financement verrouillé · ouvre Mes financements pour le régler</small>}
 </span>
 <strong>{money(Number(item.unit_price) * Number(item.quantity))}</strong>
 {!isBalance && !item.locked ? (
 <form action={removeCartItem}><input type="hidden" name="id" value={item.id} /><button type="submit" aria-label={`Retirer ${item.item_name} du panier`}>Supprimer</button></form>
 ) : <span className="role-badge">À payer</span>}
 </div>
 );
 })}

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
 {licenseCart && (

 <div className="profile-cart-row profile-cart-row-license">

 <span>1 × {licenseCart.license_label}</span>

 <strong>{money(licenseCartTotal)}</strong>

 <form action={removePilotLicenseCart}><button type="submit">Supprimer</button></form>

 </div>

 )}

 {contractCart.items.map((item) => (
 <div className="profile-cart-row profile-cart-row-contract-v114" key={`contract-${item.id}`}>
 <span>
 1 × {item.item_name}
 <small className="order-client-note">Échéance contractuelle · paiement verrouillé</small>
 </span>
 <strong>{money(item.amount)}</strong>
 <span className="role-badge">À payer</span>
 </div>
 ))}


 </div>

 <footer><span>Total du panier</span><strong>{money(cartTotal + tombolaCartTotal + bingoCartTotal + licenseCartTotal + contractCartTotal)}</strong></footer>

 {normalVehicleCart.length > 0 && (

 <form action={placeCartOrder} className="profile-order-form profile-order-form-v160">
 {eligibleDeliveryVehicleCount > 0 ? (
 <fieldset className="profile-delivery-v160">
 <legend>Récupération de la commande</legend>
 <div className="profile-delivery-options-v160">
 <label className="profile-delivery-option-v160">
 <input type="radio" name="delivery_mode" value="showroom" defaultChecked={!hasHomeDeliveryInCart} />
 <span><strong>Retrait au showroom</strong><small>Gratuit · tous les véhicules sont récupérés chez Nostra Motors.</small></span>
 <b>0 €</b>
 </label>
 <label className="profile-delivery-option-v160">
 <input type="radio" name="delivery_mode" value="home" defaultChecked={hasHomeDeliveryInCart} />
 <span><strong>Livraison à domicile</strong><small>5 % de la valeur globale des véhicules livrés, calculés automatiquement.</small></span>
 <b>+ {money(estimatedHomeDeliveryFee)}</b>
 </label>
 </div>
 <div className="profile-delivery-home-v160">
 <div className="profile-delivery-summary-v160">
 <span><small>Véhicules livrés</small><strong>{eligibleDeliveryVehicleCount}</strong></span>
 <span><small>Valeur livrée</small><strong>{money(eligibleDeliveryVehicleValue)}</strong></span>
 <span><small>Frais à 5 %</small><strong>{money(estimatedHomeDeliveryFee)}</strong></span>
 </div>
 <p><strong>Transport prévu :</strong> {deliveryTransportLabel} · capacité totale {deliveryTransportPlan.totalCapacity} véhicule{deliveryTransportPlan.totalCapacity > 1 ? "s" : ""}.</p>
 {excludedDeliveryVehicleCount > 0 && <p className="profile-delivery-warning-v160">{excludedDeliveryVehicleCount} véhicule{excludedDeliveryVehicleCount > 1 ? "s" : ""} du catalogue Location/Poids lourd reste{excludedDeliveryVehicleCount > 1 ? "nt" : ""} en retrait showroom.</p>}
 <DeliveryAddressPickerV161
  addresses={deliveryAddressesV161}
  fallbackPhone={profileDeliveryPhone}
  fallbackAddress={profileDeliveryAddress}
 />
 </div>
 </fieldset>
 ) : <input type="hidden" name="delivery_mode" value="showroom" />}
 <label><span>Code promotionnel <small>(facultatif)</small></span><input name="promo_code" maxLength={40} placeholder="Exemple : NOSTRA10" /></label>
 <label><span>Message pour Nostra Motors <small>(facultatif)</small></span><textarea name="customer_note" rows={3} maxLength={1500} placeholder="Exemple : couleur souhaitée, disponibilité pour le retrait…" /></label>

 <button className="btn" type="submit" disabled={!commerce.ordersConfigured}>Commander les véhicules au prix total</button>

 {!commerce.ordersConfigured && <p>Active d’abord le module depuis <strong>Dashboard → Commandes Nostra Motors</strong>.</p>}

 </form>

 )}


 {reservationDepositCart.length > 0 && (
 <form action={checkoutVehicleReservationDeposits} className="profile-order-form">
 <p className="commerce-hint">Le paiement de l’acompte bloque le stock et envoie la réservation au Dashboard. Après validation, le solde de 85 % sera ajouté automatiquement ici.</p>
 <button className="btn" type="submit">Payer les acomptes de réservation</button>
 </form>
 )}

 {reservationBalanceCart.length > 0 && (
 <form action={checkoutVehicleReservationBalances} className="profile-order-form">
 <p className="commerce-hint">Nostra Motors a validé la réservation. Le montant ci-dessus correspond aux 85 % restants, avec la livraison à domicile si elle a été choisie.</p>
 <button className="btn" type="submit">Payer les soldes de réservation</button>
 </form>
 )}

 {financingPaymentCart.length > 0 && (
 <div className="profile-order-form profile-financing-checkout-v125">
 <p className="commerce-hint">Un apport ou une échéance de financement est prêt à être payé. Le montant et l’échéancier complet sont disponibles dans ton dossier.</p>
 <Link className="btn" href="/profil/financements">Ouvrir mes financements</Link>
 </div>
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
 {licenseCart && canCheckoutPilotLicense && (

 <form action={checkoutPilotLicenseCart} className="profile-order-form profile-license-checkout">

 <p className="commerce-hint">Formation Academy validée ✓ · Le paiement enregistre immédiatement ta demande de {licenseCart.license_label}. Le dossier sera ajouté à Profil → Documents & factures et la transaction apparaîtra dans la comptabilité.</p>

 <button className="btn" type="submit">Payer ma licence pilote</button>

 </form>

 )}

 {licenseCart && !canCheckoutPilotLicense && (
 <div className="profile-order-form profile-license-checkout">
  <p className="commerce-hint">
   {academyEligibility && !academyEligibility.eligible
    ? academyEligibility.reason === "academy_specific_training_required"
      ? `🔒 Achat bloqué : la formation ${academyEligibility.requiredCourseTitle ?? "Academy prévue"} doit être validée.`
      : academyEligibility.reason === "academy_training_expired"
        ? "🔒 Achat bloqué : ta qualification Academy nécessaire a expiré."
        : academyEligibility.reason === "prerequisite_license_required"
          ? `🔒 Achat bloqué : la licence préalable ${academyEligibility.prerequisiteLicenseLabel ?? "demandée"} est absente, expirée ou suspendue.`
          : academyEligibility.reason === "license_suspended"
            ? "🔒 Achat bloqué : cette licence est actuellement suspendue."
            : academyEligibility.reason === "license_revoked"
              ? "🔒 Achat bloqué : cette licence a été retirée par la Direction."
              : "🔒 Achat bloqué : une qualification Nostra Racing Academy valide est nécessaire."
    : "🔒 Achat bloqué : la Direction a clôturé l’achat de cette licence."}
  </p>
  {academyEligibility && !academyEligibility.eligible && <Link className="btn btn-secondary" href="/circuit/racing-academy">Voir les formations Academy</Link>}
 </div>
 )}

 {contractCart.items.length > 0 && (
 <form action={checkoutContractRenewals} className="profile-order-form profile-contract-checkout-v114">
 <p className="commerce-hint">Ces lignes correspondent à la reconduction mensuelle de ton contrat Nostra Circuit. Le libellé et le tarif applicable au mois sont enregistrés dans l’historique.</p>
 <button className="btn" type="submit">Payer les reconductions de contrat</button>
 </form>
 )}


 </article>



 <article className="profile-commerce-card loyalty-card profile-loyalty-status-card-v115">

 <div className="profile-commerce-head"><span>◆</span><div><p>STATUT DE FIDÉLITÉ</p><h2>{activeLoyaltyCard?.tier ?? commerce.loyalty?.tier ?? "Aucun statut"}</h2></div></div>

 <div className="profile-loyalty-status-layout-v115">
 <div className="profile-loyalty-visual-v115">
 {activeLoyaltyCard ? (
 <LoyaltyCard card={activeLoyaltyCard} />
 ) : (
 <p className="empty-state">{commerce.loyalty?.tier ? "Ton grade est actif. La Direction doit encore générer ta carte personnalisée." : "Aucune carte de fidélité active."}</p>
 )}
 </div>

 <div className="profile-loyalty-summary-v115">
 <dl>
 <div><dt>Achats comptabilisés</dt><dd>{commerce.loyalty?.purchases_count ?? 0}</dd></div>
 <div><dt>Remise actuelle</dt><dd>{loyaltyDiscountPercent} %</dd></div>
 <div><dt>Numéro de carte</dt><dd>{activeLoyaltyCard?.card_number ?? "Non généré"}</dd></div>
 <div><dt>Titulaire</dt><dd>{activeLoyaltyCard ? `${activeLoyaltyCard.first_name} ${activeLoyaltyCard.last_name}` : rpName || "À compléter"}</dd></div>
 </dl>
 <p className="commerce-hint">Une nouvelle carte désactive uniquement l’ancienne carte du même citoyen lorsqu’il change de grade ou qu’elle est régénérée.</p>
 <Link className="btn btn-secondary" href="/profil/fidelite">Ouvrir ma carte de fidélité</Link>
 </div>
 </div>

 </article>

 </section>

  </>
 );
}
