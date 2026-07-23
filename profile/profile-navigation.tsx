import Link from "next/link";

type ProfileNavigationProps = {
  orders: number;
  homologations: number;
  teams: number;
  documents: number;
  games: number;
};

type CountKey = keyof ProfileNavigationProps;

type NavigationCard = {
  href: string;
  icon: string;
  label: string;
  description: string;
  countKey?: CountKey;
};

const cards: NavigationCard[] = [
  {
    href: "/profil/commandes",
    icon: "🚘",
    label: "Mes commandes",
    description:
      "Suivre les véhicules commandés et les messages de Nostra Motors.",
    countKey: "orders",
  },
  {
    href: "/profil/homologations",
    icon: "✅",
    label: "Mes homologations",
    description:
      "Consulter l’état des demandes de véhicules et d’écuries.",
    countKey: "homologations",
  },
  {
    href: "/profil/ecuries",
    icon: "🏁",
    label: "Mes écuries",
    description:
      "Retrouver les écuries inscrites en F1, GT3 RS ou dans les deux championnats.",
    countKey: "teams",
  },
  {
    href: "/profil/documents",
    icon: "📄",
    label: "Documents & factures",
    description:
      "Ouvrir les factures et documents disponibles dans ton espace personnel.",
    countKey: "documents",
  },
  {
    href: "/profil/favoris",
    icon: "★",
    label: "Mes favoris",
    description:
      "Retrouver les véhicules enregistrés et gérer les alertes de retour en stock.",
  },
  {
    href: "/profil/garage",
    icon: "🚘",
    label: "Mon garage",
    description:
      "Suivre mes véhicules, leur livraison, leur historique et leurs documents.",
  },
  {
    href: "/profil/jeux",
    icon: "🎮",
    label: "Jeux",
    description:
      "Retrouver les bonus de la roue, les tickets de tombola et leurs numéros.",
    countKey: "games",
  },
  {
    href: "/profil/badges",
    icon: "🏅",
    label: "Mes badges",
    description: "Voir les succès et récompenses obtenus sur Nostra Group.",
  },
];

export function ProfileNavigation({
  orders,
  homologations,
  teams,
  documents,
  games,
}: ProfileNavigationProps) {
  const counts: Record<CountKey, number> = {
    orders,
    homologations,
    teams,
    documents,
    games,
  };

  return (
    <>
      <style>{`
        .profile-commerce-card:not(.loyalty-card)
          > .profile-commerce-head
          > span:empty::before {
          content: "🛒";
        }
      `}</style>
      <section className="profile-navigation-section">
      <div className="profile-data-heading">
        <div>
          <p className="eyebrow">MON ESPACE</p>
          <h2>Accès rapides</h2>
        </div>
      </div>

      <div className="profile-navigation-grid">
        {cards.map((card) => (
          <Link
            href={card.href}
            className="profile-navigation-card"
            key={card.href}
          >
            <span className="profile-navigation-icon" aria-hidden="true">
              {card.icon}
            </span>
            <div>
              <strong>{card.label}</strong>
              <small>{card.description}</small>
            </div>
            <span className="profile-navigation-count">
              {card.countKey ? counts[card.countKey] : "Voir"}
            </span>
          </Link>
        ))}
      </div>
      </section>
    </>
  );
}
