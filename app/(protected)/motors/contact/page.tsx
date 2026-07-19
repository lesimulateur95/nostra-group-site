import { EditablePage } from "@/components/site/editable-page";

export default function ContactPage() {
  const fallback = (
    <>
      <p className="eyebrow">Service commercial</p>
      <h1 className="page-title">Contact & commandes</h1>
      <p className="lead">Cette page accueillera les demandes de devis, les commandes et les contacts officiels de la concession. Les formulaires pourront ensuite être reliés à Supabase.</p>
    </>
  );
  return <EditablePage slug="motors-contact" eyebrow="Nostra Motors" defaultTitle="Contact & commandes">{fallback}</EditablePage>;
}
