import { redirect } from "next/navigation";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardModuleGroup } from "@/components/dashboard/dashboard-module-group";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getRequestRoleKeys, getRequestUser } from "@/lib/auth/request-context";
import { getDiscordName, getRpName } from "@/lib/auth/user-profile";
import { getDashboardOverview } from "@/lib/dashboard/overview";

export default async function DashboardPage() {
  const [user, roles] = await Promise.all([
    getRequestUser(),
    getRequestRoleKeys(),
  ]);

  if (!user) redirect("/");

  const managerAccess = roles.includes("manager");
  const commissionerRole = roles.includes("commissioner");
  const ordersAccess =
    managerAccess || roles.includes("employee") || roles.includes("commercial");

  if (!managerAccess && !ordersAccess) {
    redirect(commissionerRole ? "/commissaires" : "/accueil");
  }

  const overview = await getDashboardOverview({
    managerAccess,
    ordersAccess,
  });

  const accessLabel = managerAccess
    ? "GÉRANT"
    : roles.includes("commercial")
      ? "COMMERCIAL"
      : "EMPLOYÉ";

  const totalPending =
    overview.pendingHomologations +
    overview.pendingReservations +
    overview.pendingTeamRegistrations +
    overview.pendingOrders;

  return (
    <DashboardShell>
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
            Le Dashboard reste accessible. Vérifie le centre de diagnostic pour
            identifier le module Supabase concerné.
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
          Le Dashboard charge uniquement les compteurs utiles. Les listes
          complètes sont récupérées seulement après l’ouverture d’un module.
        </p>
      </section>

      <div className="dashboard-module-groups">
        {ordersAccess && (
          <DashboardModuleGroup
            icon="🚘"
            eyebrow="CONCESSION"
            title="Nostra Motors"
            description={
              managerAccess
                ? "Catalogue, commandes clients et quantités disponibles."
                : "Accès limité au traitement des commandes clients."
            }
            defaultOpen={!managerAccess}
          >
            <div className="dashboard-module-grid dashboard-module-grid-grouped">
              {managerAccess && (
                <DashboardCard
                  href="/dashboard/catalogue"
                  icon="🚗"
                  title="Catalogue Nostra Motors"
                  description="Ajouter les véhicules par marque avec leurs photos, caractéristiques, prix et quantité en stock."
                  badge={
                    overview.catalogVehicles
                      ? `${overview.catalogVehicles} véhicule(s)`
                      : undefined
                  }
                />
              )}
              <DashboardCard
                href="/dashboard/commandes"
                icon="📦"
                title="Commandes Nostra Motors"
                description="Recevoir les commandes des citoyens, suivre leur préparation et modifier leur statut."
                badge={
                  !overview.ordersConfigured
                    ? "À activer"
                    : overview.pendingOrders
                      ? `${overview.pendingOrders} nouvelle(s)`
                      : undefined
                }
              />
              <DashboardCard
                href="/dashboard/livraisons"
                icon="🚚"
                title="Gestion des livraisons"
                description="Planifier les livraisons à domicile, assigner un livreur et suivre leur progression."
                badge={
                  !overview.motorsV41Configured
                    ? "V41 à activer"
                    : overview.pendingDeliveries
                      ? `${overview.pendingDeliveries} à traiter`
                      : undefined
                }
              />
              {managerAccess && (
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
              )}
              {managerAccess && (
                <DashboardCard
                  href="/dashboard/stocks"
                  icon="▦"
                  title="Gestion des stocks"
                  description="Modifier les quantités et surveiller les véhicules bientôt épuisés."
                  badge={
                    overview.lowStock
                      ? `${overview.lowStock} alerte(s)`
                      : undefined
                  }
                />
              )}
            </div>
          </DashboardModuleGroup>
        )}

        {managerAccess && (
          <DashboardModuleGroup
            icon="🏁"
            eyebrow="SPORT AUTOMOBILE"
            title="Nostra Circuit"
            description="Réservations, homologations, écuries et championnats."
          >
            <div className="dashboard-module-grid dashboard-module-grid-grouped dashboard-module-grid-four">
              <DashboardCard
                href="/dashboard/reservations"
                icon="📅"
                title="Demandes de réservation"
                description="Valider, refuser ou supprimer les créneaux demandés sur le calendrier du circuit."
                badge={
                  overview.pendingReservations
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
                  overview.pendingHomologations
                    ? `${overview.pendingHomologations} en attente`
                    : undefined
                }
              />
              <DashboardCard
                href="/dashboard/inscriptions-ecuries"
                icon="🏎️"
                title="Inscriptions des écuries"
                description="Traiter les inscriptions F1, GT3 RS et les demandes pour les deux championnats."
                badge={
                  !overview.teamRegistrationsConfigured
                    ? "À activer"
                    : overview.pendingTeamRegistrations
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
            </div>
          </DashboardModuleGroup>
        )}

        {managerAccess && (
          <DashboardModuleGroup
            icon="🎮"
            eyebrow="ANIMATIONS"
            title="Jeux"
            description="Suivre les tirages et gérer les bonus gagnés par les citoyens."
          >
            <div className="dashboard-module-grid dashboard-module-grid-grouped dashboard-module-grid-two">
              <DashboardCard
                href="/dashboard/jeux/roue"
                icon="🎡"
                title="Roue de la chance"
                description="Consulter l’historique, modifier le statut ou retirer un gain du profil du citoyen."
                badge={
                  !overview.wheelConfigured
                    ? "V29 à activer"
                    : overview.unusedWheelGains
                      ? `${overview.unusedWheelGains} gain(s) à utiliser`
                      : undefined
                }
              />
              <DashboardCard
                href="/dashboard/jeux/tombola"
                icon="🎟️"
                title="Tombola"
                description="Configurer le prix, consulter les tickets, lancer le tirage et réinitialiser la tombola."
                badge={
                  !overview.tombolaConfigured
                    ? "V31 à activer"
                    : overview.tombolaTickets
                      ? `${overview.tombolaTickets} ticket(s)`
                      : undefined
                }
              />
              <DashboardCard
                href="/dashboard/jeux/bingo"
                icon="🎱"
                title="Bingo"
                description="Configurer les grilles, tirer les numéros et suivre les gagnants et les récompenses."
                badge={
                  !overview.bingoConfigured
                    ? "V32 à activer"
                    : overview.bingoCards
                      ? `${overview.bingoCards} grille(s)`
                      : undefined
                }
              />
              <DashboardCard
                href="/dashboard/jeux/a-prendre-ou-a-laisser"
                icon="🎁"
                title="À Prendre ou à Laisser"
                description="Créer les 24 gains, suivre les joueurs en direct et déclencher manuellement les appels du banquier."
                badge={
                  !overview.dealConfigured
                    ? "V36 à activer"
                    : overview.activeDealSessions
                      ? `${overview.activeDealSessions} partie(s) en direct`
                      : overview.dealEditionOpen
                        ? "Édition ouverte"
                        : undefined
                }
              />
            </div>
          </DashboardModuleGroup>
        )}

        {ordersAccess && (
          <DashboardModuleGroup
            icon="⚙️"
            eyebrow="DIRECTION"
            title="Direction"
            description={
              managerAccess
                ? "Messagerie officielle, état des activités, finances et événements du groupe."
                : "Accès à la messagerie officielle de l’équipe Nostra Group."
            }
            defaultOpen
          >
            <div className="dashboard-module-grid dashboard-module-grid-grouped">
              <DashboardCard
                href="/dashboard/messagerie"
                icon="📨"
                title="Messagerie Nostra Group"
                description="Lire les messages des citoyens, répondre aux conversations et écrire depuis equipe@nostra.group."
                badge={
                  !overview.teamMailConfigured
                    ? "V35 à activer"
                    : overview.unreadTeamMail
                      ? `${overview.unreadTeamMail} non lu(s)`
                      : undefined
                }
              />
              {managerAccess && (
                <DashboardCard
                  href="/dashboard/circuit"
                  icon="◉"
                  title="État des activités"
                  description="Gérer au même endroit l’état du Nostra Circuit et de Nostra Motors."
                  badge={
                    overview.motorsStatusConfigured
                      ? `${overview.circuitLabel} / ${overview.motorsLabel}`
                      : "Motors à activer"
                  }
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
                  badge={
                    overview.generalEvents
                      ? `${overview.generalEvents} événement(s)`
                      : undefined
                  }
                />
              )}
            </div>
          </DashboardModuleGroup>
        )}

        {managerAccess && (
          <DashboardModuleGroup
            icon="🛠️"
            eyebrow="ADMINISTRATION"
            title="Site et membres"
            description="Modifier les pages du site et gérer les permissions des comptes."
          >
            <div className="dashboard-module-grid dashboard-module-grid-grouped dashboard-module-grid-two">
              <DashboardCard
                href="/dashboard/contenu"
                icon="✎"
                title="Modification des pages"
                description="Choisir entre Nostra Motors, Nostra Circuit et Jeux & Événements, puis modifier leurs pages séparément."
              />
              <DashboardCard
                href="/dashboard/membres"
                icon="👥"
                title="Membres et rôles"
                description="Attribuer les rôles Citoyen, Employé, Commercial, Commissaire ou Gérant, avec plusieurs rôles possibles."
              />
            </div>
          </DashboardModuleGroup>
        )}
      </div>
    </DashboardShell>
  );
}
