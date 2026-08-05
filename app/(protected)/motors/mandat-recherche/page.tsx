import { redirect } from "next/navigation";
import { cancelVehicleSearchMandateV134, chooseVehicleSearchProposalV134, submitVehicleSearchMandateV134 } from "@/app/actions/vehicle-search-mandates";
import { createClient } from "@/lib/supabase/server";
import { getOwnSearchMandatesV134, getSearchMandatesConfiguredV134 } from "@/lib/vehicle-search-mandates/data";
import styles from "@/components/used-vehicles/used-vehicles.module.css";

const labels: Record<string, string> = { new: "Demande reçue", searching: "Recherche en cours", proposed: "Propositions disponibles", selected: "Véhicule choisi", closed: "Dossier terminé", refused: "Demande refusée", cancelled: "Demande annulée" };
const money = (value: number) => value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function SearchMandatePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const supabase = await createClient(); const { data } = await supabase.auth.getUser(); if (!data.user) redirect("/");
  const [params, configured, mandates] = await Promise.all([searchParams, getSearchMandatesConfiguredV134(), getOwnSearchMandatesV134(data.user.id)]);
  return <>
    <section className="profile-heading"><span className="eyebrow">NOSTRA MOTORS</span><h1 className="page-title">Mandat de recherche</h1><p className="lead">Confie à un commercial la recherche d’un véhicule précis selon ton budget et tes critères.</p></section>
    {!configured && <div className="dashboard-feedback dashboard-feedback-error">Le module doit être activé avec le SQL V134.</div>}
    {params.sent && <div className="dashboard-feedback dashboard-feedback-success">Mandat <strong>{params.sent}</strong> envoyé.</div>}
    {params.selected && <div className="dashboard-feedback dashboard-feedback-success">Ton choix a été transmis au commercial.</div>}
    {params.error && <div className="dashboard-feedback dashboard-feedback-error">Impossible d’enregistrer l’action. Vérifie les informations ou le SQL V134.</div>}
    {configured && <div className={styles.serviceLayout}>
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Nouvelle recherche</h2><p>La demande ne crée pas encore de commande et ne prélève aucun paiement.</p></div></div>
        <form action={submitVehicleSearchMandateV134} className={styles.form}>
          <label>Marque souhaitée<input name="brand" placeholder="Porsche" /></label><label>Modèle<input name="model" placeholder="911 GT3" /></label>
          <label>Type de véhicule<select name="vehicle_type" defaultValue="sportive"><option value="sportive">Sportive</option><option value="berline">Berline</option><option value="suv">SUV</option><option value="utilitaire">Utilitaire</option><option value="autre">Autre</option></select></label>
          <label>Téléphone<input name="customer_phone" placeholder="06..." /></label><label>Budget minimum<input name="budget_min" inputMode="decimal" placeholder="100 000" /></label><label>Budget maximum<input name="budget_max" inputMode="decimal" required placeholder="300 000" /></label>
          <label>Année minimum<input name="year_min" type="number" min="1950" max="2100" /></label><label>Kilométrage maximum<input name="max_mileage" type="number" min="0" /></label>
          <label className={styles.span4}>Critères obligatoires<textarea name="required_features" rows={3} placeholder="Couleur, moteur, options, configuration..." /></label>
          <label className={styles.span4}>Informations complémentaires<textarea name="notes" rows={3} /></label><button className={styles.primary} type="submit">Envoyer le mandat</button>
        </form>
      </section>
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Mes mandats</h2><p>Suis la recherche et compare toutes les propositions du commercial.</p></div></div>
        <div className={styles.stack}>{mandates.length === 0 && <p className={styles.empty}>Aucun mandat de recherche.</p>}{mandates.map((mandate) => <article className={styles.caseCard} key={mandate.id}>
          <div className={styles.caseHead}><div><span className={styles.badge}>{labels[mandate.status] ?? mandate.status}</span><h3>{mandate.mandate_number} · {[mandate.brand, mandate.model].filter(Boolean).join(" ") || mandate.vehicle_type}</h3></div><strong>{money(mandate.budget_max)}</strong></div>
          {mandate.staff_note && <p className={styles.notice}><strong>Message du commercial :</strong> {mandate.staff_note}</p>}
          <div className={styles.proposalGrid}>{mandate.proposals.map((proposal) => <article className={styles.proposal} key={proposal.id}><h4>{proposal.vehicle_name}</h4><strong>{money(proposal.price)}</strong><p>{proposal.year || "Année inconnue"} · {proposal.mileage == null ? "Kilométrage inconnu" : `${proposal.mileage.toLocaleString("fr-FR")} km`}</p>{proposal.details && <p>{proposal.details}</p>}{proposal.source_url && <a href={proposal.source_url} target="_blank" rel="noreferrer">Voir la source</a>}{mandate.status === "proposed" && proposal.status === "proposed" && <form action={chooseVehicleSearchProposalV134}><input type="hidden" name="proposal_id" value={proposal.id} /><button className={styles.primary}>Choisir ce véhicule</button></form>}</article>)}</div>
          {["new", "searching", "proposed"].includes(mandate.status) && <form action={cancelVehicleSearchMandateV134}><input type="hidden" name="mandate_id" value={mandate.id} /><button className={styles.danger}>Annuler le mandat</button></form>}
        </article>)}</div>
      </section>
    </div>}
  </>;
}
