import { notFound } from "next/navigation";
import { SimpleEditablePage } from "@/components/site/simple-editable-page";

const pages = {
  'demande': { slug: 'reservations-demande', title: 'Demande de créneau', eyebrow: 'Réservations', intro: 'Informations et procédure pour demander un créneau sur le Nostra Circuit.' },
  'validees': { slug: 'reservations-validees', title: 'Réservations validées', eyebrow: 'Réservations', intro: 'Créneaux officiellement confirmés par l’équipe du circuit.' },
  'conditions': { slug: 'reservations-conditions', title: 'Conditions d’accès', eyebrow: 'Réservations', intro: 'Conditions à respecter avant toute venue ou réservation.' },
} as const;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug as keyof typeof pages];
  if (!page) notFound();
  return <SimpleEditablePage {...page} />;
}
