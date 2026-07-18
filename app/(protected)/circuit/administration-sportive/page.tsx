import Link from "next/link";

const sections = [
  {
    href: "/circuit/administration-sportive/reglement-licences",
    title: "Règlement des licences pilotes",
    description: "Conditions d’obtention, obligations et sanctions liées aux licences pilotes.",
  },
  {
    href: "/circuit/administration-sportive/tarifs-licences",
    title: "Tarifs des licences pilotes",
    description: "Tarif officiel de la licence C et informations de délivrance.",
  },
  {
    href: "/circuit/administration-sportive/homologation-vehicules",
    title: "Homologation des véhicules",
    description: "Espace consacré aux conditions et décisions d’homologation des véhicules.",
  },
  {
    href: "/circuit/administration-sportive/homologation-ecuries",
    title: "Homologation des écuries",
    description: "Espace consacré à la création et à l’homologation des écuries officielles.",
  },
];

export default function AdministrationSportivePage() {
  return (
    <>
      <p className="eyebrow">Nostra Circuit</p>
      <h1 className="page-title">Administration sportive</h1>
      <p className="lead">
        Retrouvez les règlements, les licences pilotes et les procédures d’homologation officielles du Nostra Circuit.
      </p>
      <div className="admin-sport-grid">
        {sections.map((section) => (
          <Link className="admin-sport-card" href={section.href} key={section.href}>
            <span className="admin-sport-label">Dossier officiel</span>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <strong>Ouvrir →</strong>
          </Link>
        ))}
      </div>
    </>
  );
}
