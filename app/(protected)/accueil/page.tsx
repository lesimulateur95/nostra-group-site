import Link from "next/link";
import { Topbar } from "@/components/site/topbar";
import { getUserRoleKey } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

const publicPortals = [
  {
    href: "/motors",
    kicker: "AUTOMOBILE",
    title: "NOSTRA MOTORS",
    description: "Concession de luxe, véhicules exclusifs, fidélité et services clients.",
  },
  {
    href: "/circuit",
    kicker: "SPORT AUTOMOBILE",
    title: "NOSTRA CIRCUIT",
    description: "Réservations, activités piste, règlements et informations du circuit.",
  },
  {
    href: "/evenements",
    kicker: "COMMUNAUTÉ",
    title: "ÉVÉNEMENTS & JEUX",
    description: "Agenda, inscriptions et animations organisées par Nostra Group.",
  },
];

const commissionerPortal = {
  href: "/commissaires",
  kicker: "ACCÈS RÉSERVÉ",
  title: "ESPACE COMMISSAIRES",
  description: "Règlement, briefing avant course et suivi des incidents du Nostra Circuit.",
};

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const role = await getUserRoleKey(data.user);
  const portals = role === "manager" || role === "commissioner"
    ? [...publicPortals, commissionerPortal]
    : publicPortals;

  return (
    <div className="site-shell">
      <Topbar />
      <main className="home-main">
        <p className="eyebrow">Universe Life · Saint-Martin V2</p>
        <h1 className="home-title">Nostra Group</h1>
        <p className="home-sub">Choisissez l’espace que vous souhaitez ouvrir.</p>
        <section className="portal-grid">
          {portals.map((portal) => (
            <Link href={portal.href} className="portal-card" key={portal.href}>
              <span className="portal-kicker">{portal.kicker}</span>
              <h2 className="portal-title">{portal.title}</h2>
              <p className="portal-desc">{portal.description}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
