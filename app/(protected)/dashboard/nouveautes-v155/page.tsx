import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import styles from "@/components/v155/v155.module.css";

const dashboardModules = [
  { href: "/dashboard/fidelite", icon: "◆", title: "Fidélité globale", description: "Modifier niveaux, seuils, remises et avantages visibles immédiatement côté citoyen." },
  { href: "/dashboard/communication", icon: "📣", title: "Communication Nostra", description: "Créer les actualités, bannières temporaires et annonces importantes." },
  { href: "/dashboard/recherche", icon: "⌕", title: "Recherche globale", description: "Retrouver citoyens, véhicules, commandes, rendez-vous, documents et contenus." },
  { href: "/dashboard/parrainage", icon: "🤝", title: "Parrainage citoyen", description: "Suivre parrains, filleuls, codes et récompenses distribuées." },
  { href: "/dashboard/ventes-privees", icon: "◆", title: "Ventes privées / VIP", description: "Créer des offres réservées selon les points de fidélité." },
  { href: "/dashboard/statistiques-avancees", icon: "📊", title: "Statistiques avancées", description: "Suivre l'activité Nostra Group sur 12 mois." },
  { href: "/dashboard/remboursements", icon: "↩", title: "Remboursements Direction", description: "Créer et valider des remboursements partiels ou totaux avec audit." },
  { href: "/dashboard/maintenance-poles", icon: "⛔", title: "Maintenance par pôle", description: "Fermer indépendamment Motors, Circuit, Cercle, Academy ou Événements." },
  { href: "/dashboard/corbeille", icon: "🗑️", title: "Corbeille administrative", description: "Restaurer ou supprimer définitivement les contenus retirés." },
  { href: "/dashboard/audit", icon: "🧾", title: "Journal d’audit", description: "Consulter les actions sensibles et modifications du groupe." },
  { href: "/dashboard/sauvegardes", icon: "💾", title: "Sauvegardes / restauration", description: "Créer et restaurer des sauvegardes de configuration." },
  { href: "/dashboard/location-motors", icon: "🔑", title: "Location Nostra Motors", description: "Gérer les véhicules de location et leurs dossiers." },
  { href: "/dashboard/stock-reel", icon: "📦", title: "Stock réel Motors", description: "Voir le stock physique, réservé, loué et disponible." },
  { href: "/dashboard/etat-des-lieux", icon: "📋", title: "États des lieux", description: "Créer les contrôles départ et retour des véhicules de location." },
  { href: "/dashboard/ventes-flash", icon: "⚡", title: "Ventes flash", description: "Programmer des prix temporaires sur les véhicules Nostra Motors." },
  { href: "/dashboard/evenement-mystere", icon: "?", title: "Événement mystère", description: "Préparer un teaser puis une révélation automatique." },
  { href: "/dashboard/compte-a-rebours", icon: "⏱", title: "Compte à rebours global", description: "Afficher un compte à rebours sur l’ensemble du site." },
  { href: "/dashboard/securite?onglet=roles", icon: "🪪", title: "Rôles personnalisés", description: "Créer et modifier les rôles staff puis régler leurs permissions." },
  { href: "/dashboard/securite?onglet=presence", icon: "●", title: "Citoyens en ligne", description: "Voir les citoyens connectés, leur page actuelle et leur dernière activité." },
  { href: "/dashboard/securite?onglet=blacklist", icon: "⛔", title: "Liste noire interne", description: "Restreindre un citoyen sur un ou plusieurs pôles sans bloquer tout son compte." },
  { href: "/dashboard/securite?onglet=urgence", icon: "🚨", title: "Mode urgence", description: "Couper immédiatement certains pôles depuis Sécurité & administration." },
] as const;

const citizenModules = [
  { href: "/aujourdhui", title: "Aujourd’hui chez Nostra" },
  { href: "/actualites", title: "Actualités Nostra Group" },
  { href: "/ventes-privees", title: "Ventes privées" },
  { href: "/profil/wallet", title: "Wallet Nostra" },
  { href: "/profil/parrainage", title: "Parrainage citoyen" },
  { href: "/recherche", title: "Recherche citoyen" },
  { href: "/profil/vip", title: "Centre VIP" },
  { href: "/evenements/mystere", title: "Événement mystère" },
] as const;

export default function V155HubPage() {
  return (
    <DashboardShell allowedRoles={["manager"]}>
      <DashboardHeader
        title="Nouveautés Nostra Group"
        description="Tous les nouveaux outils V155 et V156 réunis au même endroit."
      />
      <main className={styles.page} style={{ paddingTop: 10 }}>
        <section className={styles.card}>
          <span className={styles.eyebrow}>DIRECTION</span>
          <h2>Modules de gestion</h2>
          <p>Ces accès permettent de vérifier immédiatement que les modules récents sont bien déployés.</p>
        </section>
        <section className={styles.grid} style={{ marginTop: 20 }}>
          {dashboardModules.map((item) => (
            <Link className={styles.card} href={item.href} key={item.href}>
              <span style={{ fontSize: 28 }}>{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <strong className={styles.highlight}>Ouvrir →</strong>
            </Link>
          ))}
        </section>

        <section className={styles.sectionTitle}>
          <span className={styles.eyebrow}>CÔTÉ CITOYEN</span>
          <h2>Pages publiques/personnelles ajoutées</h2>
        </section>
        <section className={styles.grid}>
          {citizenModules.map((item) => (
            <Link className={styles.card} href={item.href} key={item.href}>
              <h3>{item.title}</h3>
              <span className={styles.highlight}>Voir la page →</span>
            </Link>
          ))}
        </section>
      </main>
    </DashboardShell>
  );
}
