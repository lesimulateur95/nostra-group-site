import { EditablePage } from "@/components/site/editable-page";

export default function HomologationEcuriesPage() {
  const defaultContent = (
    <article className="circuit-document">
      <header className="document-hero">
        <p className="eyebrow">Administration sportive</p>
        <h1 className="page-title">Homologation des écuries</h1>
        <p className="document-intro">Cette rubrique regroupe les conditions de création, d’enregistrement et d’homologation des écuries officielles du Nostra Circuit.</p>
      </header>
      <section className="document-section empty-official-section">
        <h2>Document officiel à publier</h2>
        <p>Le règlement d’homologation pourra être rédigé et publié directement depuis le Dashboard Gérant.</p>
      </section>
    </article>
  );

  return (
    <EditablePage slug="homologation-ecuries" defaultTitle="Homologation des écuries">
      {defaultContent}
    </EditablePage>
  );
}
