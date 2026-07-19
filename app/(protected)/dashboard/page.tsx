import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import {
  getAccountingEntries,
  getBackofficeConfigured,
  getCircuitSetting,
  getCatalogVehicles,
  getEvents,
  getHomologationRequests,
  getInventoryItems,
  getMotorsSetting,
  getMotorsStatusConfigured,
  getOrderModuleConfigured,
  getOrders,
  getReservationRequests,
} from "@/lib/backoffice/data";
import { BACKOFFICE_SETUP_SQL } from "@/lib/backoffice/setup-sql";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const configured = await getBackofficeConfigured();
  const ordersConfigured = await getOrderModuleConfigured();

  const [setting, motorsSetting, motorsStatusConfigured, stock, accounting, events, requests, reservationRequests, catalogVehicles] = configured
    ? await Promise.all([
        getCircuitSetting(),
        getMotorsSetting(),
        getMotorsStatusConfigured(),
        getInventoryItems(),
        getAccountingEntries(),
        getEvents(true),
        getHomologationRequests(),
        getReservationRequests(),
        getCatalogVehicles(true),
      ])
    : [null, null, false, [], [], [], [], [], []];

  const orders = ordersConfigured ? await getOrders() : [];
  const pendingOrders = orders.filter((order) => order.status === "pending").length;

  const pending = requests.filter((request) => request.status === "pending" || request.status === "reviewing").length;
  const pendingReservations = reservationRequests.filter((request) => request.status === "pending").length;
  const lowStock = stock.filter((item) => item.quantity <= item.minimum_quantity).length;
  const currentBalance = accounting.reduce((total, entry) => total + (entry.entry_type === "income" ? Number(entry.amount) : -Number(entry.amount)), 0);

  return (
    <DashboardShell>
      <section className="dashboard-hero dashboard-hero-compact">
        <div>
          <span className="eyebrow">DIRECTION NOSTRA GROUP</span>
          <h1 className="page-title">Dashboard Gérant</h1>
          <p className="lead">
            Bienvenue {getRpName(data.user) || getDiscordName(data.user)}. Choisis un module pour gérer le site sans mélanger toutes les fonctions sur une seule page.
          </p>
        </div>
        <span className="manager-seal">GÉRANT</span>
      </section>

      {!configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer les nouveaux modules</h2>
          <p>Le dashboard a besoin de nouvelles tables Supabase pour les stocks, la comptabilité, les événements, l’état du circuit, les homologations et l’espace client.</p>
          <details>
            <summary>Afficher le nouveau code SQL à copier dans Supabase</summary>
            <pre>{BACKOFFICE_SETUP_SQL}</pre>
          </details>
          <ol>
            <li>Ouvre <strong>Supabase → SQL Editor → New query</strong>.</li>
            <li>Colle tout le code et clique sur <strong>Run query</strong>.</li>
            <li>Reviens ici et fais <strong>Ctrl + F5</strong>.</li>
          </ol>
        </section>
      )}

      <section className="dashboard-kpi-grid">
        <article><span>État du circuit</span><strong>{setting?.label ?? "À configurer"}</strong></article>
        <article><span>État Nostra Motors</span><strong>{motorsStatusConfigured ? motorsSetting?.label ?? "À configurer" : "Activation requise"}</strong></article>
        <article><span>Demandes en attente</span><strong>{pending}</strong></article>
        <article><span>Alertes de stock</span><strong>{lowStock}</strong></article>
        <article><span>Solde enregistré</span><strong>{currentBalance.toLocaleString("fr-FR")} €</strong></article>
      </section>

      <section className="dashboard-section-heading dashboard-section-heading-tight">
        <p className="eyebrow">CENTRE DE GESTION</p>
        <h2>Modules du dashboard</h2>
        <p>Chaque icône ouvre une page dédiée. Tu reviens ensuite ici avec le bouton « Retour au dashboard ».</p>
      </section>

      <section className="dashboard-module-grid">
        <DashboardCard href="/dashboard/contenu" icon="✎" title="Modification des pages" description="Choisir entre Nostra Motors, Nostra Circuit et Jeux & Événements, puis modifier leurs pages séparément." />
        <DashboardCard href="/dashboard/catalogue" icon="🚗" title="Catalogue Nostra Motors" description="Ajouter les véhicules par marque avec leurs photos, coffre, vitesse, puissance et prix." badge={catalogVehicles.length ? `${catalogVehicles.length} véhicule(s)` : undefined} />
        <DashboardCard href="/dashboard/commandes" icon="🧾" title="Commandes Nostra Motors" description="Recevoir les paniers validés par les citoyens, suivre la préparation et mettre à jour leur statut." badge={!ordersConfigured ? "À activer" : pendingOrders ? `${pendingOrders} nouvelle(s)` : undefined} />
        <DashboardCard href="/dashboard/circuit" icon="◉" title="État des activités" description="Gérer au même endroit l’état du Nostra Circuit et de Nostra Motors." badge={motorsStatusConfigured ? `${setting?.label ?? "Circuit"} / ${motorsSetting?.label ?? "Motors"}` : "Motors à activer"} />
        <DashboardCard href="/dashboard/homologations" icon="✅" title="Homologations" description="Recevoir et traiter les demandes de véhicules et d’écuries." badge={pending ? `${pending} en attente` : undefined} />
        <DashboardCard href="/dashboard/reservations" icon="🗓" title="Demandes de réservation" description="Valider ou refuser les dates et horaires choisis dans le calendrier du circuit." badge={pendingReservations ? `${pendingReservations} à traiter` : undefined} />
        <DashboardCard href="/dashboard/stocks" icon="▦" title="Gestion des stocks" description="Ajouter les articles, modifier les quantités et surveiller les seuils d’alerte." badge={lowStock ? `${lowStock} alerte(s)` : undefined} />
        <DashboardCard href="/dashboard/comptabilite" icon="€" title="Comptabilité" description="Enregistrer les recettes, les dépenses et suivre le solde." />
        <DashboardCard href="/dashboard/evenements" icon="📅" title="Gestion des événements" description="Créer, publier, modifier ou annuler les événements Nostra Group." badge={events.filter((event) => !event.championship || event.championship === "general").length ? `${events.filter((event) => !event.championship || event.championship === "general").length} événement(s)` : undefined} />
        <DashboardCard href="/dashboard/championnats" icon="🏆" title="Calendriers F1 & GT3 RS" description="Programmer les manches et événements dans les calendriers de chaque championnat." />
        <DashboardCard href="/dashboard/membres" icon="👥" title="Membres et rôles" description="Voir les comptes inscrits et attribuer les rôles Membre, Staff, Administrateur ou Gérant." />
      </section>
    </DashboardShell>
  );
}
