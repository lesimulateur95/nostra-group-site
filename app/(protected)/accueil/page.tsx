import { Suspense } from "react";
import Link from "next/link";

import { CommissionerPortalCard } from "@/components/home/commissioner-portal-card";
import { HomeReviewsLoader } from "@/components/reviews/home-reviews-loader";
import { Topbar } from "@/components/site/topbar";
import { getCasinoSettings } from "@/lib/casino/data";
import { getBannersV155 } from "@/lib/v155/data";
import { HomeBannersV155 } from "@/components/v155/home-banners";

type Portal = {
  href: string;
  kicker: string;
  title: string;
  description: string;
};

const publicPortals: Portal[] = [
  {
    href: "/motors",
    kicker: "AUTOMOBILE",
    title: "NOSTRA MOTORS",
    description:
      "Concession de luxe, véhicules exclusifs, fidélité et services clients.",
  },
  {
    href: "/circuit",
    kicker: "SPORT AUTOMOBILE",
    title: "NOSTRA CIRCUIT",
    description:
      "Réservations, activités piste, règlements et informations du circuit.",
  },
  {
    href: "/evenements",
    kicker: "COMMUNAUTÉ",
    title: "ÉVÉNEMENTS & JEUX",
    description:
      "Agenda, inscriptions et animations organisées par Nostra Group.",
  },
  {
    href: "/aujourdhui",
    kicker: "EN DIRECT",
    title: "AUJOURD’HUI CHEZ NOSTRA",
    description: "Événements, showroom, billetterie et nouveautés du jour.",
  },
  {
    href: "/actualites",
    kicker: "NOSTRA GROUP",
    title: "ACTUALITÉS",
    description: "Retrouver toutes les annonces et nouveautés du groupe.",
  },
  {
    href: "/ventes-privees",
    kicker: "ACCÈS VIP",
    title: "VENTES PRIVÉES",
    description: "Offres réservées selon ton niveau de fidélité Nostra.",
  },
  {
    href: "/recrutement",
    kicker: "REJOINDRE LE GROUPE",
    title: "RECRUTEMENT",
    description:
      "Découvrir les métiers proposés par Nostra Motors, Nostra Circuit et Nostra Group.",
  },
];

const motorsServicePortals: Portal[] = [
  {
    href: "/motors/rendez-vous",
    kicker: "SERVICE CLIENT",
    title: "PRISE DE RENDEZ-VOUS",
    description:
      "Réserver une visite du showroom ou demander l’essai d’un véhicule.",
  },
  {
    href: "/motors/top-ventes",
    kicker: "NOSTRA MOTORS",
    title: "VÉHICULES EN TOP VENTE",
    description:
      "Découvrir les véhicules actuellement mis en avant par la concession.",
  },
];

function PortalCard({
  portal,
}: {
  portal: Portal;
}) {
  return (
    <Link href={portal.href} className="portal-card">
      <span className="portal-kicker">{portal.kicker}</span>
      <h2 className="portal-title">{portal.title}</h2>
      <p className="portal-desc">{portal.description}</p>
    </Link>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    review_saved?: string;
    review_deleted?: string;
    review_error?: string;
  }>;
}) {
  const params = await searchParams;
  const [casinoSettings, banners] = await Promise.all([getCasinoSettings(), getBannersV155(false)]);

  return (
    <div className="site-shell">
      <Topbar />
      <main className="home-main">
        <p className="eyebrow">Universe Life · Saint-Martin V2</p>
        <h1 className="home-title">Nostra Group</h1>
        <p className="home-sub">
          Choisissez l’espace que vous souhaitez ouvrir.
        </p>

        <HomeBannersV155 banners={banners} />

        <section className="portal-grid">
          {casinoSettings.publicEnabled && (
            <PortalCard
              portal={{
                href: "/casino",
                kicker: "CERCLE PRIVÉ",
                title: casinoSettings.name.toUpperCase(),
                description:
                  "Poker, jeux de table, machines et espace joueur dans un univers entièrement séparé.",
              }}
            />
          )}
          {publicPortals.map((portal) => (
            <PortalCard portal={portal} key={portal.href} />
          ))}

          <Suspense fallback={null}>
            <CommissionerPortalCard />
          </Suspense>

          {motorsServicePortals.map((portal) => (
            <PortalCard portal={portal} key={portal.href} />
          ))}
        </section>

        <Suspense fallback={null}>
          <HomeReviewsLoader
            saved={Boolean(params.review_saved)}
            deleted={Boolean(params.review_deleted)}
            error={params.review_error ?? null}
          />
        </Suspense>
      </main>
    </div>
  );
}
