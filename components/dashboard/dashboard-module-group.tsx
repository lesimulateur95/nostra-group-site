import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import { DashboardAuctionCard } from "@/components/auctions/dashboard-auction-card";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DirectionMotorsCards } from "@/components/dashboard/direction-motors-cards";
import { DashboardFortuneCard } from "@/components/fortune/dashboard-fortune-card";
import { DashboardLoyaltyCard } from "@/components/loyalty/dashboard-loyalty-card";
import styles from "./dashboard-module-group-v53.module.css";

type ElementWithChildren = ReactElement<{
  children?: ReactNode;
  href?: string;
}>;

function containsSecurityCard(node: ReactNode): boolean {
  let found = false;

  Children.forEach(node, (child) => {
    if (found || !isValidElement(child)) return;

    const element = child as ElementWithChildren;

    if (element.props.href === "/dashboard/securite") {
      found = true;
      return;
    }

    if (element.props.children !== undefined) {
      found = containsSecurityCard(element.props.children);
    }
  });

  return found;
}

function removeSecurityCard(node: ReactNode): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;

    const element = child as ElementWithChildren;

    if (element.props.href === "/dashboard/securite") {
      return null;
    }

    if (element.props.children === undefined) {
      return element;
    }

    return cloneElement(
      element,
      undefined,
      removeSecurityCard(element.props.children),
    );
  });
}

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
  const isSiteMembersGroup = title.trim().toLowerCase() === "site et membres";

  const visibleChildren = isDirectionGroup
    ? removeSecurityCard(children)
    : children;
  const securityAlreadyInSite = isSiteMembersGroup
    ? containsSecurityCard(children)
    : false;
  const displayedDescription = isSiteMembersGroup
    ? "Modifier les pages du site, gérer les membres, la sécurité et les sauvegardes."
    : description;
  const contentClassName = [
    "dashboard-module-group-content",
    isGamesGroup ? styles.gamesContent : "",
    isSiteMembersGroup ? styles.siteMembersContent : "",
    isDirectionGroup ? styles.directionContent : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <details
      className="dashboard-module-group dashboard-module-group-collapsible"
      open={defaultOpen}
      data-dashboard-group={title}
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
          <span>{displayedDescription}</span>
        </span>
        <span
          className="dashboard-module-group-chevron"
          aria-hidden="true"
        >
          ⌄
        </span>
      </summary>

      <div className={contentClassName}>
        {isDirectionGroup && (
          <>
            <DirectionMotorsCards />
            <DashboardLoyaltyCard />
          </>
        )}

        {isEventsGroup && (
          <>
            <DashboardFortuneCard />
            <DashboardAuctionCard />
          </>
        )}

        {visibleChildren}

        {isSiteMembersGroup && !securityAlreadyInSite && (
          <div className="dashboard-module-grid dashboard-module-grid-grouped">
            <DashboardCard
              href="/dashboard/securite"
              icon="🛡️"
              title="Sécurité et sauvegardes"
              description="Gérer les sauvegardes du site, contrôler la sécurité et restaurer les données si nécessaire."
            />
          </div>
        )}
      </div>
    </details>
  );
}
