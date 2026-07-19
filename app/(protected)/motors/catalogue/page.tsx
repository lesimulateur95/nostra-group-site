import { EditablePage } from "@/components/site/editable-page";

export default function CataloguePage() {
  const fallback = (
    <>
      <p className="eyebrow">Nostra Motors</p>
      <h1 className="page-title">Catalogue</h1>
      <div className="coming-soon"><div><h2>Coming Soon</h2><p>Le catalogue sera publié lorsque les photos officielles des véhicules seront prêtes.</p></div></div>
    </>
  );
  return <EditablePage slug="motors-catalogue" eyebrow="Nostra Motors" defaultTitle="Catalogue">{fallback}</EditablePage>;
}
