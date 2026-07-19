import { EditablePage } from "@/components/site/editable-page";

export default function FidelitePage() {
  const fallback = (
    <>
      <p className="eyebrow">Programme clients</p>
      <h1 className="page-title">Fidélité Nostra</h1>
      <div className="content-grid">
        <article className="info-card"><h3>Silver · 5 achats</h3><p>2 % de remise et peinture au choix offerte.</p></article>
        <article className="info-card"><h3>Gold · 15 achats</h3><p>5 % de remise, avantages Silver et invitations aux événements.</p></article>
        <article className="info-card"><h3>Black Signature · 20 achats</h3><p>10 % de remise, commande prioritaire et statut de client privilégié.</p></article>
      </div>
    </>
  );
  return <EditablePage slug="motors-fidelite" eyebrow="Nostra Motors" defaultTitle="Fidélité Nostra">{fallback}</EditablePage>;
}
