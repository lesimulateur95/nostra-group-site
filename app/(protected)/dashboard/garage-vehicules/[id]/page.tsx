import Link from "next/link";
import { redirect } from "next/navigation";

import { archiveMaintenanceV164, saveMaintenanceV164 } from "@/app/actions/v164";
import styles from "@/components/v164/v164.module.css";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getStaffGarageVehicle } from "@/lib/garage/data";
import { createClient } from "@/lib/supabase/server";
import { getMotorsEmployeeAccessV164, getVehicleMaintenanceV164 } from "@/lib/v164/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const money = (value: unknown) => Number(value ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString("fr-FR") : "—";
const title = (v: any) => `${v.brand ?? ""} ${v.model ?? ""}`.trim() || v.vehicleName || "Véhicule";

export default async function StaffGarageVehicleV164Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ maintenance_saved?: string; maintenance_archived?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  const manager = roles.includes("manager");
  const access = await getMotorsEmployeeAccessV164(data.user.id, manager);
  if (!manager && (!access.active || (!access.permissions.has("garage_read") && !access.permissions.has("maintenance_manage")))) redirect("/dashboard");

  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isFinite(id) || id <= 0) redirect("/dashboard/garage-vehicules");

  const [vehicleResult, maintenance, q, warranties] = await Promise.all([
    getStaffGarageVehicle(id),
    getVehicleMaintenanceV164(id, true),
    searchParams,
    (supabase as any).from("motors_warranty_contracts_v163").select("id,contract_number,plan_name,status,starts_at,ends_at,amount").eq("customer_vehicle_id", id).order("created_at", { ascending: false }),
  ]);
  if (!vehicleResult.vehicle) redirect("/dashboard/garage-vehicules");
  const vehicle = vehicleResult.vehicle;
  const canMaintain = manager || access.permissions.has("maintenance_manage");
  const activeWarranty = (Array.isArray(warranties.data) ? warranties.data : []).find((row: any) => row.status === "active" && new Date(String(row.ends_at)).getTime() > Date.now());

  return <main className={styles.page}>
    <section className={styles.hero}>
      <div><span className={styles.eyebrow}>DIRECTION · GARAGE CITOYENS</span><h1>{title(vehicle)}</h1><p>{vehicle.customerName} · {vehicle.nostraVin ?? `Garage #${vehicle.id}`}</p></div>
      <Link className={styles.back} href="/dashboard/garage-vehicules">← Tous les garages</Link>
    </section>

    {q.maintenance_saved && <div className={styles.success}>Le carnet d’entretien a été mis à jour et le citoyen a reçu une notification.</div>}
    {q.maintenance_archived && <div className={styles.success}>L’entrée a été archivée. Elle reste tracée dans l’historique administratif.</div>}
    {q.error && <div className={styles.error}>Action impossible : {q.error}</div>}

    <section className={styles.stats}>
      <article className={styles.stat}><span>Propriétaire</span><strong>{vehicle.customerName}</strong></article>
      <article className={styles.stat}><span>Kilométrage</span><strong>{vehicle.currentMileage.toLocaleString("fr-FR")} km</strong></article>
      <article className={styles.stat}><span>Prix payé</span><strong>{money(vehicle.purchasePrice)}</strong></article>
      <article className={styles.stat}><span>Nostra Care</span><strong>{activeWarranty?.plan_name ?? "Aucun actif"}</strong></article>
    </section>

    <section className={styles.grid2}>
      <article className={styles.card}>
        <span className={styles.eyebrow}>DOSSIER VÉHICULE</span><h2>Informations permanentes</h2>
        <div className={styles.list}>
          <div className={styles.item}><strong>VIN Nostra</strong><p>{vehicle.nostraVin ?? "Non généré"}</p></div>
          <div className={styles.item}><strong>Commande</strong><p>{vehicle.orderNumber}</p></div>
          <div className={styles.item}><strong>Date d’acquisition</strong><p>{date(vehicle.acquiredAt ?? vehicle.createdAt)}</p></div>
          <div className={styles.item}><strong>Livraison</strong><p>{vehicle.deliveryAddress || vehicle.deliveryMode || "Showroom Nostra Motors"}</p></div>
        </div>
      </article>

      <article className={styles.card}>
        <span className={styles.eyebrow}>NOSTRA CARE</span><h2>{activeWarranty?.plan_name ?? "Aucun contrat actif"}</h2>
        {activeWarranty ? <div className={styles.list}>
          <div className={styles.item}><strong>{activeWarranty.contract_number}</strong><p>Du {date(activeWarranty.starts_at)} au {date(activeWarranty.ends_at)}</p></div>
          <div className={styles.item}><strong>Montant</strong><p>{money(activeWarranty.amount)}</p></div>
        </div> : <p className={styles.muted}>Aucune protection active sur ce véhicule.</p>}
        <Link className={styles.buttonAlt} href="/dashboard/garanties">Ouvrir Nostra Care</Link>
      </article>
    </section>

    {canMaintain && <section className={styles.card}>
      <span className={styles.eyebrow}>CARNET D’ENTRETIEN NOSTRA</span><h2>Ajouter une intervention directement au garage du citoyen</h2>
      <form className={styles.form} action={saveMaintenanceV164}>
        <input type="hidden" name="customer_vehicle_id" value={vehicle.id}/>
        <div className={styles.formGrid}>
          <label>Type<select name="maintenance_type" defaultValue="entretien"><option value="entretien">Entretien</option><option value="revision">Révision</option><option value="reparation">Réparation</option><option value="controle">Contrôle</option><option value="carrosserie">Carrosserie</option><option value="autre">Autre</option></select></label>
          <label>Titre<input name="title" required placeholder="Ex. Vidange moteur + contrôle général"/></label>
          <label>Date<input type="date" name="service_date" defaultValue={new Date().toISOString().slice(0,10)} required/></label>
          <label>Kilométrage<input type="number" name="mileage" min="0" defaultValue={vehicle.currentMileage || ""}/></label>
        </div>
        <label>Travaux réalisés<textarea name="work_done" placeholder="Décris précisément ce qui a été effectué."/></label>
        <div className={styles.formGrid}>
          <label>Pièces remplacées<textarea name="parts_replaced"/></label>
          <label>État général / constat<textarea name="vehicle_condition"/></label>
        </div>
        <label>Commentaire visible dans le carnet<textarea name="staff_comment" placeholder="Ex. Plaquettes avant à surveiller dans 1 500 km."/></label>
        <div className={styles.formGrid}>
          <label>Prochaine date conseillée<input type="date" name="next_service_date"/></label>
          <label>Prochain kilométrage conseillé<input type="number" name="next_service_mileage" min="0"/></label>
          <label>Coût de l’intervention (€)<input type="number" name="cost" min="0" step="0.01" defaultValue="0"/></label>
          <label>Technicien / équipe<input name="technician_name" placeholder="Nom affiché dans le carnet"/></label>
        </div>
        <div className={styles.row}>
          <label className={styles.permission}><input type="checkbox" name="warranty_covered"/> Pris en charge par Nostra Care</label>
          {activeWarranty && <input type="hidden" name="warranty_contract_id" value={activeWarranty.id}/>} 
          <input type="hidden" name="status" value="completed"/>
          <button className={styles.button}>Ajouter au carnet</button>
        </div>
      </form>
    </section>}

    <section className={styles.card}>
      <div className={styles.row}><div><span className={styles.eyebrow}>CARNET OFFICIEL</span><h2>Interventions enregistrées</h2></div><span className={styles.pill}>{maintenance.records.filter(r=>!r.deletedAt).length} active(s)</span></div>
      <div className={styles.list}>
        {maintenance.records.length === 0 && <p className={styles.muted}>Aucune intervention enregistrée.</p>}
        {maintenance.records.map((record) => <article className={styles.item} key={record.id} style={{opacity: record.deletedAt ? .55 : 1}}>
          <div className={styles.row}><div><strong>{record.title}</strong><p>{date(record.serviceDate)}{record.mileage != null ? ` · ${record.mileage.toLocaleString("fr-FR")} km` : ""} · {money(record.cost)}</p></div><span className={styles.pill}>{record.deletedAt ? "ARCHIVÉ" : record.warrantyCovered ? "NOSTRA CARE" : record.status}</span></div>
          {record.workDone && <p><b>Travaux :</b> {record.workDone}</p>}
          {record.partsReplaced && <p><b>Pièces :</b> {record.partsReplaced}</p>}
          {record.staffComment && <p><b>Commentaire :</b> {record.staffComment}</p>}
          {(record.nextServiceDate || record.nextServiceMileage) && <p><b>Prochain entretien :</b> {record.nextServiceDate ? date(record.nextServiceDate) : ""}{record.nextServiceMileage ? ` · ${record.nextServiceMileage.toLocaleString("fr-FR")} km` : ""}</p>}
          {!record.deletedAt && canMaintain && <form action={archiveMaintenanceV164}><input type="hidden" name="id" value={record.id}/><input type="hidden" name="customer_vehicle_id" value={vehicle.id}/><button className={styles.danger}>Archiver cette entrée</button></form>}
        </article>)}
      </div>
    </section>

    <section className={styles.grid2}>
      <article className={styles.card}><span className={styles.eyebrow}>HISTORIQUE COMPLET</span><h2>Timeline du véhicule</h2><div className={styles.timeline}>{vehicleResult.history.map(entry=><div className={styles.timelineEntry} key={entry.id}><strong>{entry.title}</strong>{entry.details&&<p>{entry.details}</p>}<time>{new Date(entry.createdAt).toLocaleString("fr-FR")}</time></div>)}{vehicleResult.history.length===0&&<p className={styles.muted}>Aucun événement enregistré.</p>}</div></article>
      <article className={styles.card}><span className={styles.eyebrow}>DOCUMENTS</span><h2>Documents associés</h2><div className={styles.list}>{vehicleResult.documents.map(doc=><Link className={styles.buttonAlt} href={`/profil/documents/${doc.id}`} key={doc.id}>{doc.documentTitle || doc.invoiceNumber}</Link>)}{vehicleResult.documents.length===0&&<p className={styles.muted}>Aucun document associé.</p>}</div></article>
    </section>
  </main>;
}
