import Link from "next/link";

type ProfileNavigationProps = {
  orders: number;
  homologations: number;
  teams: number;
  documents: number;
};

const cards = [
  { href: "/profil/commandes", icon: "🧾", label: "Mes commandes", description: "Suivre les véhicules commandés et les messages de Nostra Motors.", countKey: "orders" },
  { href: "/profil/homologations", icon: "✅", label: "Mes homologations", description: "Consulter l’état des demandes de véhicules et d’écuries.", countKey: "homologations" },
  { href: "/profil/ecuries", icon: "🏎️", label: "Mes écuries", description: "Retrouver les écuries inscrites en F1, GT3 RS ou dans les deux championnats.", countKey: "teams" },
  { href: "/profil/documents", icon: "📁", label: "Documents & factures", description: "Ouvrir les factures et documents disponibles dans ton espace personnel.", countKey: "documents" },
] as const;

export function ProfileNavigation({ orders, homologations, teams, documents }: ProfileNavigationProps) {
  const counts = { orders, homologations, teams, documents };

  return (
    <section className="profile-navigation-section">
      <div className="profile-data-heading">
        <div><p className="eyebrow">MON ESPACE</p><h2>Accès rapides</h2></div>
      </div>
      <div className="profile-navigation-grid">
        {cards.map((card) => (
          <Link href={card.href} className="profile-navigation-card" key={card.href}>
            <span className="profile-navigation-icon">{card.icon}</span>
            <div><strong>{card.label}</strong><small>{card.description}</small></div>
            <span className="profile-navigation-count">{counts[card.countKey]}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
