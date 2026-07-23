import type { ReactNode } from "react";

import { DashboardAuctionCard } from "@/components/auctions/dashboard-auction-card";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DirectionMotorsCards } from "@/components/dashboard/direction-motors-cards";
import { DashboardOperationsV50Cards } from "@/components/dashboard/dashboard-operations-v50-cards";
import { DashboardFortuneCard } from "@/components/fortune/dashboard-fortune-card";
import { DashboardLoyaltyCard } from "@/components/loyalty/dashboard-loyalty-card";
import { DashboardLicenseAdminCard } from "@/components/licenses/dashboard-license-admin-card";
import styles from "./dashboard-module-group.module.css";

export function DashboardModuleGroup({
  icon,
  eyebrow,
  title,
  description,
  children,
  defaultOpen = false,
}: {
  icon: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const groupName = `${eyebrow} ${title}`.trim().toUpperCase();
  const isDirectionGroup = groupName.includes("DIRECTION");
  const isEventsGroup =
    groupName.includes("ÉVÉNEMENT") ||
    groupName.includes("EVENEMENT") ||
    groupName.includes("JEUX");
  const isGamesGroup = groupName.includes("JEUX");
  const isSiteMembersGroup = groupName.includes("SITE ET MEMBRES");

  const contentClassName = [
    "dashboard-module-group-content",
    isGamesGroup ? styles.gamesGrid : "",
    isSiteMembersGroup ? styles.siteMembersGrid : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <details
      className="dashboard-module-group dashboard-module-group-collapsible"
      open={defaultOpen}
    >
      <summary className="dashboard-module-group-heading dashboard-module-group-summary">
        <span className="dashboard-module-group-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="dashboard-module-group-copy">
          <span className="eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
          <span>{description}</span>
        </span>
        <span className="dashboard-module-group-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>

      <div className={contentClassName}>
        {isDirectionGroup ? (
          <div className={styles.directionGrid}>
            <DirectionMotorsCards />
            <DashboardLoyaltyCard />
            <DashboardOperationsV50Cards />
            <DashboardLicenseAdminCard />
            {children}
          </div>
        ) : (
          <>
            {isEventsGroup && (
              <>
                <DashboardFortuneCard />
                <DashboardAuctionCard />
              </>
            )}

            {children}

            {isGamesGroup && (
              <div style={{ gridColumn: "1 / -1" }}>
                <DashboardCard
                  href="/dashboard/jeux/chasse-au-tresor"
                  icon="🗺️"
                  title="Chasses au trésor"
                  description="Créer une chasse, préparer autant d’indices que nécessaire et les révéler progressivement."
                />
              </div>
            )}

            {isSiteMembersGroup && (
              <>
                <div className="dashboard-module-grid dashboard-module-grid-grouped">
                  <DashboardCard
                    href="/dashboard/journal"
                    icon=""
                    title="Journal des actions"
                    description="Voir les modifications importantes et leur auteur."
                  />
                </div>
                <div className="dashboard-module-grid dashboard-module-grid-grouped">
                  <DashboardCard
                    href="/dashboard/securite?onglet=permissions"
                    icon=""
                    title="Permissions des pages"
                    description="Choisir directement les pages accessibles à chaque rôle du site."
                  />
                </div>
                <div className="dashboard-module-grid dashboard-module-grid-grouped">
                  <DashboardCard
                    href="/dashboard/securite"
                    icon="🛡️"
                    title="Sécurité & administration"
                    description="Gérer la maintenance, les comptes bloqués, la corbeille, les sauvegardes et les historiques."
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </details>
  );
}
