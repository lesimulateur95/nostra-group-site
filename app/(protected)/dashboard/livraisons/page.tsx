import Link from "next/link";
import { redirect } from "next/navigation";
import {
  releaseTemporaryHoldAdminV161,
  saveDeliveryFleetV161,
  updateDeliveryChecklistV161,
  updateDeliveryPlanV161,
  updateLogisticsSettingsV161,
} from "@/app/actions/v161-logistics";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserRoleKeys } from "@/lib/auth/access";
import { getMotorDeliveries } from "@/lib/nostra-motors/v41-data";
import {
  getActiveVehicleHoldsAdminV161,
  getDeliveryAssignmentsV161,
  getDeliveryChecklistV161,
  getDeliveryFleetV161,
  getLogisticsSettingsV161,
  recommendFleetV161,
} from "@/lib/nostra-motors/v161-data";
import { calculateDeliveryTransportPlanV160, formatDeliveryTransportPlanV160 } from "@/lib/nostra-motors/delivery-v160";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/motors/v161-logistics.module.css";

type Props = {
  searchParams: Promise<{
    view?: "today" | "week" | "all";
    saved?: string;
    checklist?: string;
    fleet_saved?: string;
    settings_saved?: string;
    hold_released?: string;
    error?: string;
    open?: string;
  }>;
};

type OrderItem = Record<string, unknown> & {
  item_type?: unknown;
  name?: unknown;
  quantity?: unknown;
  unit_price?: unknown;
  delivery_address?: unknown;
  delivery_phone?: unknown;
};

function orderItems(order: Record<string, unknown>): OrderItem[] {
  const raw = order.items;
  if (Array.isArray(raw)) return raw.filter((item): item is OrderItem => Boolean(item) && typeof item === "object");
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item): item is OrderItem => Boolean(item) && typeof item === "object") : [];
    } catch { return []; }
  }
  return [];
}

function vehicleCount(order: Record<string, unknown>): number {
  return orderItems(order)
    .filter((item) => item.item_type === "delivery")
    .reduce((sum, item) => sum + Math.max(1, Number(item.quantity ?? 1) || 1), 0);
}

function deliveryFee(order: Record<string, unknown>): number {
  return orderItems(order)
    .filter((item) => item.item_type === "delivery")
    .reduce((sum, item) => sum + Math.max(1, Number(item.quantity ?? 1) || 1) * Math.max(0, Number(item.unit_price ?? 0) || 0), 0);
}

function deliveryItemText(order: Record<string, unknown>, key: "delivery_address" | "delivery_phone"): string {
  for (const item of orderItems(order)) {
    if (item.item_type !== "delivery") continue;
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function text(order: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = order[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return "—";
}

function money(value: number): string {
  return Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function dateTimeLocalValue(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function stageLabel(stage: unknown): string {
  const labels: Record<string, string> = {
    awaiting_planning: "À planifier",
    planned: "Planifiée",
    preparing: "Véhicules en préparation",
    loading: "Chargement en cours",
    departed: "Départ de Nostra Motors",
    in_transit: "En livraison",
    delivered: "Livrée",
    closed: "Clôturée",
    cancelled: "Annulée",
    not_planned: "À planifier",
    in_progress: "En livraison",
  };
  return labels[String(stage ?? "awaiting_planning")] ?? "À planifier";
}

function orderStage(order: Record<string, unknown>): string {
  const explicit = String(order.delivery_stage ?? "").trim();
  if (explicit) return explicit;
  const legacy = String(order.delivery_status ?? "not_planned");
  if (legacy === "planned") return "planned";
  if (legacy === "in_progress") return "in_transit";
  if (legacy === "delivered") return "delivered";
  if (legacy === "cancelled") return "cancelled";
  return "awaiting_planning";
}

function withinView(order: Record<string, unknown>, view: "today" | "week" | "all"): boolean {
  if (view === "all") return true;
  const raw = order.delivery_date;
  if (!raw) return view === "week" && orderStage(order) === "awaiting_planning";
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday.getTime() + 24 * 60 * 60 * 1000);
  if (view === "today") return date >= startToday && date < endToday;
  const weekEnd = new Date(startToday.getTime() + 7 * 24 * 60 * 60 * 1000);
  return date >= startToday && date < weekEnd;
}

export default async function DashboardDeliveriesPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const roles = await getUserRoleKeys(data.user);
  if (!roles.some((role) => ["manager", "employee", "commercial"].includes(role))) redirect("/accueil");

  const params = await searchParams;
  const view = params.view ?? "week";
  const [deliveries, fleet, settings, activeHolds] = await Promise.all([
    getMotorDeliveries(),
    getDeliveryFleetV161(),
    getLogisticsSettingsV161(),
    getActiveVehicleHoldsAdminV161(),
  ]);
  const orderIds = deliveries.map((order) => Number(order.id)).filter((id) => Number.isFinite(id) && id > 0);
  const [assignments, checklist] = await Promise.all([
    getDeliveryAssignmentsV161(orderIds),
    getDeliveryChecklistV161(orderIds),
  ]);
  const assignmentMap = new Map<number, typeof assignments>();
  for (const assignment of assignments) {
    const current = assignmentMap.get(assignment.order_id) ?? [];
    current.push(assignment);
    assignmentMap.set(assignment.order_id, current);
  }
  const checklistMap = new Map<number, typeof checklist>();
  for (const line of checklist) {
    const current = checklistMap.get(line.order_id) ?? [];
    current.push(line);
    checklistMap.set(line.order_id, current);
  }
  const fleetById = new Map(fleet.map((item) => [item.id, item]));
  const visibleDeliveries = deliveries.filter((order) => withinView(order, view));
  const todayCount = deliveries.filter((order) => withinView(order, "today") && !["delivered", "closed", "cancelled"].includes(orderStage(order))).length;
  const waitingCount = deliveries.filter((order) => orderStage(order) === "awaiting_planning").length;
  const activeCount = deliveries.filter((order) => ["preparing", "loading", "departed", "in_transit"].includes(orderStage(order))).length;
  const availableCapacity = fleet.filter((item) => item.enabled && item.status === "available").reduce((sum, item) => sum + item.capacity, 0);

  const errorMessage = params.error === "capacity"
    ? "Capacité insuffisante : ajoute un autre transporteur ou choisis une flotte plus grande."
    : params.error === "conflict"
      ? "Conflit de planning : au moins un transporteur sélectionné est déjà affecté sur ce créneau."
      : params.error === "fleet"
        ? "Sélectionne au moins un transporteur avant de planifier la livraison."
        : params.error === "date"
          ? "Le créneau de livraison est invalide."
          : params.error === "settings"
            ? "Les paramètres de réservation temporaire sont invalides."
            : params.error
              ? "La modification n’a pas pu être enregistrée."
              : null;

  return (
    <DashboardShell>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>NOSTRA MOTORS · V161</span>
            <h1>Centre logistique</h1>
            <p>Planifie les livraisons, affecte réellement le plateau / semi / porte-véhicules, évite les conflits et suis la préparation jusqu’à la remise au client.</p>
          </div>
          <Link className={styles.secondaryButton} href="/dashboard/commandes">Voir les commandes</Link>
        </section>

        {(params.saved || params.checklist || params.fleet_saved || params.settings_saved || params.hold_released) && (
          <div className="dashboard-feedback dashboard-feedback-success">Modification enregistrée.</div>
        )}
        {errorMessage && <div className="dashboard-feedback dashboard-feedback-error">{errorMessage}</div>}

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}><span>À planifier</span><strong>{waitingCount}</strong></article>
          <article className={styles.summaryCard}><span>Livraisons aujourd’hui</span><strong>{todayCount}</strong></article>
          <article className={styles.summaryCard}><span>En préparation / route</span><strong>{activeCount}</strong></article>
          <article className={styles.summaryCard}><span>Capacité flotte disponible</span><strong>{availableCapacity} VL</strong></article>
        </section>

        <section className={styles.section} id="flotte">
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.eyebrow}>FLOTTE NOSTRA</span>
              <h2>Transporteurs disponibles</h2>
              <p>Chaque ligne représente un vrai moyen de transport. Une flotte déjà utilisée sur un créneau ne peut pas être affectée deux fois.</p>
            </div>
          </div>
          <div className={styles.fleetGrid}>
            {fleet.map((item) => (
              <article className={styles.fleetCard} key={item.id}>
                <div className={styles.fleetHead}>
                  <div><strong>{item.name}</strong><small>Capacité : {item.capacity} véhicule{item.capacity > 1 ? "s" : ""}</small></div>
                  <span className={styles.fleetBadge}>{item.fleet_type}</span>
                </div>
                <span className={item.enabled && item.status === "available" ? styles.statusOk : styles.statusBad}>
                  {item.enabled ? (item.status === "available" ? "● Disponible" : item.status === "maintenance" ? "● Maintenance" : "● Inactif") : "● Désactivé"}
                </span>
                <form action={saveDeliveryFleetV161} className={styles.compactForm}>
                  <input type="hidden" name="id" value={item.id} />
                  <input name="name" defaultValue={item.name} aria-label="Nom" />
                  <input name="capacity" type="number" min={1} max={50} defaultValue={item.capacity} aria-label="Capacité" />
                  <select name="status" defaultValue={item.status} aria-label="État">
                    <option value="available">Disponible</option><option value="maintenance">Maintenance</option><option value="inactive">Inactif</option>
                  </select>
                  <input type="hidden" name="fleet_type" value={item.fleet_type} />
                  <input type="hidden" name="display_order" value={item.display_order} />
                  <input type="hidden" name="enabled" value={item.enabled ? "1" : "0"} />
                  <button className={styles.secondaryButton} type="submit">Enregistrer</button>
                </form>
              </article>
            ))}
          </div>
          <form action={saveDeliveryFleetV161} className={styles.compactForm} style={{ marginTop: 12 }}>
            <input name="name" placeholder="Nouveau porte-véhicules" required />
            <input name="capacity" type="number" min={1} max={50} defaultValue={1} aria-label="Capacité" />
            <select name="fleet_type" defaultValue="custom"><option value="plateau">Plateau</option><option value="semi">Semi</option><option value="carrier">Porte-véhicules</option><option value="custom">Autre</option></select>
            <input type="hidden" name="enabled" value="1" /><input type="hidden" name="status" value="available" /><input type="hidden" name="display_order" value="100" />
            <button className={styles.primaryButton} type="submit">+ Ajouter à la flotte</button>
          </form>
        </section>

        <section className={styles.section} id="settings">
          <div className={styles.sectionHead}>
            <div><span className={styles.eyebrow}>RÉSERVATION TEMPORAIRE</span><h2>Protection du stock dans le panier</h2><p>Le compteur démarre quand un citoyen envoie sa sélection vers le panier.</p></div>
          </div>
          <form action={updateLogisticsSettingsV161}>
            <div className={styles.settingsGrid}>
              <label><span>Durée du blocage (minutes)</span><input name="hold_minutes" type="number" min={5} max={120} defaultValue={settings.holdMinutes} /></label>
              <label><span>Maximum de VL bloqués par citoyen</span><input name="max_hold_vehicles" type="number" min={1} max={50} defaultValue={settings.maxHoldVehicles} /></label>
              <label><span>Durée de créneau par défaut</span><input name="default_slot_minutes" type="number" min={15} max={480} defaultValue={settings.defaultSlotMinutes} /></label>
            </div>
            <div className={styles.actions}><button className={styles.primaryButton} type="submit">Enregistrer les paramètres</button></div>
          </form>
        </section>

        <section className={styles.section} id="holds">
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.eyebrow}>STOCK TEMPORAIREMENT BLOQUÉ</span>
              <h2>Réservations panier en cours</h2>
              <p>Ces véhicules sont protégés jusqu’à l’expiration du compteur ou jusqu’au paiement. Le staff peut libérer un blocage si nécessaire.</p>
            </div>
            <span className={styles.stageBadge}>{activeHolds.length} actif{activeHolds.length > 1 ? "s" : ""}</span>
          </div>
          <div className={styles.deliveryList}>
            {activeHolds.length === 0 && <div className={styles.empty}>Aucune réservation temporaire en cours.</div>}
            {activeHolds.map((hold) => (
              <div className={styles.checklistRow} key={hold.id}>
                <strong>{hold.vehicle_name}{hold.quantity > 1 ? ` × ${hold.quantity}` : ""}</strong>
                <span>{hold.customer_name}</span>
                <span>Expire à {new Date(hold.expires_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                <form action={releaseTemporaryHoldAdminV161}>
                  <input type="hidden" name="hold_id" value={hold.id} />
                  <button className={styles.dangerButton} type="submit">Libérer</button>
                </form>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.toolbar}>
            <div>
              <span className={styles.eyebrow}>PLANNING LIVRAISONS</span>
              <h2>{visibleDeliveries.length} livraison{visibleDeliveries.length > 1 ? "s" : ""} affichée{visibleDeliveries.length > 1 ? "s" : ""}</h2>
            </div>
            <nav className={styles.tabs}>
              <Link className={view === "today" ? styles.activeTab : styles.tab} href="/dashboard/livraisons?view=today">Aujourd’hui</Link>
              <Link className={view === "week" ? styles.activeTab : styles.tab} href="/dashboard/livraisons?view=week">7 jours</Link>
              <Link className={view === "all" ? styles.activeTab : styles.tab} href="/dashboard/livraisons?view=all">Toutes</Link>
            </nav>
          </div>

          <div className={styles.deliveryList} style={{ marginTop: 14 }}>
            {visibleDeliveries.length === 0 && <div className={styles.empty}>Aucune livraison dans cette vue.</div>}
            {visibleDeliveries.map((order) => {
              const orderId = Number(order.id);
              const count = vehicleCount(order);
              const stage = orderStage(order);
              const orderAssignments = assignmentMap.get(orderId) ?? [];
              const assignedIds = orderAssignments.map((assignment) => assignment.fleet_id);
              const recommendation = recommendFleetV161(fleet, count);
              const defaultFleetIds = assignedIds.length > 0 ? assignedIds : recommendation.map((item) => item.id);
              const recommendationText = recommendation.length > 0
                ? recommendation.map((item) => `${item.name} (${item.capacity})`).join(" + ")
                : count > 0
                  ? `Flotte disponible insuffisante (${formatDeliveryTransportPlanV160(calculateDeliveryTransportPlanV160(count))} théorique)`
                  : "Aucun transport nécessaire";
              const address = text(order, "delivery_address") !== "—" ? text(order, "delivery_address") : deliveryItemText(order, "delivery_address") || "Adresse non renseignée";
              const phone = text(order, "delivery_phone") !== "—" ? text(order, "delivery_phone") : deliveryItemText(order, "delivery_phone") || "Téléphone non renseigné";
              const lines = checklistMap.get(orderId) ?? [];
              const open = String(params.open ?? "") === String(orderId) || ["preparing", "loading", "departed", "in_transit"].includes(stage);

              return (
                <details className={styles.deliveryCard} key={orderId} open={open}>
                  <summary className={styles.deliverySummary}>
                    <div>
                      <span className={styles.eyebrow}>COMMANDE {text(order, "order_number", "reference", "id")}</span>
                      <h3>{text(order, "customer_name", "client_name", "full_name")}</h3>
                      <p>{count} véhicule{count > 1 ? "s" : ""} · {money(deliveryFee(order))} de livraison</p>
                    </div>
                    <div className={styles.deliveryMeta}>
                      <span className={styles.metaPill}>📍 {text(order, "delivery_address_label") !== "—" ? text(order, "delivery_address_label") : address}</span>
                      {order.delivery_date && <span className={styles.metaPill}>🗓 {new Date(String(order.delivery_date)).toLocaleString("fr-FR")}</span>}
                      {orderAssignments.map((assignment) => <span className={styles.metaPill} key={assignment.id}>🚛 {fleetById.get(assignment.fleet_id)?.name ?? `Flotte #${assignment.fleet_id}`}</span>)}
                    </div>
                    <span className={styles.stageBadge}>{stageLabel(stage)}</span>
                  </summary>

                  <div className={styles.deliveryBody}>
                    <div className={styles.deliveryInfoGrid}>
                      <div className={styles.infoCard}><span>Adresse</span><strong>{address}</strong></div>
                      <div className={styles.infoCard}><span>Téléphone</span><strong>{phone}</strong></div>
                      <div className={styles.infoCard}><span>Transport recommandé</span><strong>{recommendationText}</strong></div>
                      <div className={styles.infoCard}><span>Consignes client</span><strong>{text(order, "delivery_instructions")}</strong></div>
                    </div>

                    <form action={updateDeliveryPlanV161} className={styles.planForm}>
                      <input type="hidden" name="order_id" value={orderId} />
                      <label className={styles.field}><span>Étape</span><select name="delivery_stage" defaultValue={stage}><option value="awaiting_planning">À planifier</option><option value="planned">Livraison planifiée</option><option value="preparing">Véhicules en préparation</option><option value="loading">Chargement en cours</option><option value="departed">Départ de Nostra Motors</option><option value="in_transit">En livraison</option><option value="delivered">Livré</option><option value="closed">Livraison clôturée</option><option value="cancelled">Annulée</option></select></label>
                      <label className={styles.field}><span>Chauffeur assigné</span><input name="delivery_driver" defaultValue={String(order.delivery_driver ?? "")} placeholder="Nom du chauffeur" /></label>
                      <label className={styles.field}><span>Début du créneau</span><input type="datetime-local" name="delivery_start" defaultValue={dateTimeLocalValue(order.delivery_date)} /></label>
                      <label className={styles.field}><span>Fin du créneau <small>(vide = + {settings.defaultSlotMinutes} min)</small></span><input type="datetime-local" name="delivery_end" defaultValue={dateTimeLocalValue(order.delivery_window_end)} /></label>
                      <div className={`${styles.field} ${styles.fieldFull}`}>
                        <span>Transporteurs affectés · capacité requise {count} VL</span>
                        <div className={styles.fleetChoices}>
                          {fleet.map((item) => {
                            const disabled = !item.enabled || item.status !== "available";
                            return <label className={`${styles.fleetChoice} ${disabled ? styles.fleetChoiceDisabled : ""}`} key={item.id}><input type="checkbox" name="fleet_ids" value={item.id} defaultChecked={defaultFleetIds.includes(item.id)} disabled={disabled} /><span><strong>{item.name}</strong><small>{item.capacity} place{item.capacity > 1 ? "s" : ""}</small></span></label>;
                          })}
                        </div>
                        <div className={styles.recommendation}>Suggestion automatique : <strong>{recommendationText}</strong>. Le site refusera l’enregistrement s’il y a un conflit horaire ou une capacité insuffisante.</div>
                      </div>
                      <label className={`${styles.field} ${styles.fieldFull}`}><span>Notes internes</span><textarea name="delivery_notes" rows={2} defaultValue={String(order.delivery_notes ?? "")} placeholder="Chargement, accès, consignes internes…" /></label>
                      <div className={`${styles.actions} ${styles.fieldFull}`}><button className={styles.primaryButton} type="submit">Enregistrer le planning</button></div>
                    </form>

                    <div className={styles.checklist}>
                      <div><span className={styles.eyebrow}>PRÉPARATION / CHARGEMENT</span></div>
                      {lines.map((line) => (
                        <form action={updateDeliveryChecklistV161} className={styles.checklistRow} key={line.id}>
                          <input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="vehicle_id" value={line.vehicle_id} />
                          <strong>{line.vehicle_name} {line.quantity > 1 ? `× ${line.quantity}` : ""}</strong>
                          <label>Préparés<input name="prepared_quantity" type="number" min={0} max={line.quantity} defaultValue={line.prepared_quantity} /></label>
                          <label>Chargés<input name="loaded_quantity" type="number" min={0} max={line.quantity} defaultValue={line.loaded_quantity} /></label>
                          <button className={styles.secondaryButton} type="submit">Mettre à jour</button>
                        </form>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      </main>
    </DashboardShell>
  );
}
