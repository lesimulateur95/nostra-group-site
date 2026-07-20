import type { ReactNode } from "react";

import { DirectionMotorsCards } from "@/components/dashboard/direction-motors-cards";

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
  const isDirectionGroup = eyebrow.trim().toUpperCase() === "DIRECTION";

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

      <div className="dashboard-module-group-content">
        {isDirectionGroup && <DirectionMotorsCards />}
        {children}
      </div>
    </details>
  );
}
