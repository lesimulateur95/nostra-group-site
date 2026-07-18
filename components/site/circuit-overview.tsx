import Link from "next/link";

export function CircuitOverview({
  eyebrow,
  title,
  description,
  pages,
}: {
  eyebrow: string;
  title: string;
  description: string;
  pages: Array<{ href: string; title: string; description: string }>;
}) {
  return (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      <p className="lead">{description}</p>
      <div className="admin-sport-grid overview-link-grid">
        {pages.map((page) => (
          <Link className="admin-sport-card" href={page.href} key={page.href}>
            <span className="admin-card-arrow">→</span>
            <h2>{page.title}</h2>
            <p>{page.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
