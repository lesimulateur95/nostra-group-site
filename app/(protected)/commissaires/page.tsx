import Link from "next/link";

import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

import styles from "./commissaires-management.module.css";

const managementTools = [
  {
    href: "/dashboard/commissaires",
    icon: "🏁",
    title: "Planning course en direct",
    description:
      "Renseigner l’ouverture des stands, les qualifications, le départ, la météo et les annonces visibles par les citoyens.",
  },
  {
    href: "/dashboard/commissaires/chronometrage",
    icon: "⏱️",
    title: "Chronométrage et tours",
    description:
      "Préparer les pilotes et écuries, lancer les chronomètres, enregistrer chaque tour et publier les résultats.",
  },
  {
    href: "/dashboard/commissaires/classements-speciaux",
    icon: "🏆",
    title: "Classements spéciaux",
    description:
      "Gérer les classements événements, les contre-la-montre et les records officiels du Nostra Circuit.",
  },
  {
    href: "/commissaires/incidents-circuit",
    icon: "📋",
    title: "Rapports d’incident",
    description:
      "Créer et consulter les rapports des incidents survenus pendant les courses et les différentes sessions.",
  },
];

const disciplineTool = {
  href: "/commissaires/sanctions-disciplinaires",
  icon: "⚖️",
  title: "Sanctions disciplinaires",
  description:
    "Attribuer des avertissements, pénalités, suspensions temporaires et retraits de points, puis consulter l’historique complet.",
};

export default async function CommissionersPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const roles = data.user ? await getUserRoleKeys(data.user) : [];

  const tools = roles.includes("manager")
    ? [...managementTools, disciplineTool]
    : managementTools;

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>ACCÈS RÉSERVÉ</span>
        <h1>Gestion des commissaires</h1>
        <p>
          Tous les outils de direction de course sont regroupés ici. Cet
          espace est réservé aux comptes autorisés Commissaire.
        </p>
      </section>

      <section className={styles.grid} aria-label="Outils des commissaires">
        {tools.map((tool) => (
          <Link className={styles.card} href={tool.href} key={tool.href}>
            <span className={styles.icon} aria-hidden="true">
              {tool.icon}
            </span>
            <span className={styles.copy}>
              <strong>{tool.title}</strong>
              <span>{tool.description}</span>
            </span>
            <span className={styles.arrow} aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
