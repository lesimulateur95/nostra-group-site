import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardModuleGroup } from "@/components/dashboard/dashboard-module-group";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getRequestRoleKeys,
  getRequestUser,
} from "@/lib/auth/request-context";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { getDashboardOverview } from "@/lib/dashboard/overview";
import { getRecruitmentSummary } from "@/lib/recruitment/data";
import { getUsedVehicleDashboardSummary } from "@/lib/used-vehicles/data";
import { getVehicleReservationSummary } from "@/lib/vehicle-reservations/data";
import { getVehicleTradeInSummary } from "@/lib/vehicle-trade-ins/data";

type DashboardModuleSubgroupProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

function DashboardModuleSubgroup({
  eyebrow,
  title,
  description,
  children,
}: DashboardModuleSubgroupProps) {
  return (
    <details className="dashboard-module-subgroup dashboard-module-subgroup-collapsible">
      <summary className="dashboard-module-subgroup-summary">
        <span className="dashboard-module-subgroup-copy">
          <span>{eyebrow}</span>
          <strong>{title}</strong>
          <span>{description}</span>
        </span>
        <span className="dashboard-module-subgroup-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="dashboard-module-subgroup-content">
        <div className="dashboard-module-grid dashboard-module-grid-grouped dashboard-module-subgroup-grid">
          {children}
        </div>
      </div>
    </details>
  );
}

export default async function DashboardPage() {
  const [user, roles] = await Promise.all([
    getRequestUser(),
    getRequestRoleKeys(),
  ]);

  if (!user) redirect("/");

  const managerAccess = roles.includes("manager");
  const commissionerRole = roles.includes("commissioner");
  const operationsAccess =
    managerAccess ||
    roles.includes("employee") ||
    roles.includes("commercial");

  if (!operationsAccess) {
    redirect(commissionerRole ? "/commissaires" : "/accueil");
  }

  const [
    overview,
    usedOverview,
    vehicleReservationOverview,
    recruitmentOverview,
    tradeInOverview,
  ] = await Promise.all([
    getDashboardOverview({
      managerAccess,
      ordersAccess: operationsAccess,
    }),
    getUsedVehicleDashboardSummary(),
    getVehicleReservationSummary(),
    getRecruitmentSummary(),
    getVehicleTradeInSummary(),
  ]);

  const accessLabel = managerAccess
    ? "GÉRANT"
    : roles.includes("commercial")
      ? "COMMERCIAL"
      : "EMPLOYÉ";

  const totalPending =
    overview.pendingHomologations +
    overview.pendingReservations +
    overview.pendingTeamRegistrations +
    overview.pendingOrders +
    vehicleReservationOverview.pending +
    recruitmentOverview.pending +
    tradeInOverview.pending;

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <section className="dashboard-hero dashboard-hero-compact">
        <div>
          <span className="eyebrow">NOSTRA GROUP</span>
          <h1 className="page-title">Dashboard</h1>
          <p className="lead">
            Bienvenue {getRpName(user) || getDiscordName(user)}. Seuls les
            outils autorisés par tes rôles apparaissent ici.
          </p>
        </div>
        <span className="manager-seal">{accessLabel}</span>
      </section>

      {managerAccess && !overview.configured && (
        <section className="dashboard-setup">
          <span className="module-status">Vérification nécessaire</span>
          <h2>Certains modules ne répondent pas</h2>
          <p>
            Le Dashboard reste accessible. Vérifie le centre de diagnostic
            pour identifier le module Supabase concerné.
          </p>
        </section>
      )}

      {managerAccess && (
        <section className="dashboard-kpi-grid">
          <article>
            <span>État du circuit</span>
            <strong>{overview.circuitLabel}</strong>
          </article>
          <article>
            <span>État Nostra Motors</span>
            <strong>
              {overview.motorsStatusConfigured
                ? overview.motorsLabel
                : "Activation requise"}
            </strong>
          </article>
          <article>
            <span>Demandes en attente</span>
            <strong>{totalPending}</strong>
          </article>
          <article>
            <span>Alertes de stock</span>
            <strong>{overview.lowStock}</strong>
          </article>
          <article>
            <span>Solde enregistré</span>
            <strong>
              {overview.currentBalance.toLocaleString("fr-FR")} €
            </strong>
          </article>
        </section>
      )}

      <section className="dashboard-section-heading dashboard-section-heading-tight">
        <p className="eyebrow">CENTRE DE GESTION</p>
        <h2>Modules disponibles</h2>
        <p>
          Chaque grande activité reste séparée. À l’intérieur, les outils sont
          maintenant regroupés par fonction pour retrouver plus rapidement le
          bon bouton.
        </p>
      </section>

      <div className="dashboard-module-groups">
        <DashboardModuleGroup
          icon="🚘"
          eyebrow="CONCESSION"
          title="Nostra Motors"
          description="Catalogue, disponibilité des véhicules, ventes et service client."
          defaultOpen={!managerAccess}
        >
          <div className="dashboard-module-subgroups">
            <DashboardModuleSubgroup
              eyebrow="VÉHICULES"
              title="Catalogue et disponibilité"
              description="Gérer les fiches, le stock et les possibilités de réservation ou de vente."
            >
              <DashboardCard
                href="/dashboard/catalogue"
                icon="🚗"
                title="Catalogue Nostra Motors"
                description="Ajouter ou modifier les véhicules, leurs photos, caractéristiques, prix et quantités."
                badge={
                  managerAccess && overview.catalogVehicles
                    ? `${overview.catalogVehicles} véhicule(s)`
                    : undefined
                }
              />
              <DashboardCard
                href="/dashboard/stocks"
                icon="▦"
                title="Gestion des stocks"
                description="Modifier les quantités et surveiller les véhicules bientôt épuisés."
                badge={
                  managerAccess && overview.lowStock
                    ? `${overview.lowStock} alerte(s)`
                    : undefined
                }
              />
              {managerAccess && (
                <>
                  <DashboardCard
                    href="/dashboard/parametres-reservations"
                    icon="⚙️"
                    title="Activation des réservations"
                    description="Ouvrir ou fermer les réservations pour tous les catalogues ou seulement certains d’entre eux."
                  />
                  <DashboardCard
                    href="/dashboard/controle-vehicules"
                    icon="⛔"
                    title="Contrôle des véhicules"
                    description="Bloquer la réservation ou la vente d’un véhicule précis sans le retirer du catalogue."
                  />
                </>
              )}
            </DashboardModuleSubgroup>

            <DashboardModuleSubgroup
              eyebrow="VENTES"
              title="Commandes et réservations"
              description="Traiter les achats au prix total, les acomptes et les soldes restant à payer."
            >
              <DashboardCard
                href="/dashboard/commandes"
                icon="📦"
                title="Commandes Nostra Motors"
                description="Recevoir les commandes, suivre leur préparation et modifier leur statut."
                badge={
                  !overview.ordersConfigured
                    ? "À activer"
                    : overview.pendingOrders
                      ? `${overview.pendingOrders} nouvelle(s)`
                      : undefined
                }
              />
              <DashboardCard
                href="/dashboard/reservations-vehicules"
                icon="🔒"
                title="Réservations véhicules"
                description="Valider les acomptes, suivre le solde, attribuer un commercial et accompagner la livraison."
                badge={
                  !vehicleReservationOverview.configured
                    ? "À activer"
                    : vehicleReservationOverview.pending
                      ? `${vehicleReservationOverview.pending} à valider`
                      : vehicleReservationOverview.balanceDue
                        ? `${vehicleReservationOverview.balanceDue} solde(s)`
                        : undefined
                }
              />
            </DashboardModuleSubgroup>

            <DashboardModuleSubgroup
              eyebrow="CLIENTS"
              title="Livraisons et rendez-vous"
              description="Organiser la remise des véhicules et répondre aux demandes des citoyens."
            >
              <DashboardCard
                href="/dashboard/livraisons"
                icon="🚚"
                title="Gestion des livraisons"
                description="Planifier les livraisons, assigner un livreur et suivre leur progression."
                badge={
                  !overview.motorsV41Configured
                    ? "À activer"
                    : overview.pendingDeliveries
                      ? `${overview.pendingDeliveries} à traiter`
                      : undefined
                }
              />
              <DashboardCard
                href="/dashboard/rendez-vous-motors"
                icon="◷"
                title="Demandes de rendez-vous"
                description="Consulter, traiter ou supprimer les demandes envoyées par les citoyens."
                badge={
                  !overview.motorsV41Configured
                    ? "À activer"
                    : overview.pendingAppointments
                      ? `${overview.pendingAppointments} en attente`
                      : undefined
                }
              />
            </DashboardModuleSubgroup>
          </div>
        </DashboardModuleGroup>

        <DashboardModuleGroup
          icon="♻️"
          eyebrow="CONCESSION"
          title="Véhicules rachetés"
          description="Rachats, véhicules d’occasion, ventes et suivi financier."
          defaultOpen={!managerAccess}
        >
          <div className="dashboard-module-subgroups">
            <DashboardModuleSubgroup
              eyebrow="APPROVISIONNEMENT"
              title="Catalogue, stock et reprises"
              description="Enregistrer les véhicules repris et préparer leur mise en vente."
            >
              <DashboardCard
                href="/dashboard/occasion/catalogue"
                icon="🚙"
                title="Catalogue"
                description="Contrôler les véhicules visibles dans la concession publique Véhicules d’occasion."
                badge={
                  !usedOverview.configured
                    ? "À activer"
                    : `${usedOverview.vehicles} véhicule(s)`
                }
              />
              <DashboardCard
                href="/dashboard/occasion/stocks"
                icon="▦"
                title="Stock"
                description="Gérer les quantités et les statuts disponible, réservé ou vendu."
                badge={
                  usedOverview.configured
                    ? `${usedOverview.available} disponible(s)`
                    : undefined
                }
              />
              <DashboardCard
                href="/dashboard/occasion/rachats"
                icon="€"
                title="Rachats"
                description="Enregistrer le prix de rachat, le prix de revente et les informations internes."
              />
              <DashboardCard
                href="/dashboard/occasion/demandes-reprise"
                icon="📥"
                title="Demandes de reprise"
                description="Étudier les véhicules proposés par les clients, envoyer une offre puis les transformer en véhicules rachetés."
                badge={
                  !tradeInOverview.configured
                    ? "À activer"
                    : tradeInOverview.pending
                      ? `${tradeInOverview.pending} à traiter`
                      : undefined
                }
              />
            </DashboardModuleSubgroup>

            <DashboardModuleSubgroup
              eyebrow="COMMERCIAL"
              title="Commandes, ventes et clients"
              description="Suivre le parcours commercial des véhicules d’occasion jusqu’à la vente."
            >
              <DashboardCard
                href="/dashboard/occasion/commandes"
                icon="📦"
                title="Commandes"
                description="Traiter les réservations et commandes avec les mêmes statuts que Nostra Motors."
                badge={
                  usedOverview.pendingOrders
                    ? `${usedOverview.pendingOrders} à traiter`
                    : undefined
                }
              />
              <DashboardCard
                href="/dashboard/occasion/ventes"
                icon="🤝"
                title="Ventes"
                description="Consulter les ventes terminées et la marge réelle de chaque véhicule."
                badge={
                  usedOverview.sold
                    ? `${usedOverview.sold} vendu(s)`
                    : undefined
                }
              />
              <DashboardCard
                href="/dashboard/occasion/clients"
                icon="👥"
                title="Clients"
                description="Retrouver les citoyens ayant réservé ou acheté un véhicule d’occasion."
              />
            </DashboardModuleSubgroup>

            <DashboardModuleSubgroup
              eyebrow="SUIVI"
              title="Documents et statistiques"
              description="Retrouver les documents générés et analyser les résultats de l’activité."
            >
              <DashboardCard
                href="/dashboard/occasion/documents"
                icon="📄"
                title="Documents"
                description="Suivre les documents de commande et de vente générés pour les clients."
              />
              <DashboardCard
                href="/dashboard/occasion/statistiques"
                icon="📊"
                title="Statistiques"
                description="Analyser la valeur du stock, le chiffre d’affaires et les marges prévues ou réalisées."
              />
            </DashboardModuleSubgroup>
          </div>
        </DashboardModuleGroup>

        <DashboardModuleGroup
          icon="🏁"
          eyebrow="SPORT AUTOMOBILE"
          title="Nostra Circuit"
          description="Réservations, homologations, écuries et championnats."
          defaultOpen={!managerAccess}
        >
          <div className="dashboard-module-subgroups">
            <DashboardModuleSubgroup
              eyebrow="EXPLOITATION"
              title="Réservations et homologations"
              description="Traiter l’accès au circuit et contrôler la conformité des véhicules et écuries."
            >
              <DashboardCard
                href="/dashboard/reservations"
                icon="📅"
                title="Demandes de réservation"
                description="Valider, refuser ou supprimer les créneaux demandés sur le calendrier du circuit."
                badge={
                  managerAccess && overview.pendingReservations
                    ? `${overview.pendingReservations} à traiter`
                    : undefined
                }
              />
              <DashboardCard
                href="/dashboard/homologations"
                icon="✅"
                title="Homologations"
                description="Recevoir et traiter les demandes d’homologation de véhicules et d’écuries."
                badge={
                  managerAccess && overview.pendingHomologations
                    ? `${overview.pendingHomologations} en attente`
                    : undefined
                }
              />
            </DashboardModuleSubgroup>

            <DashboardModuleSubgroup
              eyebrow="COMPÉTITION"
              title="Écuries et championnats"
              description="Gérer les inscriptions et programmer les différentes manches."
            >
              <DashboardCard
                href="/dashboard/inscriptions-ecuries"
                icon="🏎️"
                title="Inscriptions des écuries"
                description="Traiter les inscriptions F1, GT3 RS et les demandes pour les championnats."
                badge={
                  managerAccess && !overview.teamRegistrationsConfigured
                    ? "À activer"
                    : managerAccess && overview.pendingTeamRegistrations
                      ? `${overview.pendingTeamRegistrations} à traiter`
                      : undefined
                }
              />
              <DashboardCard
                href="/dashboard/championnats"
                icon="🏆"
                title="Calendriers F1 & GT3 RS"
                description="Programmer les manches et événements dans le calendrier de chaque championnat."
              />
            </DashboardModuleSubgroup>
          </div>
        </DashboardModuleGroup>

        {managerAccess && (
          <DashboardModuleGroup
            icon="🎮"
            eyebrow="ANIMATIONS"
            title="Jeux"
            description="Tirages, jeux en direct et suivi des gains."
          >
            <div className="dashboard-module-subgroups">
              <DashboardModuleSubgroup
                eyebrow="TIRAGES"
                title="Jeux de hasard"
                description="Configurer les participations, les tirages et les gains."
              >
                <DashboardCard
                  href="/dashboard/jeux/roue"
                  icon="🎡"
                  title="Roue de la chance"
                  description="Consulter l’historique et gérer les gains obtenus."
                  badge={
                    !overview.wheelConfigured
                      ? "À activer"
                      : overview.unusedWheelGains
                        ? `${overview.unusedWheelGains} gain(s)`
                        : undefined
                  }
                />
                <DashboardCard
                  href="/dashboard/jeux/tombola"
                  icon="🎟️"
                  title="Tombola"
                  description="Configurer, consulter les tickets et lancer le tirage."
                  badge={
                    !overview.tombolaConfigured
                      ? "À activer"
                      : overview.tombolaTickets
                        ? `${overview.tombolaTickets} ticket(s)`
                        : undefined
                  }
                />
              </DashboardModuleSubgroup>

              <DashboardModuleSubgroup
                eyebrow="ÉMISSIONS"
                title="Jeux animés"
                description="Piloter les parties organisées avec les citoyens."
              >
                <DashboardCard
                  href="/dashboard/jeux/bingo"
                  icon="🎱"
                  title="Bingo"
                  description="Configurer les grilles, tirer les numéros et suivre les gagnants."
                  badge={
                    !overview.bingoConfigured
                      ? "À activer"
                      : overview.bingoCards
                        ? `${overview.bingoCards} grille(s)`
                        : undefined
                  }
                />
                <DashboardCard
                  href="/dashboard/jeux/a-prendre-ou-a-laisser"
                  icon="💼"
                  title="À Prendre ou à Laisser"
                  description="Gérer les gains, les joueurs et les appels du banquier."
                  badge={
                    !overview.dealConfigured
                      ? "À activer"
                      : overview.activeDealSessions
                        ? `${overview.activeDealSessions} partie(s)`
                        : overview.dealEditionOpen
                          ? "Édition ouverte"
                          : undefined
                  }
                />
              </DashboardModuleSubgroup>
            </div>
          </DashboardModuleGroup>
        )}

        {managerAccess && (
          <DashboardModuleGroup
            icon="⚙️"
            eyebrow="DIRECTION"
            title="Direction"
            description="Messagerie officielle, état des activités, finances et événements du groupe."
            defaultOpen
          >
            <div className="dashboard-module-grid dashboard-module-grid-grouped">
              <DashboardCard
                href="/dashboard/messagerie"
                icon="✉️"
                title="Messagerie Nostra Group"
                description="Lire les messages des citoyens et répondre aux conversations."
                badge={
                  !overview.teamMailConfigured
                    ? "À activer"
                    : overview.unreadTeamMail
                      ? `${overview.unreadTeamMail} non lu(s)`
                      : undefined
                }
              />
              <DashboardCard
                href="/dashboard/circuit"
                icon="◉"
                title="État des activités"
                description="Gérer l’état du Nostra Circuit et de Nostra Motors."
                badge={`${overview.circuitLabel} / ${overview.motorsLabel}`}
              />
              <DashboardCard
                href="/dashboard/comptabilite"
                icon="€"
                title="Comptabilité"
                description="Enregistrer les recettes, les dépenses et suivre le solde du groupe."
              />
              <DashboardCard
                href="/dashboard/evenements"
                icon="📆"
                title="Gestion des événements"
                description="Créer, publier, modifier ou annuler les événements Nostra Group."
                badge={
                  overview.generalEvents
                    ? `${overview.generalEvents} événement(s)`
                    : undefined
                }
              />
              <DashboardCard
                href="/dashboard/recrutement/candidatures"
                icon="🗂️"
                title="Gestion des candidatures"
                description="Étudier les dossiers, planifier les entretiens, ajouter des notes privées et préparer les réponses."
                badge={
                  !recruitmentOverview.configured
                    ? "À activer"
                    : recruitmentOverview.pending
                      ? `${recruitmentOverview.pending} à traiter`
                      : undefined
                }
              />
              <DashboardCard
                href="/dashboard/recrutement/annonce-discord"
                icon="📣"
                title="Annonce Discord recrutement"
                description="Préparer une annonce de recrutement, la prévisualiser et la copier pour la publier manuellement sur le Discord du serveur."
                badge="Sans webhook"
              />
            </div>
          </DashboardModuleGroup>
        )}

        {managerAccess && (
          <DashboardModuleGroup
            icon="🛡️"
            eyebrow="ADMINISTRATION"
            title="Site et membres"
            description="Modifier les pages du site et gérer les permissions des comptes."
          >
            <div className="dashboard-module-grid dashboard-module-grid-grouped dashboard-module-grid-two">
              <DashboardCard
                href="/dashboard/contenu"
                icon="✎"
                title="Modification des pages"
                description="Modifier les pages Nostra Motors, Nostra Circuit et Jeux & Événements."
              />
              <DashboardCard
                href="/dashboard/membres"
                icon="👥"
                title="Membres et rôles"
                description="Attribuer les rôles et gérer les accès des comptes."
              />
              <DashboardCard
                href="/dashboard/remise-a-zero"
                icon="↺"
                title="Remise à zéro des tests"
                description="Supprimer les anciennes parties des jeux et remettre les compteurs des documents au début avant l’ouverture."
                badge="Gérant"
              />
            </div>
          </DashboardModuleGroup>
        )}
      </div>
    </DashboardShell>
  );
}
