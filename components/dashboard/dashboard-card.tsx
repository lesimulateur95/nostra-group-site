import Link from "next/link";

const ICON_FALLBACKS: Record<string, string> = {
  "/dashboard/licences-pilotes": "🏁",
};

export function DashboardCard({
  href,
  icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  badge?: string;
}) {
  const displayedIcon = icon.trim() || ICON_FALLBACKS[href] || "◆";

  return (
    <Link className="dashboard-module-card" href={href}>
      <span className="dashboard-module-icon" aria-hidden="true">
        {displayedIcon}
      </span>
      <span className="dashboard-module-copy">
        <span className="dashboard-module-title-row">
          <strong>{title}</strong>
          {badge && <small>{badge}</small>}
        </span>
        <span>{description}</span>
      </span>
      <span className="dashboard-module-arrow" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
