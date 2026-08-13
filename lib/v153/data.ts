import "server-only";

import { createClient } from "@/lib/supabase/server";
import { EDITABLE_PAGE_CONFIG } from "@/lib/content/site-content";

export type MaintenancePoleKey = "motors" | "circuit" | "cercle" | "academy" | "events";
export type MaintenancePole = {
  poleKey: MaintenancePoleKey;
  enabled: boolean;
  title: string;
  message: string;
  etaText: string | null;
  updatedAt: string;
};

export type PromoCodeV153 = {
  id: string;
  code: string;
  label: string;
  scope: "global" | "motors" | "ticketing" | "cercle";
  discountType: "percent" | "fixed";
  discountValue: number;
  minAmount: number;
  maxDiscount: number | null;
  maxUses: number | null;
  maxUsesPerUser: number;
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
  createdAt: string;
  uses: number;
};

export type OrderProgressV153 = {
  orderId: number;
  stage: string;
  progressPercent: number;
  paymentStatus: string;
  estimatedReadyAt: string | null;
  internalNote: string | null;
  updatedAt: string;
};

export type OrderProgressHistoryV153 = {
  id: number;
  orderId: number;
  stage: string;
  progressPercent: number;
  publicMessage: string | null;
  createdAt: string;
};

export type CrmCustomerV153 = {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  preferredContact: string;
  tags: string[];
  assignedCommercial: string | null;
  orders: number;
  spent: number;
  appointments: number;
  vehicles: number;
  lastOrderAt: string | null;
};

export type TeamProfileV153 = {
  teamRegistrationId: number;
  ownerUserId: string;
  logoUrl: string | null;
  slogan: string | null;
  description: string | null;
  primaryColor: string;
  secondaryColor: string;
  headquarters: string | null;
  principalDriver: string | null;
  secondDriver: string | null;
  reserveDriver: string | null;
  vehicleModel: string | null;
  achievements: string | null;
  sponsors: string | null;
  publicVisible: boolean;
  updatedAt: string;
};

export type CasinoTierV153 = {
  id: number;
  name: string;
  minWagered: number;
  icon: string;
  benefits: string;
  sortOrder: number;
  enabled: boolean;
};

export type TicketEventV153 = {
  id: string;
  pole: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string | null;
  ticketPrice: number;
  capacity: number | null;
  salesOpen: boolean;
  published: boolean;
  sold: number;
};

export type TicketOrderV153 = {
  id: string;
  eventId: string;
  eventTitle: string;
  startsAt: string;
  location: string;
  ticketNumber: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  total: number;
  status: string;
  qrCode: string;
  purchasedAt: string;
};

export type VehicleContractV153 = {
  id: string;
  orderId: number;
  userId: string;
  contractNumber: string;
  customerName: string;
  amount: number;
  vehicleSnapshot: Array<Record<string, unknown>>;
  signedAt: string;
  paidAt: string;
  status: string;
  verificationCode: string;
  createdAt: string;
};

function num(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function getMaintenancePoleV153(key: MaintenancePoleKey): Promise<MaintenancePole | null> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("nostra_pole_maintenance_v153")
    .select("pole_key,enabled,title,message,eta_text,updated_at")
    .eq("pole_key", key)
    .maybeSingle();
  if (error || !data) return null;
  return {
    poleKey: data.pole_key,
    enabled: data.enabled === true,
    title: str(data.title),
    message: str(data.message),
    etaText: data.eta_text ? str(data.eta_text) : null,
    updatedAt: str(data.updated_at),
  };
}

export async function getMaintenancePolesV153(): Promise<MaintenancePole[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("nostra_pole_maintenance_v153")
    .select("pole_key,enabled,title,message,eta_text,updated_at")
    .order("pole_key");
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    poleKey: row.pole_key,
    enabled: row.enabled === true,
    title: str(row.title),
    message: str(row.message),
    etaText: row.eta_text ? str(row.eta_text) : null,
    updatedAt: str(row.updated_at),
  }));
}

export async function getPromoCodesV153(): Promise<PromoCodeV153[]> {
  const supabase = await createClient();
  const [{ data, error }, { data: redemptions }] = await Promise.all([
    (supabase as any).from("nostra_promo_codes_v153").select("*").order("created_at", { ascending: false }),
    (supabase as any).from("nostra_promo_redemptions_v153").select("promo_id"),
  ]);
  if (error) return [];
  const counts = new Map<string, number>();
  for (const row of redemptions ?? []) counts.set(String(row.promo_id), (counts.get(String(row.promo_id)) ?? 0) + 1);
  return (data ?? []).map((row: any) => ({
    id: str(row.id), code: str(row.code), label: str(row.label), scope: row.scope,
    discountType: row.discount_type, discountValue: num(row.discount_value), minAmount: num(row.min_amount),
    maxDiscount: row.max_discount == null ? null : num(row.max_discount), maxUses: row.max_uses == null ? null : num(row.max_uses),
    maxUsesPerUser: num(row.max_uses_per_user, 1), startsAt: row.starts_at ? str(row.starts_at) : null,
    endsAt: row.ends_at ? str(row.ends_at) : null, enabled: row.enabled === true, createdAt: str(row.created_at), uses: counts.get(str(row.id)) ?? 0,
  }));
}

export async function getOrderProgressMapV153(orderIds: number[]) {
  const result = new Map<number, OrderProgressV153>();
  if (!orderIds.length) return result;
  const supabase = await createClient();
  const { data, error } = await (supabase as any).from("order_progress_v153").select("*").in("order_id", orderIds);
  if (error) return result;
  for (const row of data ?? []) result.set(num(row.order_id), {
    orderId: num(row.order_id), stage: str(row.stage), progressPercent: num(row.progress_percent), paymentStatus: str(row.payment_status),
    estimatedReadyAt: row.estimated_ready_at ? str(row.estimated_ready_at) : null, internalNote: row.internal_note ? str(row.internal_note) : null,
    updatedAt: str(row.updated_at),
  });
  return result;
}

export async function getOrderProgressHistoryV153(orderId: number): Promise<OrderProgressHistoryV153[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).from("order_progress_history_v153").select("*").eq("order_id", orderId).order("created_at");
  if (error) return [];
  return (data ?? []).map((row: any) => ({ id: num(row.id), orderId: num(row.order_id), stage: str(row.stage), progressPercent: num(row.progress_percent), publicMessage: row.public_message ? str(row.public_message) : null, createdAt: str(row.created_at) }));
}

export async function getCrmCustomersV153(query = ""): Promise<CrmCustomerV153[]> {
  const supabase = await createClient();
  const [profiles, orders, appointments, vehicles, crm, commercialProfiles] = await Promise.all([
    (supabase as any).from("member_profiles").select("user_id,rp_first_name,rp_last_name,email,discord_name").order("rp_last_name").limit(1000),
    (supabase as any).from("orders").select("user_id,total,created_at").neq("status", "cancelled").limit(5000),
    (supabase as any).from("motors_appointments").select("user_id").limit(5000),
    (supabase as any).from("customer_vehicles").select("user_id").neq("garage_status", "cancelled").limit(5000),
    (supabase as any).from("motors_crm_profiles_v153").select("*").limit(1000),
    (supabase as any).from("member_profiles").select("user_id,rp_first_name,rp_last_name").limit(1000),
  ]);
  if (profiles.error) return [];
  const crmMap = new Map((crm.data ?? []).map((r: any) => [String(r.user_id), r]));
  const commercialNames = new Map((commercialProfiles.data ?? []).map((r: any) => [String(r.user_id), `${r.rp_first_name ?? ""} ${r.rp_last_name ?? ""}`.trim()]));
  const orderAgg = new Map<string, { count: number; spent: number; last: string | null }>();
  for (const row of orders.data ?? []) {
    const key = String(row.user_id); const current = orderAgg.get(key) ?? { count: 0, spent: 0, last: null };
    current.count += 1; current.spent += num(row.total); if (!current.last || String(row.created_at) > current.last) current.last = String(row.created_at); orderAgg.set(key, current);
  }
  const appointmentCount = new Map<string, number>(); for (const row of appointments.data ?? []) appointmentCount.set(String(row.user_id), (appointmentCount.get(String(row.user_id)) ?? 0) + 1);
  const vehicleCount = new Map<string, number>(); for (const row of vehicles.data ?? []) vehicleCount.set(String(row.user_id), (vehicleCount.get(String(row.user_id)) ?? 0) + 1);
  const normalized = query.trim().toLowerCase();
  return (profiles.data ?? []).map((row: any) => {
    const userId = String(row.user_id); const meta = crmMap.get(userId) as any; const order = orderAgg.get(userId) ?? { count: 0, spent: 0, last: null };
    const name = `${row.rp_first_name ?? ""} ${row.rp_last_name ?? ""}`.trim() || str(row.discord_name, "Citoyen Nostra");
    return { userId, name, email: row.email ? str(row.email) : null, phone: null, status: str(meta?.customer_status, "standard"), preferredContact: str(meta?.preferred_contact, "mail"), tags: Array.isArray(meta?.tags) ? meta.tags.map(String) : [], assignedCommercial: meta?.assigned_commercial ? commercialNames.get(String(meta.assigned_commercial)) ?? "Commercial" : null, orders: order.count, spent: order.spent, appointments: appointmentCount.get(userId) ?? 0, vehicles: vehicleCount.get(userId) ?? 0, lastOrderAt: order.last };
  }).filter((customer: CrmCustomerV153) => !normalized || `${customer.name} ${customer.email ?? ""} ${customer.tags.join(" ")}`.toLowerCase().includes(normalized));
}

export async function getCrmNotesV153(userId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).from("motors_crm_notes_v153").select("id,category,note,created_at,created_by").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  return error ? [] : data ?? [];
}

export async function getTeamProfileV153(teamRegistrationId: number): Promise<TeamProfileV153 | null> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).from("nostra_team_profiles_v153").select("*").eq("team_registration_id", teamRegistrationId).maybeSingle();
  if (error || !data) return null;
  return { teamRegistrationId: num(data.team_registration_id), ownerUserId: str(data.owner_user_id), logoUrl: data.logo_url ? str(data.logo_url) : null, slogan: data.slogan ? str(data.slogan) : null, description: data.description ? str(data.description) : null, primaryColor: str(data.primary_color, "#111111"), secondaryColor: str(data.secondary_color, "#d6b25e"), headquarters: data.headquarters ? str(data.headquarters) : null, principalDriver: data.principal_driver ? str(data.principal_driver) : null, secondDriver: data.second_driver ? str(data.second_driver) : null, reserveDriver: data.reserve_driver ? str(data.reserve_driver) : null, vehicleModel: data.vehicle_model ? str(data.vehicle_model) : null, achievements: data.achievements ? str(data.achievements) : null, sponsors: data.sponsors ? str(data.sponsors) : null, publicVisible: data.public_visible !== false, updatedAt: str(data.updated_at) };
}

export async function getCasinoTiersV153(includeDisabled = false): Promise<CasinoTierV153[]> {
  const supabase = await createClient();
  let query = (supabase as any).from("casino_status_tiers_v153").select("*").order("min_wagered");
  if (!includeDisabled) query = query.eq("enabled", true);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map((row: any) => ({ id: num(row.id), name: str(row.name), minWagered: num(row.min_wagered), icon: str(row.icon, "◆"), benefits: str(row.benefits), sortOrder: num(row.sort_order), enabled: row.enabled !== false }));
}

export async function getCasinoTierForWageredV153(wagered: number): Promise<CasinoTierV153 | null> {
  const tiers = await getCasinoTiersV153();
  return [...tiers].reverse().find((tier) => wagered >= tier.minWagered) ?? tiers[0] ?? null;
}

export async function getTicketEventsV153(includeHidden = false): Promise<TicketEventV153[]> {
  const supabase = await createClient();
  let query = (supabase as any).from("nostra_ticket_events_v153").select("*").order("starts_at");
  if (!includeHidden) query = query.eq("published", true);
  const [{ data, error }, orders] = await Promise.all([query, (supabase as any).from("nostra_ticket_orders_v153").select("ticket_event_id,quantity,status")]);
  if (error) return [];
  const sold = new Map<string, number>(); for (const row of orders.data ?? []) if (row.status !== "cancelled" && row.status !== "refunded") sold.set(String(row.ticket_event_id), (sold.get(String(row.ticket_event_id)) ?? 0) + num(row.quantity));
  return (data ?? []).map((row: any) => ({ id: str(row.id), pole: str(row.pole), title: str(row.title), description: str(row.description), location: str(row.location), startsAt: str(row.starts_at), endsAt: row.ends_at ? str(row.ends_at) : null, ticketPrice: num(row.ticket_price), capacity: row.capacity == null ? null : num(row.capacity), salesOpen: row.sales_open === true, published: row.published === true, sold: sold.get(str(row.id)) ?? 0 }));
}

export async function getMyTicketsV153(userId: string): Promise<TicketOrderV153[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).from("nostra_ticket_orders_v153").select("id,ticket_event_id,ticket_number,quantity,unit_price,discount_amount,total,status,qr_code,purchased_at,nostra_ticket_events_v153(title,starts_at,location)").eq("user_id", userId).order("purchased_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row: any) => { const event = row.nostra_ticket_events_v153 ?? {}; return { id: str(row.id), eventId: str(row.ticket_event_id), eventTitle: str(event.title, "Événement Nostra"), startsAt: str(event.starts_at), location: str(event.location), ticketNumber: str(row.ticket_number), quantity: num(row.quantity), unitPrice: num(row.unit_price), discountAmount: num(row.discount_amount), total: num(row.total), status: str(row.status), qrCode: str(row.qr_code), purchasedAt: str(row.purchased_at) }; });
}

export async function getVehicleContractV153(id: string, userId?: string): Promise<VehicleContractV153 | null> {
  const supabase = await createClient(); let query = (supabase as any).from("nostra_vehicle_contracts_v153").select("*").eq("id", id); if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.maybeSingle(); if (error || !data) return null;
  return { id: str(data.id), orderId: num(data.order_id), userId: str(data.user_id), contractNumber: str(data.contract_number), customerName: str(data.customer_name), amount: num(data.amount), vehicleSnapshot: Array.isArray(data.vehicle_snapshot) ? data.vehicle_snapshot : [], signedAt: str(data.signed_at), paidAt: str(data.paid_at), status: str(data.status), verificationCode: str(data.verification_code), createdAt: str(data.created_at) };
}

export async function getMyVehicleContractsV153(userId: string): Promise<VehicleContractV153[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).from("nostra_vehicle_contracts_v153").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row: any) => ({ id: str(row.id), orderId: num(row.order_id), userId: str(row.user_id), contractNumber: str(row.contract_number), customerName: str(row.customer_name), amount: num(row.amount), vehicleSnapshot: Array.isArray(row.vehicle_snapshot) ? row.vehicle_snapshot : [], signedAt: str(row.signed_at), paidAt: str(row.paid_at), status: str(row.status), verificationCode: str(row.verification_code), createdAt: str(row.created_at) }));
}

export async function getDirectionOverviewV153() {
  const supabase = await createClient();
  const [profiles, orders, activeOrders, appointments, tickets, ticketSales, promoUses, casinoWallets, teams, maintenance] = await Promise.all([
    (supabase as any).from("member_profiles").select("user_id", { count: "exact", head: true }),
    (supabase as any).from("orders").select("total,status,created_at").neq("status", "cancelled").limit(10000),
    (supabase as any).from("orders").select("id", { count: "exact", head: true }).not("status", "in", '(completed,cancelled)'),
    (supabase as any).from("motors_appointments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    (supabase as any).from("nostra_ticket_orders_v153").select("id", { count: "exact", head: true }).eq("status", "paid"),
    (supabase as any).from("nostra_ticket_orders_v153").select("total,status"),
    (supabase as any).from("nostra_promo_redemptions_v153").select("discount_amount"),
    (supabase as any).from("casino_wallets").select("balance,lifetime_wagered,lifetime_won"),
    (supabase as any).from("team_registration_requests").select("id", { count: "exact", head: true }).eq("status", "approved"),
    getMaintenancePolesV153(),
  ]);
  const orderRows = orders.data ?? []; const revenue = orderRows.reduce((sum: number, row: any) => sum + num(row.total), 0);
  const ticketRevenue = (ticketSales.data ?? []).filter((r: any) => r.status === "paid" || r.status === "used").reduce((s: number, r: any) => s + num(r.total), 0);
  const promoDiscount = (promoUses.data ?? []).reduce((s: number, r: any) => s + num(r.discount_amount), 0);
  const casinoBalance = (casinoWallets.data ?? []).reduce((s: number, r: any) => s + num(r.balance), 0);
  return { citizens: profiles.count ?? 0, orders: orderRows.length, activeOrders: activeOrders.count ?? 0, motorsRevenue: revenue, pendingAppointments: appointments.count ?? 0, ticketsSold: tickets.count ?? 0, ticketRevenue, promoDiscount, casinoBalance, approvedTeams: teams.count ?? 0, maintenanceActive: maintenance.filter((m) => m.enabled).length };
}

export type SearchResultV153 = { kind: string; title: string; subtitle: string; href: string; badge?: string };


function normalizeCitizenSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type CitizenStaticSearchEntry = {
  kind: string;
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
  badge?: string;
};

const CITIZEN_SITE_SEARCH_INDEX: CitizenStaticSearchEntry[] = [
  { kind:"Page", title:"Accueil Nostra Group", subtitle:"Portail principal", href:"/accueil", keywords:"accueil home groupe nostra" },
  { kind:"Page", title:"Aujourd’hui chez Nostra", subtitle:"Activité du jour", href:"/aujourdhui", keywords:"aujourd hui actualite programme evenement showroom" },
  { kind:"Page", title:"Actualités Nostra Group", subtitle:"Toutes les nouveautés", href:"/actualites", keywords:"actualites nouvelles news annonces nouveautes" },
  { kind:"Page", title:"Billetterie Nostra", subtitle:"Billets et événements", href:"/billetterie", keywords:"billetterie billet ticket evenement place reservation" },
  { kind:"Page", title:"Ventes privées Nostra", subtitle:"Accès fidélité & VIP", href:"/ventes-privees", keywords:"vente privee vip exclusif fidelite" },
  { kind:"Nostra Motors", title:"Nostra Motors", subtitle:"Concession automobile", href:"/motors", keywords:"motors concession automobile voiture vehicule" },
  { kind:"Nostra Motors", title:"Catalogue Nostra Motors", subtitle:"Tous les véhicules", href:"/motors/catalogue", keywords:"catalogue vehicule voiture acheter commander" },
  { kind:"Nostra Motors", title:"Catalogue location", subtitle:"Véhicules à louer", href:"/motors/catalogue/location", keywords:"location louer catalogue voiture vehicule" },
  { kind:"Nostra Motors", title:"Showroom Nostra Motors", subtitle:"Véhicules présents en concession", href:"/motors/showroom", keywords:"showroom exposition present concession stock" },
  { kind:"Nostra Motors", title:"Tarifs peinture", subtitle:"Peinture & personnalisation", href:"/motors/tarifs-peinture", keywords:"peinture couleur carrosserie tarif 24 48 heures" },
  { kind:"Nostra Motors", title:"Commander une plaque", subtitle:"Plaques d’immatriculation", href:"/motors/plaques", keywords:"plaque immatriculation installation commander" },
  { kind:"Nostra Motors", title:"Rendez-vous Nostra Motors", subtitle:"Prendre rendez-vous", href:"/motors/rendez-vous", keywords:"rendez vous rdv peinture plaque sav retrait commercial" },
  { kind:"Nostra Motors", title:"SAV & assistance", subtitle:"Service après-vente", href:"/motors/sav", keywords:"sav assistance panne probleme atelier" },
  { kind:"Nostra Motors", title:"Financement", subtitle:"Solutions de financement", href:"/motors/financement", keywords:"financement credit paiement mensualite" },
  { kind:"Nostra Motors", title:"Programme fidélité Motors", subtitle:"Niveaux & avantages", href:"/motors/fidelite", keywords:"fidelite avantages points niveau remise" },
  { kind:"Nostra Motors", title:"Reprise véhicule", subtitle:"Proposer son véhicule", href:"/motors/reprise", keywords:"reprise rachat vendre vehicule voiture" },
  { kind:"Nostra Motors", title:"Dépôt-vente", subtitle:"Confier un véhicule à Nostra Motors", href:"/motors/depot-vente", keywords:"depot vente vehicule occasion vendre" },
  { kind:"Nostra Motors", title:"Mandat de recherche", subtitle:"Recherche personnalisée de véhicule", href:"/motors/mandat-recherche", keywords:"mandat recherche trouver voiture vehicule" },
  { kind:"Nostra Circuit", title:"Nostra Circuit", subtitle:"Portail circuit", href:"/circuit", keywords:"circuit course piste racing championnat" },
  { kind:"Nostra Circuit", title:"Nostra Racing Academy", subtitle:"Formations & licences", href:"/circuit/racing-academy", keywords:"academy formation questionnaire licence pilote gt3 f1" },
  { kind:"Événements", title:"Événements & Jeux", subtitle:"Agenda, jeux et inscriptions", href:"/evenements", keywords:"evenement jeux inscription agenda money drop roue bingo tombola" },
  { kind:"Nostra Cercle", title:"Nostra Cercle", subtitle:"Casino Nostra Group", href:"/casino", keywords:"casino cercle jeux jetons table vip" },
  { kind:"Nostra Cercle", title:"La caisse Nostra Cercle", subtitle:"Acheter ou revendre des jetons", href:"/casino/caisse", keywords:"caisse jeton acheter revendre change casino" },
  { kind:"Profil", title:"Mon profil", subtitle:"Espace citoyen Nostra", href:"/profil", keywords:"profil compte citoyen espace nostra" },
  { kind:"Profil", title:"Mes commandes", subtitle:"Suivi des commandes", href:"/profil/commandes", keywords:"commande suivi avancement vehicule statut" },
  { kind:"Profil", title:"Mes locations", subtitle:"Locations Nostra Motors", href:"/profil/locations", keywords:"location louer contrat caution retour" },
  { kind:"Profil", title:"Wallet Nostra", subtitle:"Solde, points et mouvements", href:"/profil/wallet", keywords:"wallet portefeuille solde rp points remboursement transaction" },
  { kind:"Profil", title:"Mes favoris", subtitle:"Véhicules favoris & alertes", href:"/profil/favoris", keywords:"favoris alerte prix stock showroom vehicule" },
  { kind:"Profil", title:"Liste d’attente", subtitle:"Alertes disponibilité véhicules", href:"/profil/liste-attente", keywords:"liste attente disponible stock vehicule location" },
  { kind:"Profil", title:"Fidélité Nostra", subtitle:"Points, niveau et avantages", href:"/profil/fidelite", keywords:"fidelite points niveau avantages statut vip" },
  { kind:"Profil", title:"Parrainage", subtitle:"Code de parrainage citoyen", href:"/profil/parrainage", keywords:"parrainage parrainer code filleul recompense" },
  { kind:"Profil", title:"Messagerie Nostra", subtitle:"Messages avec les services Nostra", href:"/profil/messagerie", keywords:"messagerie message mail boite reception contact" },
  { kind:"Profil", title:"Notifications", subtitle:"Centre de notifications", href:"/profil/notifications", keywords:"notification alerte information commande formation evenement" },
  { kind:"Profil", title:"Mes contrats", subtitle:"Contrats de vente signés", href:"/profil/contrats", keywords:"contrat vente signature document" },
  { kind:"Profil", title:"Mes documents", subtitle:"Documents & factures", href:"/profil/documents", keywords:"document facture certificat pdf" },
  { kind:"Profil", title:"Mes licences & formations", subtitle:"Academy et licences officielles", href:"/profil/licences", keywords:"licence formation academy f1 gt3 circuit" },
  { kind:"Recrutement", title:"Recrutement Nostra Group", subtitle:"Candidatures", href:"/recrutement", keywords:"recrutement candidature emploi rejoindre nostra" },
];

export async function searchCitizenV153(query: string, userId: string): Promise<SearchResultV153[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const pattern = `%${q}%`;
  const normalizedQuery = normalizeCitizenSearch(q);
  const [vehicles, events, docs, orders, teams, tickets, mailInbox, mailSent, sitePages, customPages, news, banners] = await Promise.all([
    (supabase as any).from("catalog_vehicles").select("id,brand,model,price,catalog_type,description,power,top_speed").eq("published", true).or(`brand.ilike.${pattern},model.ilike.${pattern},description.ilike.${pattern},power.ilike.${pattern},top_speed.ilike.${pattern}`).limit(20),
    (supabase as any).from("events").select("id,title,description,location,starts_at").eq("status", "published").or(`title.ilike.${pattern},description.ilike.${pattern},location.ilike.${pattern}`).limit(14),
    (supabase as any).from("invoices").select("id,invoice_number,document_title,document_type").eq("user_id", userId).or(`invoice_number.ilike.${pattern},document_title.ilike.${pattern},document_type.ilike.${pattern}`).limit(12),
    (supabase as any).from("orders").select("id,order_number,status,total,customer_name").eq("user_id", userId).or(`order_number.ilike.${pattern},status.ilike.${pattern},customer_name.ilike.${pattern}`).limit(12),
    (supabase as any).from("team_registration_requests").select("id,team_name,registration_type,status").eq("user_id", userId).or(`team_name.ilike.${pattern},registration_type.ilike.${pattern},status.ilike.${pattern}`).limit(12),
    (supabase as any).from("nostra_ticket_events_v153").select("id,title,description,starts_at,location").eq("published", true).or(`title.ilike.${pattern},description.ilike.${pattern},location.ilike.${pattern}`).limit(12),
    (supabase as any).rpc("nostra_get_my_mail_messages", { p_folder: "inbox" }),
    (supabase as any).rpc("nostra_get_my_mail_messages", { p_folder: "sent" }),
    (supabase as any).from("site_pages").select("slug,title,content").or(`slug.ilike.${pattern},title.ilike.${pattern},content.ilike.${pattern}`).limit(30),
    (supabase as any).from("custom_circuit_pages").select("category_key,category_label,slug,label,title,content,visible").eq("visible", true).or(`category_label.ilike.${pattern},label.ilike.${pattern},title.ilike.${pattern},content.ilike.${pattern}`).limit(30),
    (supabase as any).from("nostra_news_v155").select("id,pole,title,excerpt,content").eq("published", true).or(`title.ilike.${pattern},excerpt.ilike.${pattern},content.ilike.${pattern},pole.ilike.${pattern}`).limit(20),
    (supabase as any).from("nostra_banners_v155").select("id,pole,title,message,cta_label,cta_url,active").eq("active", true).or(`title.ilike.${pattern},message.ilike.${pattern},cta_label.ilike.${pattern},pole.ilike.${pattern}`).limit(20),
  ]);

  const out: SearchResultV153[] = [];
  const seen = new Set<string>();
  const add = (result: SearchResultV153) => {
    const key = `${result.href}|${normalizeCitizenSearch(result.title)}`;
    if (!seen.has(key)) { seen.add(key); out.push(result); }
  };

  // Index permanent des principales pages du site : la recherche citoyen ne dépend
  // plus uniquement des données Supabase déjà créées.
  for (const entry of CITIZEN_SITE_SEARCH_INDEX) {
    const haystack = normalizeCitizenSearch(`${entry.title} ${entry.subtitle} ${entry.keywords}`);
    if (haystack.includes(normalizedQuery)) add({ kind: entry.kind, title: entry.title, subtitle: entry.subtitle, href: entry.href, badge: entry.badge });
  }

  for (const page of EDITABLE_PAGE_CONFIG) {
    const haystack = normalizeCitizenSearch(`${page.label} ${page.category} ${page.slug}`);
    if (haystack.includes(normalizedQuery)) add({ kind: "Page", title: page.label, subtitle: page.category, href: page.route });
  }

  for (const r of vehicles.data ?? []) add({ kind: "Véhicule", title: `${r.brand} ${r.model}`, subtitle: `${num(r.price).toLocaleString("fr-FR")} € · ${str(r.power)}`, href: `/motors/catalogue/${r.id}/commande`, badge: str(r.catalog_type) });
  for (const r of events.data ?? []) add({ kind: "Événement", title: str(r.title), subtitle: `${str(r.location)} · ${new Date(r.starts_at).toLocaleDateString("fr-FR")}`, href: "/evenements" });
  for (const r of docs.data ?? []) add({ kind: "Document", title: str(r.document_title, str(r.invoice_number)), subtitle: `${str(r.document_type)} · ${str(r.invoice_number)}`, href: `/profil/documents/${r.id}` });
  for (const r of orders.data ?? []) add({ kind: "Commande", title: str(r.order_number), subtitle: str(r.status), href: "/profil/commandes" });
  for (const r of teams.data ?? []) add({ kind: "Écurie", title: str(r.team_name), subtitle: str(r.registration_type).toUpperCase(), href: `/profil/ecuries/${r.id}` });
  for (const r of tickets.data ?? []) add({ kind: "Billetterie", title: str(r.title), subtitle: str(r.location), href: `/billetterie#${r.id}` });

  for (const r of sitePages.data ?? []) {
    const config = EDITABLE_PAGE_CONFIG.find((page) => page.slug === r.slug);
    if (config) add({ kind: "Contenu", title: str(r.title, config.label), subtitle: config.category, href: config.route });
  }

  for (const r of customPages.data ?? []) {
    const storedSlug = str(r.slug);
    const categoryKey = str(r.category_key);
    let href = `/circuit/personnalise/${storedSlug}`;
    if (categoryKey.startsWith("motors:")) href = `/motors/personnalise/${storedSlug.replace(/^motors-/, "")}`;
    else if (categoryKey.startsWith("evenements:")) href = `/evenements/personnalise/${storedSlug.replace(/^evenements-/, "")}`;
    add({ kind: "Contenu", title: str(r.title, str(r.label, "Page Nostra")), subtitle: str(r.category_label, "Page personnalisée"), href });
  }

  for (const r of news.data ?? []) add({ kind: "Actualité", title: str(r.title), subtitle: str(r.excerpt, `Actualité ${str(r.pole, "Nostra Group")}`), href: "/actualites" });
  for (const r of banners.data ?? []) add({ kind: "Annonce", title: str(r.title), subtitle: str(r.message), href: str(r.cta_url, "/accueil") || "/accueil" });

  const mailRows = [...(mailInbox.data ?? []), ...(mailSent.data ?? [])];
  const mailSeen = new Set<string>();
  for (const r of mailRows) {
    const haystack = normalizeCitizenSearch(`${r.subject ?? ""} ${r.body ?? ""} ${r.sender_name ?? ""} ${r.recipient_name ?? ""}`);
    const thread = str(r.thread_id);
    if (thread && haystack.includes(normalizedQuery) && !mailSeen.has(thread)) {
      mailSeen.add(thread);
      add({ kind: "Messagerie", title: str(r.subject, "Conversation Nostra"), subtitle: str(r.sender_name, str(r.recipient_name)), href: `/profil/messagerie?thread=${thread}` });
    }
  }
  return out.slice(0, 100);
}
export async function searchDashboardV153(query: string): Promise<SearchResultV153[]> {
  const q = query.trim(); if (q.length < 2) return [];
  const supabase = await createClient(); const pattern = `%${q}%`;
  const [profiles, vehicles, orders, appointments, teams, invoices, tickets, mailInbox, mailSent] = await Promise.all([
    (supabase as any).from("member_profiles").select("user_id,rp_first_name,rp_last_name,email,discord_name").or(`rp_first_name.ilike.${pattern},rp_last_name.ilike.${pattern},email.ilike.${pattern},discord_name.ilike.${pattern}`).limit(12),
    (supabase as any).from("catalog_vehicles").select("id,brand,model,catalog_type").or(`brand.ilike.${pattern},model.ilike.${pattern}`).limit(12),
    (supabase as any).from("orders").select("id,order_number,customer_name,status,total").or(`order_number.ilike.${pattern},customer_name.ilike.${pattern}`).limit(12),
    (supabase as any).from("motors_appointments").select("id,user_id,customer_name,vehicle_label,status").or(`customer_name.ilike.${pattern},vehicle_label.ilike.${pattern},message.ilike.${pattern}`).limit(10),
    (supabase as any).from("team_registration_requests").select("id,team_name,team_director,status").or(`team_name.ilike.${pattern},team_director.ilike.${pattern}`).limit(10),
    (supabase as any).from("invoices").select("id,user_id,invoice_number,document_title").or(`invoice_number.ilike.${pattern},document_title.ilike.${pattern}`).limit(10),
    (supabase as any).from("nostra_ticket_events_v153").select("id,title,location").or(`title.ilike.${pattern},location.ilike.${pattern}`).limit(10),
    (supabase as any).rpc("nostra_get_team_mail_messages", { p_folder: "inbox" }),
    (supabase as any).rpc("nostra_get_team_mail_messages", { p_folder: "sent" }),
  ]);
  const out: SearchResultV153[] = [];
  for (const r of profiles.data ?? []) { const name = `${r.rp_first_name ?? ""} ${r.rp_last_name ?? ""}`.trim() || str(r.discord_name, "Citoyen"); out.push({ kind: "Citoyen", title: name, subtitle: str(r.email), href: `/dashboard/citoyens/${r.user_id}` }); }
  for (const r of vehicles.data ?? []) out.push({ kind: "Catalogue", title: `${r.brand} ${r.model}`, subtitle: str(r.catalog_type), href: "/dashboard/catalogue" });
  for (const r of orders.data ?? []) out.push({ kind: "Commande", title: str(r.order_number), subtitle: `${str(r.customer_name)} · ${str(r.status)}`, href: "/dashboard/commandes" });
  for (const r of appointments.data ?? []) out.push({ kind: "Rendez-vous", title: str(r.customer_name), subtitle: `${str(r.vehicle_label)} · ${str(r.status)}`, href: "/dashboard/rendez-vous-motors" });
  for (const r of teams.data ?? []) out.push({ kind: "Écurie", title: str(r.team_name), subtitle: str(r.team_director), href: "/dashboard/inscriptions-ecuries" });
  for (const r of invoices.data ?? []) out.push({ kind: "Document", title: str(r.document_title, str(r.invoice_number)), subtitle: str(r.invoice_number), href: "/dashboard/documents-signes" });
  for (const r of tickets.data ?? []) out.push({ kind: "Billetterie", title: str(r.title), subtitle: str(r.location), href: "/dashboard/billetterie" });
  const teamMailRows = [...(mailInbox.data ?? []), ...(mailSent.data ?? [])];
  const teamMailSeen = new Set<string>();
  for (const r of teamMailRows) { const haystack = `${r.subject ?? ""} ${r.body ?? ""} ${r.sender_name ?? ""} ${r.recipient_name ?? ""}`.toLowerCase(); const thread = str(r.thread_id); if (thread && haystack.includes(q.toLowerCase()) && !teamMailSeen.has(thread)) { teamMailSeen.add(thread); out.push({ kind: "Messagerie", title: str(r.subject, "Conversation Nostra"), subtitle: `${str(r.sender_name)} → ${str(r.recipient_name)}`, href: `/dashboard/messagerie?thread=${thread}` }); } }
  return out.slice(0, 60);
}

export async function getBackupsV153() {
  const supabase = await createClient(); const { data, error } = await (supabase as any).from("nostra_backups_v153").select("id,name,scope,created_at,created_by").order("created_at", { ascending: false }).limit(50); return error ? [] : data ?? [];
}
