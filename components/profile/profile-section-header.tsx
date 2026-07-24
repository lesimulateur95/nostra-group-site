import Link from "next/link";

export function ProfileSectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="profile-section-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="page-title">{title}</h1>
        <p className="lead">{description}</p>
      </div>
      <Link className="btn btn-secondary" href="/profil">
        ← Retour à mon profil
      </Link>
    </header>
  );
}
