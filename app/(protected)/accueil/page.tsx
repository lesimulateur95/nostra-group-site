import Link from "next/link";
import { Topbar } from "@/components/site/topbar";

const portals = [
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

export default function HomePage() {
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
