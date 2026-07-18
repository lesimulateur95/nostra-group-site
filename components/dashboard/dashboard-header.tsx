import Link from "next/link";

export function DashboardHeader({
  eyebrow = "DIRECTION NOSTRA GROUP",
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <header className="dashboard-page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="page-title">{title}</h1>
        <p className="lead">{description}</p>
      </div>
      <Link className="dashboard-back" href="/dashboard">← Retour au dashboard</Link>
    </header>
  );
}
