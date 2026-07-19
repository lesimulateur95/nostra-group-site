import Link from "next/link";

export function ProfileSectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="profile-section-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="page-title">{title}</h1>
        <p className="lead">{description}</p>
      </div>
      <Link href="/profil" className="profile-back-link">← Retour à mon profil</Link>
    </section>
  );
}
