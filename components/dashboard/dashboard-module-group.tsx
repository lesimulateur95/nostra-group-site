import type { ReactNode } from "react";

import { DashboardAuctionCard } from "@/components/auctions/dashboard-auction-card";
import { DirectionMotorsCards } from "@/components/dashboard/direction-motors-cards";
import { DashboardFortuneCard } from "@/components/fortune/dashboard-fortune-card";
import { DashboardLoyaltyCard } from "@/components/loyalty/dashboard-loyalty-card";

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
  const groupName =
    `${eyebrow} ${title}`.trim().toUpperCase();

  const isDirectionGroup =
    groupName.includes("DIRECTION");

  const isEventsGroup =
    groupName.includes("ÉVÉNEMENT") ||
    groupName.includes("EVENEMENT") ||
    groupName.includes("JEUX");

  return (
    <details
      className="dashboard-module-group dashboard-module-group-collapsible"
      open={defaultOpen}
    >
      <summary className="dashboard-module-group-heading dashboard-module-group-summary">
        <span
          className="dashboard-module-group-icon"
          aria-hidden="true"
        >
          {icon}
        </span>

        <span className="dashboard-module-group-copy">
          <span className="eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
          <span>{description}</span>
        </span>

        <span
          className="dashboard-module-group-chevron"
          aria-hidden="true"
        >
          ⌄
        </span>
      </summary>

      <div className="dashboard-module-group-content">
        {isDirectionGroup ? (
          <div className={styles.directionGrid}>
            <DirectionMotorsCards />
            <DashboardLoyaltyCard />
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
          </>
        )}
      </div>
    </details>
  );
}
