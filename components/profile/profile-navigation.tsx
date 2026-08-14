import Link from "next/link";

type ProfileNavigationProps = {
  orders: number;
  reservations: number;
  financing: number;
  tradeIns: number;
  searchMandates: number;
  consignments: number;
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
    href: "/profil/reservations-vehicules",
    icon: "🔒",
    label: "Mes réservations",
    description:
      "Suivre l’acompte, la validation et le solde restant de chaque véhicule.",
    countKey: "reservations",
  },
  {
    href: "/profil/financements",
    icon: "💳",
    label: "Mes financements",
    description:
      "Suivre mes dossiers 3×/4×, mon apport de 30 % et mes échéances.",
    countKey: "financing",
  },
  {
    href: "/motors/reprise",
    icon: "♻️",
    label: "Faire reprendre mon véhicule",
    description:
      "Envoyer une demande d’estimation et suivre l’offre de Nostra Motors.",
    countKey: "tradeIns",
  },
  {
    href: "/motors/mandat-recherche",
    icon: "🔎",
    label: "Mes mandats de recherche",
    description: "Demander un véhicule précis et comparer les propositions du commercial.",
    countKey: "searchMandates",
  },
  {
    href: "/motors/depot-vente",
    icon: "🤝",
    label: "Mes dépôts-vente",
    description: "Confier un véhicule à la vente et suivre la commission et le règlement.",
    countKey: "consignments",
  },
  {
    href: "/profil/homologations",
    icon: "✅",
    label: "Mes homologations",
    description: "Consulter l’état des demandes de véhicules et d’écuries.",
    countKey: "homologations",
  },
  {
    href: "/profil/ecuries",
    icon: "🏎️",
    label: "Mes écuries",
    description:
      "Retrouver les écuries inscrites en F1, GT3 RS ou dans les deux championnats.",
    countKey: "teams",
  },
  {
    href: "/profil/billets",
    icon: "🎟️",
    label: "Mes billets",
    description: "Retrouver mes billets Nostra Group et leurs codes de contrôle.",
  },
  {
    href: "/recherche",
    icon: "⌕",
    label: "Recherche globale",
    description: "Retrouver rapidement un véhicule, une commande, un document ou un événement.",
  },
  {
    href: "/profil/licences",
    icon: "🏁",
    label: "Licences & formations",
    description:
      "Suivre mon parcours Academy, mes prérequis, mes qualifications et mes licences.",
  },
  {
    href: "/profil/discipline",
    icon: "⚖️",
    label: "Dossier disciplinaire",
    description:
      "Consulter les avertissements, pénalités, suspensions et points de licence.",
  },
  {
    href: "/profil/contrats",
    icon: "📝",
    label: "Mes contrats de vente",
    description:
      "Retrouver les contrats définitifs générés après signature et paiement.",
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
    href: "/profil/fidelite",
    icon: "◆",
    label: "Ma carte de fidélité",
    description:
      "Afficher ma carte personnalisée, mon grade et mon numéro unique.",
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
    icon: "🚗",
    label: "Mon garage",
    description:
      "Suivre mes véhicules, leur livraison, leur historique et leurs documents.",
  },
  {
    href: "/profil/garanties",
    icon: "🔧",
    label: "Mes garanties Nostra",
    description:
      "Consulter ou souscrire une protection Nostra Care liée à mes véhicules.",
  },
  {
    href: "/motors/atelier",
    icon: "🛠️",
    label: "Atelier Nostra",
    description:
      "Prendre rendez-vous, suivre un diagnostic et accepter un devis atelier.",
  },
  {
    href: "/profil/adresses",
    icon: "📍",
    label: "Mes adresses de livraison",
    description:
      "Enregistrer domicile, garage ou entreprise pour les réutiliser dans mes commandes.",
  },
  {
    href: "/profil/wallet",
    icon: "◈",
    label: "Wallet Nostra",
    description: "Voir mon solde RP, mes points Nostra, remboursements et activité du groupe.",
  },
  {
    href: "/profil/locations",
    icon: "🔑",
    label: "Mes locations",
    description: "Suivre mes véhicules loués, dates, retrait, retour et état des lieux.",
  },
  {
    href: "/profil/parrainage",
    icon: "🤝",
    label: "Parrainage",
    description: "Partager mon code personnel et suivre les récompenses de parrainage.",
  },
  {
    href: "/profil/vip",
    icon: "♛",
    label: "Centre VIP",
    description: "Voir mon statut Nostra, mes avantages et les accès réservés à mon niveau.",
  },
  {
    href: "/ventes-privees",
    icon: "◆",
    label: "Ventes privées",
    description: "Consulter les offres VIP accessibles selon mon niveau de fidélité.",
  },
  {
    href: "/profil/liste-attente",
    icon: "⏳",
    label: "Liste d’attente véhicules",
    description: "Retrouver les véhicules suivis et être alerté lors de leur retour.",
  },
  {
    href: "/profil/informations-bancaires",
    icon: "🏦",
    label: "Informations bancaires",
    description:
      "Consulter mes comptes, mon argent en banque et mes espèces en jeu.",
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
    icon: "🏆",
    label: "Mes badges",
    description: "Voir les succès et récompenses obtenus sur Nostra Group.",
  },
  {
    href: "/profil/compte",
    icon: "⚙️",
    label: "Paramètres du compte",
    description:
      "Gérer les actions sensibles du compte, notamment sa suppression définitive.",
  },
];

export function ProfileNavigation({
  orders,
  reservations,
  financing,
  tradeIns,
  searchMandates,
  consignments,
  homologations,
  teams,
  documents,
  games,
}: ProfileNavigationProps) {
  const counts: Record<CountKey, number> = {
    orders,
    reservations,
    financing,
    tradeIns,
    searchMandates,
    consignments,
    homologations,
    teams,
    documents,
    games,
  };

  return (
    <>
      <style>{`
        .profile-commerce-grid
          > .profile-commerce-card:not(.loyalty-card)
          .profile-commerce-head
          > span:empty::before {
          content: "📦" !important;
          display: block !important;
          font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif !important;
          font-size: 24px !important;
          line-height: 1 !important;
          color: initial !important;
          opacity: 1 !important;
          visibility: visible !important;
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
