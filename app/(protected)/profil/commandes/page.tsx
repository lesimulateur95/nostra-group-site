import { redirect } from "next/navigation";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { getProfileCommerceData } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";
import { getOrderProgressHistoryV153, getOrderProgressMapV153 } from "@/lib/v153/data";
import styles from "@/components/v153/v153.module.css";

function money(value: number | string) {
  return Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

const stageLabels: Record<string, string> = {
  received: "Commande reçue",
  confirmed: "Commande confirmée",
  preparing: "Préparation du véhicule",
  paint: "Peinture",
  plate: "Installation de la nouvelle plaque",
  quality: "Contrôle qualité",
  ready: "Prêt en concession",
  collected: "Véhicule récupéré",
  cancelled: "Commande annulée",
};

const deliveryLabels: Record<string, string> = {
  awaiting_planning: "En attente de planification",
  planned: "Livraison planifiée",
  preparing: "Véhicules en préparation",
  loading: "Chargement en cours",
  departed: "Départ de Nostra Motors",
  in_transit: "En livraison",
  delivered: "Livré",
  closed: "Livraison clôturée",
  cancelled: "Livraison annulée",
};

function items(order: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = order.items;
  if (Array.isArray(raw)) return raw.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  if (typeof raw === "string") {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

function hasHomeDelivery(order: Record<string, unknown>): boolean {
  return items(order).some((item) => item.item_type === "delivery");
}

export default async function ProfileOrdersPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const commerce = await getProfileCommerceData(data.user.id);
  const progressMap = await getOrderProgressMapV153(commerce.orders.map((order) => Number(order.id)));
  const histories = await Promise.all(commerce.orders.map((order) => getOrderProgressHistoryV153(Number(order.id))));
  const historyMap = new Map(commerce.orders.map((order, index) => [Number(order.id), histories[index]]));

  return <>
    <ProfileSectionHeader eyebrow="NOSTRA MOTORS" title="Mes commandes" description="Suis chaque étape de ta commande puis, en cas de livraison, le chargement et le trajet jusqu’à l’adresse choisie." />
    <section className={styles.stack}>
      {commerce.orders.length === 0 && <article className={styles.card}>Aucune commande enregistrée.</article>}
      {commerce.orders.map((order) => {
        const p = progressMap.get(Number(order.id));
        const pct = p?.progressPercent ?? 5;
        const stage = p?.stage ?? "received";
        const history = historyMap.get(Number(order.id)) ?? [];
        const delivery = hasHomeDelivery(order as unknown as Record<string, unknown>);
        const deliveryStage = String((order as unknown as Record<string, unknown>).delivery_stage ?? "awaiting_planning");
        const rawOrder = order as unknown as Record<string, unknown>;
        const deliveryDate = rawOrder.delivery_date ? String(rawOrder.delivery_date) : "";
        const deliveryWindowEnd = rawOrder.delivery_window_end ? String(rawOrder.delivery_window_end) : "";
        const deliveryDriver = rawOrder.delivery_driver ? String(rawOrder.delivery_driver) : "";
        const deliveryAddress = rawOrder.delivery_address ? String(rawOrder.delivery_address) : "";
        const deliveryLabel = rawOrder.delivery_address_label ? String(rawOrder.delivery_address_label) : "";

        return <article className={styles.card} key={order.id}>
          <div className={styles.row}>
            <div><p className={styles.eyebrow}>{order.order_number}</p><h2>{stageLabels[stage] ?? stage}</h2><p>Commande du {new Date(order.created_at).toLocaleDateString("fr-FR")}</p></div>
            <strong style={{ fontSize: "1.5rem" }}>{money(order.total)}</strong>
          </div>
          <div className={styles.progress}><span style={{ width: `${pct}%` }} /></div>
          <div className={styles.row} style={{ marginTop: 8 }}><span>{pct}%</span>{p?.estimatedReadyAt && <span>Disponibilité estimée : <strong>{new Date(p.estimatedReadyAt).toLocaleString("fr-FR")}</strong></span>}</div>

          {delivery && <div style={{ marginTop: 16, padding: 14, border: "1px solid rgba(212,175,55,.28)", borderRadius: 14, background: "rgba(212,175,55,.05)" }}>
            <p className={styles.eyebrow}>LIVRAISON NOSTRA MOTORS</p>
            <h3 style={{ margin: "5px 0 8px" }}>{deliveryLabels[deliveryStage] ?? deliveryStage}</h3>
            {deliveryDate && <p style={{ margin: "4px 0" }}>Créneau : <strong>{new Date(deliveryDate).toLocaleString("fr-FR")}{deliveryWindowEnd ? ` → ${new Date(deliveryWindowEnd).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</strong></p>}
            {deliveryLabel && <p style={{ margin: "4px 0" }}>Destination : <strong>{deliveryLabel}</strong>{deliveryAddress ? ` · ${deliveryAddress}` : ""}</p>}
            {deliveryDriver && <p style={{ margin: "4px 0" }}>Chauffeur assigné : <strong>{deliveryDriver}</strong></p>}
          </div>}

          {order.admin_note && <p><strong>Message Nostra Motors :</strong> {order.admin_note}</p>}
          <div className={styles.timeline}>{history.slice(-8).reverse().map((h) => <div className={styles.timelineItem} key={h.id}><span className={styles.timelineDot} /><div><strong>{stageLabels[h.stage] ?? h.stage} · {h.progressPercent}%</strong>{h.publicMessage && <p>{h.publicMessage}</p>}<small>{new Date(h.createdAt).toLocaleString("fr-FR")}</small></div></div>)}</div>
        </article>;
      })}
    </section>
  </>;
}
