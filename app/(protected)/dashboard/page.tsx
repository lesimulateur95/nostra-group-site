import { redirect } from "next/navigation";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardModuleGroup } from "@/components/dashboard/dashboard-module-group";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import {
  getAccountingEntries,
  getBackofficeConfigured,
  getCatalogVehicles,
  getCircuitSetting,
  getDashboardRoleAccessConfigured,
  getEvents,
  getHomologationRequests,
  getInventoryItems,
  getMotorsSetting,
  getMotorsStatusConfigured,
  getOrderModuleConfigured,
  getOrders,
  getReservationRequests,
  getTeamRegistrationModuleConfigured,
  getTeamRegistrationRequests,
  getTombolaModuleConfigured,
  getActiveTombolaRound,
  getTombolaTickets,
  getBingoModuleConfigured,
  getActiveBingoRound,
  getBingoCards,
  getWheelModuleConfigured,
  getWheelSpins,
} from "@/lib/backoffice/data";
import { DASHBOARD_ACCESS_SETUP_SQL } from "@/lib/backoffice/dashboard-access-setup-sql";
import { BACKOFFICE_SETUP_SQL } from "@/lib/backoffice/setup-sql";
import { createClient } from "@/lib/supabase/server";
import { getUnreadTeamMailCount } from "@/lib/mail/data";
import { getDealDashboardState, getDealModuleConfigured } from "@/lib/deal/data";
import { getMotorsV41Overview } from "@/lib/nostra-motors/v41-data";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const roles = await getUserRoleKeys(data.user);
  const managerAccess = roles.includes("manager");
  const commissionerRole = roles.includes("commissioner");
  const ordersAccess =
    managerAccess ||
    roles.includes("employee") ||
    roles.includes("commercial");

  if (!managerAccess && !ordersAccess) {
    redirect(commissionerRole ? "/commissaires" : "/accueil");
  }

  const [configured, ordersConfigured, teamRegistrationsConfigured, roleAccessConfigured, wheelConfigured, tombolaConfigured, bingoConfigured, teamMailOverview, dealConfigured] = await Promise.all([
    managerAccess ? getBackofficeConfigured() : Promise.resolve(false),
    ordersAccess ? getOrderModuleConfigured() : Promise.resolve(false),
    managerAccess ? getTeamRegistrationModuleConfigured() : Promise.resolve(false),
    getDashboardRoleAccessConfigured(),
    managerAccess ? getWheelModuleConfigured() : Promise.resolve(false),
    managerAccess ? getTombolaModuleConfigured() : Promise.resolve(false),
    managerAccess ? getBingoModuleConfigured() : Promise.resolve(false),
    ordersAccess ? getUnreadTeamMailCount() : Promise.resolve({ configured: false, unread: 0 }),
    managerAccess ? getDealModuleConfigured() : Promise.resolve(false),
  ]);

  const [setting, motorsSetting, motorsStatusConfigured, stock, accounting, events, requests, reservationRequests, catalogVehicles] = managerAccess && configured
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

  const [
    orders,
    teamRegistrations,
    wheelSpins,
    tombolaRound,
    bingoRound,
    dealState,
  ] = await Promise.all([
    ordersConfigured ? getOrders() : Promise.resolve([]),
    managerAccess && teamRegistrationsConfigured
      ? getTeamRegistrationRequests()
      : Promise.resolve([]),
    managerAccess && wheelConfigured
      ? getWheelSpins()
      : Promise.resolve([]),
    managerAccess && tombolaConfigured
      ? getActiveTombolaRound()
      : Promise.resolve(null),
    managerAccess && bingoConfigured
      ? getActiveBingoRound()
      : Promise.resolve(null),
    managerAccess && dealConfigured
      ? getDealDashboardState()
      : Promise.resolve({ edition: null, sessions: [] }),
  ]);

  const motorsV41Overview = ordersAccess
    ? await getMotorsV41Overview()
    : { configured: false, pendingAppointments: 0, pendingDeliveries: 0 };

  const [tombolaTickets, bingoCards] = await Promise.all([
    managerAccess && tombolaRound
      ? getTombolaTickets(tombolaRound.id)
      : Promise.resolve([]),
    managerAccess && bingoRound
      ? getBingoCards(bingoRound.id)
      : Promise.resolve([]),
  ]);

  const activeDealSessions = dealState.sessions.filter((session) =>
    ["choosing", "playing", "banker_call"].includes(
      session.status,
    ),
  ).length;
  const unusedWheelGains = wheelSpins.filter((spin) => spin.redemption_status === "unused").length;
  const pendingOrders = orders.filter((order) => order.status === "pending").length;
  const pendingTeamRegistrations = teamRegistrations.filter((request) => request.status === "pending" || request.status === "reviewing").length;
  const pending = requests.filter((request) => request.status === "pending" || request.status === "reviewing").length;
  const pendingReservations = reservationRequests.filter((request) => request.status === "pending").length;
  const lowStock = stock.filter((item) => item.quantity <= item.minimum_quantity).length;
  const currentBalance = accounting.reduce((total, entry) => total + (entry.entry_type === "income" ? Number(entry.amount) : -Number(entry.amount)), 0);
  const generalEventsCount = events.filter((event) => !event.championship || event.championship === "general").length;
  const accessLabel = managerAccess
    ? "GÉRANT"
    : roles.includes("commercial")
      ? "COMMERCIAL"
      : "EMPLOYÉ";
  const totalPending =
    pending +
    pendingReservations +
    pendingTeamRegistrations +
    pendingOrders;

  return (
    <DashboardShell>
      <section className="dashboard-hero dashboard-hero-compact">
        <div>
          <span className="eyebrow">NOSTRA GROUP</span>
          <h1 className="page-title">Dashboard</h1>
          <p className="lead">Bienvenue {getRpName(data.user) || getDiscordName(data.user)}. Seuls les outils autorisés par tes rôles apparaissent ici.</p>
        </div>
        <span className="manager-seal">{accessLabel}</span>
      </section>

      {managerAccess && !configured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer les modules généraux</h2>
          <p>Le dashboard a besoin de tables Supabase pour les stocks, la comptabilité, les événements, l’état du circuit, les homologations et l’espace client.</p>
          <details><summary>Afficher le code SQL général</summary><pre>{BACKOFFICE_SETUP_SQL}</pre></details>
        </section>
      )}

      {managerAccess && !roleAccessConfigured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation V30 nécessaire</span>
          <h2>Activer le planning public, le temps réel et la suppression des gains</h2>
          <p>Ce script finalise les accès par rôle, publie le planning en direct pour les citoyens, active sa mise à jour instantanée et permet de retirer les gains de la roue sans réinitialiser le tirage quotidien.</p>
          <details><summary>Afficher le code SQL V30</summary><pre>{DASHBOARD_ACCESS_SETUP_SQL}</pre></details>
          <ol><li>Copie le code dans une nouvelle requête Supabase.</li><li>Exécute-le avec <strong>Run without RLS</strong>.</li><li>Recharge cette page avec <strong>Ctrl + F5</strong>.</li></ol>
        </section>
      )}

      {managerAccess && (
        <section className="dashboard-kpi-grid">
          <article><span>État du circuit</span><strong>{setting?.label ?? "À configurer"}</strong></article>
          <article><span>État Nostra Motors</span><strong>{motorsStatusConfigured ? motorsSetting?.label ?? "À configurer" : "Activation requise"}</strong></article>
          <article><span>Demandes en attente</span><strong>{totalPending}</strong></article>
          <article><span>Alertes de stock</span><strong>{lowStock}</strong></article>
          <article><span>Solde enregistré</span><strong>{currentBalance.toLocaleString("fr-FR")} €</strong></article>
        </section>
      )}

      <section className="dashboard-section-heading dashboard-section-heading-tight">
        <p className="eyebrow">CENTRE DE GESTION</p>
        <h2>Modules disponibles</h2>
        <p>Seuls les modules qui ont besoin du direct sont synchronisés automatiquement. Les autres pages ne sont plus rechargées en permanence.</p>
      </section>

      <div className="dashboard-module-groups">
        {ordersAccess && (
          <DashboardModuleGroup
            icon="🚗"
            eyebrow="CONCESSION"
            title="Nostra Motors"
            description={managerAccess ? "Catalogue, commandes clients et quantités disponibles." : "Accès limité au traitement des commandes clients."}
            defaultOpen={!managerAccess}
          >
            <div className="dashboard-module-grid dashboard-module-grid-grouped">
              {managerAccess && <DashboardCard href="/dashboard/catalogue" icon="🚘" title="Catalogue Nostra Motors" description="Ajouter les véhicules par marque avec leurs photos, caractéristiques, prix et quantité en stock." badge={catalogVehicles.length ? `${catalogVehicles.length} véhicule(s)` : undefined} />}
              <DashboardCard href="/dashboard/commandes" icon="🧾" title="Commandes Nostra Motors" description="Recevoir les commandes des citoyens, suivre leur préparation et modifier leur statut." badge={!ordersConfigured ? "À activer" : pendingOrders ? `${pendingOrders} nouvelle(s)` : undefined} />
              <DashboardCard href="/dashboard/livraisons" icon="🚚" title="Gestion des livraisons" description="Planifier les livraisons à domicile, assigner un livreur et suivre leur progression." badge={!motorsV41Overview.configured ? "V41 à activer" : motorsV41Overview.pendingDeliveries ? `${motorsV41Overview.pendingDeliveries} à traiter` : undefined} />
              {managerAccess && (
                <DashboardCard
                  href="/dashboard/rendez-vous-motors"
                  icon="◷"
                  title="Demandes de rendez-vous"
                  description="Consulter, traiter ou supprimer les demandes envoyées par les citoyens."
                  badge={!motorsV41Overview.configured
                    ? "À activer"
                    : motorsV41Overview.pendingAppointments
                      ? `${motorsV41Overview.pendingAppointments} en attente`
                      : undefined}
                />
              )}
              {managerAccess && <DashboardCard href="/dashboard/stocks" icon="▦" title="Gestion des stocks" description="Modifier les quantités et surveiller les véhicules bientôt épuisés." badge={lowStock ? `${lowStock} alerte(s)` : undefined} />}
            </div>
          </DashboardModuleGroup>
        )}

        {managerAccess && (
          <DashboardModuleGroup icon="🏁" eyebrow="SPORT AUTOMOBILE" title="Nostra Circuit" description="Réservations, homologations, écuries et championnats.">
            <div className="dashboard-module-grid dashboard-module-grid-grouped dashboard-module-grid-four">
              <DashboardCard href="/dashboard/reservations" icon="🗓" title="Demandes de réservation" description="Valider, refuser ou supprimer les créneaux demandés sur le calendrier du circuit." badge={pendingReservations ? `${pendingReservations} à traiter` : undefined} />
              <DashboardCard href="/dashboard/homologations" icon="✅" title="Homologations" description="Recevoir et traiter les demandes d’homologation de véhicules et d’écuries." badge={pending ? `${pending} en attente` : undefined} />
              <DashboardCard href="/dashboard/inscriptions-ecuries" icon="🏎️" title="Inscriptions des écuries" description="Traiter les inscriptions F1, GT3 RS et les demandes pour les deux championnats." badge={!teamRegistrationsConfigured ? "À activer" : pendingTeamRegistrations ? `${pendingTeamRegistrations} à traiter` : undefined} />
              <DashboardCard href="/dashboard/championnats" icon="🏆" title="Calendriers F1 & GT3 RS" description="Programmer les manches et événements dans le calendrier de chaque championnat." />
            </div>
          </DashboardModuleGroup>
        )}


        {managerAccess && (
          <DashboardModuleGroup icon="🎮" eyebrow="ANIMATIONS" title="Jeux" description="Suivre les tirages et gérer les bonus gagnés par les citoyens.">
            <div className="dashboard-module-grid dashboard-module-grid-grouped dashboard-module-grid-two">
              <DashboardCard href="/dashboard/jeux/roue" icon="🎡" title="Roue de la chance" description="Consulter l’historique, modifier le statut ou retirer un gain du profil du citoyen." badge={!wheelConfigured ? "V29 à activer" : unusedWheelGains ? `${unusedWheelGains} gain(s) à utiliser` : undefined} />
              <DashboardCard href="/dashboard/jeux/tombola" icon="🎟️" title="Tombola" description="Configurer le prix, consulter les tickets, lancer le tirage et réinitialiser la tombola." badge={!tombolaConfigured ? "V31 à activer" : tombolaTickets.length ? `${tombolaTickets.length} ticket(s)` : undefined} />
              <DashboardCard href="/dashboard/jeux/bingo" icon="🎱" title="Bingo" description="Configurer les grilles, tirer les numéros et suivre les gagnants et les récompenses." badge={!bingoConfigured ? "V32 à activer" : bingoCards.length ? `${bingoCards.length} grille(s)` : undefined} />
              <DashboardCard href="/dashboard/jeux/a-prendre-ou-a-laisser" icon="🎁" title="À Prendre ou à Laisser" description="Créer les 24 gains, suivre les joueurs en direct et déclencher manuellement les appels du banquier." badge={!dealConfigured ? "V36 à activer" : activeDealSessions ? `${activeDealSessions} partie(s) en direct` : dealState.edition ? "Édition ouverte" : undefined} />
            </div>
          </DashboardModuleGroup>
        )}

        {ordersAccess && (
          <DashboardModuleGroup
            icon="⚙️"
            eyebrow="DIRECTION"
            title="Direction"
            description={managerAccess
              ? "Messagerie officielle, état des activités, finances et événements du groupe."
              : "Accès à la messagerie officielle de l’équipe Nostra Group."}
            defaultOpen
          >
            <div className="dashboard-module-grid dashboard-module-grid-grouped">
              <DashboardCard
                href="/dashboard/messagerie"
                icon="📨"
                title="Messagerie Nostra Group"
                description="Lire les messages des citoyens, répondre aux conversations et écrire depuis equipe@nostra.group."
                badge={!teamMailOverview.configured
                  ? "V35 à activer"
                  : teamMailOverview.unread
                    ? `${teamMailOverview.unread} non lu(s)`
                    : undefined}
              />
              {managerAccess && (
                <DashboardCard
                  href="/dashboard/circuit"
                  icon="◉"
                  title="État des activités"
                  description="Gérer au même endroit l’état du Nostra Circuit et de Nostra Motors."
                  badge={motorsStatusConfigured
                    ? `${setting?.label ?? "Circuit"} / ${motorsSetting?.label ?? "Motors"}`
                    : "Motors à activer"}
                />
              )}
              {managerAccess && (
                <DashboardCard
                  href="/dashboard/comptabilite"
                  icon="€"
                  title="Comptabilité"
                  description="Enregistrer les recettes, les dépenses et suivre le solde du groupe."
                />
              )}
              {managerAccess && (
                <DashboardCard
                  href="/dashboard/evenements"
                  icon="📅"
                  title="Gestion des événements"
                  description="Créer, publier, modifier ou annuler les événements Nostra Group."
                  badge={generalEventsCount
                    ? `${generalEventsCount} événement(s)`
                    : undefined}
                />
              )}
            </div>
          </DashboardModuleGroup>
        )}

        {managerAccess && (
          <DashboardModuleGroup icon="🛠️" eyebrow="ADMINISTRATION" title="Site et membres" description="Modifier les pages du site et gérer les permissions des comptes.">
            <div className="dashboard-module-grid dashboard-module-grid-grouped dashboard-module-grid-two">
              <DashboardCard href="/dashboard/contenu" icon="✎" title="Modification des pages" description="Choisir entre Nostra Motors, Nostra Circuit et Jeux & Événements, puis modifier leurs pages séparément." />
              <DashboardCard href="/dashboard/membres" icon="👥" title="Membres et rôles" description="Attribuer les rôles Citoyen, Employé, Commercial, Commissaire ou Gérant, avec plusieurs rôles possibles." />
            </div>
          </DashboardModuleGroup>
        )}
      </div>
    </DashboardShell>
  );
}
