import Link from "next/link";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/site/topbar";
import { getDiscordName, getRpName, getSiteRole, isManager } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

const modules = [
  { title: "Membres & rôles", description: "Préparer la gestion des membres, du staff et des autorisations.", status: "À relier" },
  { title: "Réservations", description: "Accéder aux demandes et à l’organisation du Nostra Circuit.", href: "/circuit/reservations", status: "Accès rapide" },
  { title: "Journal officiel", description: "Consulter les annonces et décisions officielles du circuit.", href: "/circuit/journal-officiel", status: "Accès rapide" },
  { title: "Championnats", description: "Ouvrir les espaces Formule 1 et Porsche GT3 RS.", href: "/circuit/championnat-f1", status: "Accès rapide" },
  { title: "Classements", description: "Consulter les classements pilotes et écuries.", href: "/circuit/classement", status: "Accès rapide" },
  { title: "Contenu du site", description: "Centraliser plus tard la modification des pages et publications.", status: "À relier" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  if (!isManager(data.user)) redirect("/accueil");

  return (
    <div className="site-shell">
      <Topbar />
      <main className="dashboard-main">
        <section className="dashboard-hero">
          <div>
            <span className="eyebrow">DIRECTION NOSTRA GROUP</span>
            <h1 className="page-title">Dashboard Gérant</h1>
            <p className="lead">
              Bienvenue {getRpName(data.user) || getDiscordName(data.user)}. Ton compte est reconnu comme <strong>{getSiteRole(data.user)}</strong>.
            </p>
          </div>
          <span className="manager-seal">GÉRANT</span>
        </section>

        <section className="dashboard-notice">
          <strong>Accès sécurisé activé.</strong>
          <span>Ce tableau de bord n’est visible que par les identifiants Discord autorisés.</span>
        </section>

        <section className="manager-grid">
          {modules.map((module) => {
            const content = (
              <>
                <span className={`module-status ${module.href ? "module-status-live" : ""}`}>{module.status}</span>
                <h2>{module.title}</h2>
                <p>{module.description}</p>
                <span className="module-action">{module.href ? "Ouvrir →" : "Configuration future"}</span>
              </>
            );

            return module.href ? (
              <Link className="manager-module" href={module.href} key={module.title}>{content}</Link>
            ) : (
              <article className="manager-module manager-module-muted" key={module.title}>{content}</article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
