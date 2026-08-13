import { deleteOrder, updateOrder } from "@/app/actions/orders";
import { updateOrderProgressV153 } from "@/app/actions/v153";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getOrderModuleConfigured, getOrders } from "@/lib/backoffice/data";
import { ORDERS_SETUP_SQL } from "@/lib/backoffice/orders-setup-sql";
import { getUserRoleKeys } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { getCommercialOptionsV137 } from "@/lib/commercial-performance/data";
import { getOrderProgressMapV153, type OrderProgressV153 } from "@/lib/v153/data";
import styles from "@/components/v153/v153.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = { pending: "Envoyée", confirmed: "Confirmée", preparing: "En préparation", ready: "Prête à être récupérée", completed: "Récupérée", cancelled: "Annulée" };
const stageLabels: Record<string,string> = { received:"Commande reçue",confirmed:"Commande confirmée",preparing:"Préparation",paint:"Peinture",plate:"Installation plaque",quality:"Contrôle qualité",ready:"Prêt en concession",collected:"Véhicule récupéré",cancelled:"Annulée" };
const defaultProgress:Record<string,number>={received:5,confirmed:20,preparing:40,paint:60,plate:75,quality:88,ready:95,collected:100,cancelled:0};
function money(value:number|string){return Number(value).toLocaleString("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0})}
function dt(v:string|null|undefined){return v?new Date(v).toISOString().slice(0,16):""}

export default async function OrdersDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const supabase = await createClient(); const { data: authData } = await supabase.auth.getUser();
  const roles = await getUserRoleKeys(authData.user); const canDeleteOrders = roles.includes("manager");
  const commercials = canDeleteOrders ? await getCommercialOptionsV137() : [];
  const configured = await getOrderModuleConfigured(); const orders = configured ? await getOrders() : [];
  const progressMap = configured ? await getOrderProgressMapV153(orders.map(o=>Number(o.id))) : new Map<number,OrderProgressV153>();
  const activeOrders = orders.filter((order) => !["completed", "cancelled"].includes(order.status));
  const archivedOrders = orders.filter((order) => ["completed", "cancelled"].includes(order.status));
  return <DashboardShell>
    <DashboardHeader title="Commandes Nostra Motors" description="Suivi commercial et avancement atelier : préparation, peinture, plaque, contrôle qualité et retrait en concession." />
    {!configured&&<section className="dashboard-setup"><span className="module-status">Activation nécessaire</span><h2>Activer les commandes du catalogue</h2><details open><summary>SQL à copier</summary><pre>{ORDERS_SETUP_SQL}</pre></details></section>}
    {params.saved&&<div className="dashboard-feedback dashboard-feedback-success">Le statut de la commande a été mis à jour.</div>}
    {params.progress_saved&&<div className="dashboard-feedback dashboard-feedback-success">L’avancement public de la commande a été mis à jour.</div>}
    {params.deleted&&<div className="dashboard-feedback">La commande a été supprimée définitivement.</div>}
    {params.error&&<div className="dashboard-feedback dashboard-feedback-error">Impossible de traiter cette commande.</div>}
    {configured&&<><section className="reservation-admin-summary"><article><span>Commandes actives</span><strong>{activeOrders.length}</strong></article><article><span>Total reçu</span><strong>{orders.length}</strong></article></section><section className="orders-admin-list">{activeOrders.length===0&&<div className="backoffice-panel empty-state">Aucune commande active.</div>}{activeOrders.map(order=><OrderCard key={order.id} order={order} progress={progressMap.get(Number(order.id))} canDelete={canDeleteOrders} commercials={commercials}/>)}</section>{archivedOrders.length>0&&<section className="processed-reservations"><div className="dashboard-section-heading dashboard-section-heading-tight"><p className="eyebrow">HISTORIQUE</p><h2>Commandes terminées ou annulées</h2></div><div className="orders-admin-list">{archivedOrders.map(order=><OrderCard key={order.id} order={order} progress={progressMap.get(Number(order.id))} canDelete={canDeleteOrders} commercials={commercials}/>)}</div></section>}</>}
  </DashboardShell>;
}

function OrderCard({order,progress,canDelete,commercials}:{order:Awaited<ReturnType<typeof getOrders>>[number];progress?:OrderProgressV153;canDelete:boolean;commercials:Awaited<ReturnType<typeof getCommercialOptionsV137>>}){
  const stage=progress?.stage??"received"; const pct=progress?.progressPercent??defaultProgress[stage]??5;
  return <article className="backoffice-panel order-admin-card">
    <div className="order-admin-head"><div><span className={`request-status order-status-${order.status}`}>{statusLabels[order.status]??order.status}</span><h2>{order.order_number}</h2><p><strong>{order.customer_name||"Client Nostra Motors"}</strong> · {new Date(order.created_at).toLocaleString("fr-FR")}</p></div><strong className="order-admin-total">{money(order.total)}</strong></div>
    <div className="order-items-list">{order.items.map((item,index)=><div key={`${order.id}-${index}`}><span>{item.quantity} × {item.name}{item.reservation_id&&<small className="order-delivery-address">Réservation #{item.reservation_id} · Acompte payé : {money(item.deposit_paid)} · Solde payé : {money(item.balance_paid)}</small>}{item.delivery_address&&<small className="order-delivery-address">Adresse : {item.delivery_address}{item.delivery_phone?` · Téléphone : ${item.delivery_phone}`:""}</small>}</span><strong>{money(item.quantity*item.unit_price)}</strong></div>)}</div>
    {order.customer_note&&<div className="reservation-reason"><span>Message du client</span><p>{order.customer_note}</p></div>}
    <section className={styles.card} style={{margin:"18px 0"}}><div className={styles.row}><div><p className={styles.eyebrow}>SUIVI CLIENT</p><h3>{stageLabels[stage]??stage}</h3></div><strong>{pct}%</strong></div><div className={styles.progress}><span style={{width:`${pct}%`}}/></div><form action={updateOrderProgressV153} className={styles.form} style={{marginTop:16}}><input type="hidden" name="order_id" value={order.id}/><label>Étape<select name="stage" defaultValue={stage}>{Object.entries(stageLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>Progression %<input name="progress_percent" type="number" min="0" max="100" defaultValue={pct}/></label><label>État du paiement<select name="payment_status" defaultValue={progress?.paymentStatus??"paid"}><option value="pending">En attente</option><option value="paid">Payé</option><option value="refunded">Remboursé</option></select></label><label>Date estimée de disponibilité<input name="estimated_ready_at" type="datetime-local" defaultValue={dt(progress?.estimatedReadyAt)}/></label><label className={styles.full}>Message visible par le citoyen<textarea name="public_message" rows={3} placeholder="Ex. La peinture est terminée, passage au contrôle qualité."/></label><label className={styles.full}>Note interne<textarea name="internal_note" rows={2} defaultValue={progress?.internalNote??""}/></label><div><button className={styles.button} type="submit">Mettre à jour l’avancement</button></div></form></section>
    <form action={updateOrder} className="backoffice-form homologation-review-form"><input type="hidden" name="id" value={order.id}/><label>Statut commercial<select name="status" defaultValue={order.status}><option value="pending">Envoyée</option><option value="confirmed">Confirmée</option><option value="preparing">En préparation</option><option value="ready">Prête à être récupérée</option><option value="completed">Récupérée</option><option value="cancelled">Annulée</option></select></label>{canDelete?<label>Commercial attribué<select name="commercial_user_id" defaultValue={order.commercial_user_id??""}><option value="">Non attribuée</option>{commercials.map(c=><option key={c.userId} value={c.userId}>{c.name}</option>)}</select></label>:<div className="reservation-reason"><span>Commercial attribué</span><p>{order.commercial_name||"Non attribuée"}</p></div>}<label className="form-span-2">Message commercial visible<textarea name="admin_note" rows={3} defaultValue={order.admin_note??""}/></label><button className="btn" type="submit">Enregistrer le suivi commercial</button></form>
    {canDelete&&<form action={deleteOrder} className="danger-form"><input type="hidden" name="id" value={order.id}/><button type="submit">Supprimer définitivement la commande</button></form>}
  </article>;
}
