import { createClient } from "@/lib/supabase/server";

type AccessOptions = {
  managerAccess: boolean;
  ordersAccess: boolean;
};

type Row = Record<string, unknown>;

type DashboardOverview = {
  configured: boolean;
  ordersConfigured: boolean;
  teamRegistrationsConfigured: boolean;
  wheelConfigured: boolean;
  tombolaConfigured: boolean;
  bingoConfigured: boolean;
  dealConfigured: boolean;
  teamMailConfigured: boolean;
  motorsV41Configured: boolean;
  circuitLabel: string;
  motorsLabel: string;
  motorsStatusConfigured: boolean;
  catalogVehicles: number;
  pendingOrders: number;
  pendingDeliveries: number;
  pendingAppointments: number;
  pendingTeamRegistrations: number;
  pendingHomologations: number;
  pendingReservations: number;
  lowStock: number;
  currentBalance: number;
  generalEvents: number;
  unusedWheelGains: number;
  tombolaTickets: number;
  bingoCards: number;
  activeDealSessions: number;
  dealEditionOpen: boolean;
  unreadTeamMail: number;
};

const EMPTY_OVERVIEW: DashboardOverview = {
  configured: false,
  ordersConfigured: false,
  teamRegistrationsConfigured: false,
  wheelConfigured: false,
  tombolaConfigured: false,
  bingoConfigured: false,
  dealConfigured: false,
  teamMailConfigured: false,
  motorsV41Configured: false,
  circuitLabel: "À configurer",
  motorsLabel: "À configurer",
  motorsStatusConfigured: false,
  catalogVehicles: 0,
  pendingOrders: 0,
  pendingDeliveries: 0,
  pendingAppointments: 0,
  pendingTeamRegistrations: 0,
  pendingHomologations: 0,
  pendingReservations: 0,
  lowStock: 0,
  currentBalance: 0,
  generalEvents: 0,
  unusedWheelGains: 0,
  tombolaTickets: 0,
  bingoCards: 0,
  activeDealSessions: 0,
  dealEditionOpen: false,
  unreadTeamMail: 0,
};

function countOf(result: { count?: number | null }): number {
  return Math.max(0, Number(result.count ?? 0) || 0);
}

function firstNumber(value: unknown): number {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "number") return Number.isFinite(first) ? first : 0;
  if (first && typeof first === "object") {
    const numberValue = Object.values(first as Row).find(
      (entry) => typeof entry === "number" || typeof entry === "string",
    );
    return Number(numberValue ?? 0) || 0;
  }
  return Number(first ?? 0) || 0;
}

function normalizedItems(value: unknown): Row[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Row => Boolean(item) && typeof item === "object",
    );
  }
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is Row => Boolean(item) && typeof item === "object",
        )
      : [];
  } catch {
    return [];
  }
}

function isDeliveryOrder(row: Row): boolean {
  return normalizedItems(row.items).some(
    (item) => String(item.item_type ?? "") === "delivery",
  );
}

export async function getDashboardOverview({
  managerAccess,
  ordersAccess,
}: AccessOptions): Promise<DashboardOverview> {
  try {
    const supabase = await createClient();
    const client = supabase as any;

    const ordersPendingPromise = ordersAccess
      ? client
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: 0, error: null });

    const pendingDeliveriesPromise = ordersAccess
      ? client
          .from("orders")
          .select("items,delivery_status")
          .in("delivery_status", ["not_planned", "planned", "in_progress"])
      : Promise.resolve({ data: [], error: null });

    const appointmentsPromise = ordersAccess
      ? client
          .from("motors_appointments")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: 0, error: null });

    const unreadMailPromise = ordersAccess
      ? client.rpc("nostra_get_unread_team_mail_count")
      : Promise.resolve({ data: 0, error: null });

    const circuitSettingPromise = managerAccess
      ? client
          .from("circuit_settings")
          .select("label")
          .eq("id", 1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const motorsSettingPromise = managerAccess
      ? client
          .from("motors_settings")
          .select("label")
          .eq("id", 1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const catalogPromise = managerAccess
      ? client
          .from("catalog_vehicles")
          .select("id", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null });

    const stockPromise = managerAccess
      ? client
          .from("inventory_items")
          .select("quantity,minimum_quantity")
          .limit(2000)
      : Promise.resolve({ data: [], error: null });

    const accountingPromise = managerAccess
      ? client
          .from("accounting_entries")
          .select("entry_type,amount")
          .order("entry_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null });

    const eventsPromise = managerAccess
      ? client
          .from("events")
          .select("id", { count: "exact", head: true })
          .or("championship.is.null,championship.eq.general")
      : Promise.resolve({ count: 0, error: null });

    const homologationsPromise = managerAccess
      ? client
          .from("homologation_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "reviewing"])
      : Promise.resolve({ count: 0, error: null });

    const reservationsPromise = managerAccess
      ? client
          .from("circuit_reservation_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: 0, error: null });

    const teamRegistrationsPromise = managerAccess
      ? client
          .from("team_registration_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "reviewing"])
      : Promise.resolve({ count: 0, error: null });

    const wheelPromise = managerAccess
      ? client
          .from("game_wheel_spins")
          .select("id", { count: "exact", head: true })
          .eq("redemption_status", "unused")
          .is("deleted_at", null)
      : Promise.resolve({ count: 0, error: null });

    const tombolaRoundPromise = managerAccess
      ? client
          .from("tombola_rounds")
          .select("id")
          .is("archived_at", null)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const bingoRoundPromise = managerAccess
      ? client
          .from("bingo_rounds")
          .select("id")
          .is("archived_at", null)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const dealPromise = managerAccess
      ? client.rpc("nostra_get_deal_dashboard_state")
      : Promise.resolve({ data: null, error: null });

    const [
      ordersPending,
      deliveryOrders,
      appointments,
      unreadMail,
      circuitSetting,
      motorsSetting,
      catalog,
      stock,
      accounting,
      events,
      homologations,
      reservations,
      teamRegistrations,
      wheel,
      tombolaRound,
      bingoRound,
      deal,
    ] = await Promise.all([
      ordersPendingPromise,
      pendingDeliveriesPromise,
      appointmentsPromise,
      unreadMailPromise,
      circuitSettingPromise,
      motorsSettingPromise,
      catalogPromise,
      stockPromise,
      accountingPromise,
      eventsPromise,
      homologationsPromise,
      reservationsPromise,
      teamRegistrationsPromise,
      wheelPromise,
      tombolaRoundPromise,
      bingoRoundPromise,
      dealPromise,
    ]);

    const tombolaTicketsPromise =
      managerAccess && tombolaRound.data?.id
        ? client
            .from("tombola_tickets")
            .select("id", { count: "exact", head: true })
            .eq("round_id", tombolaRound.data.id)
        : Promise.resolve({ count: 0, error: null });

    const bingoCardsPromise =
      managerAccess && bingoRound.data?.id
        ? client
            .from("bingo_cards")
            .select("id", { count: "exact", head: true })
            .eq("round_id", bingoRound.data.id)
        : Promise.resolve({ count: 0, error: null });

    const [tombolaTickets, bingoCards] = await Promise.all([
      tombolaTicketsPromise,
      bingoCardsPromise,
    ]);

    const stockRows = (stock.data ?? []) as Row[];
    const accountingRows = (accounting.data ?? []) as Row[];
    const deliveryRows = (deliveryOrders.data ?? []) as Row[];
    const dealState = (deal.data ?? {}) as {
      edition?: unknown;
      sessions?: Array<{ status?: string }>;
    };

    const pendingDeliveries = deliveryRows.filter((row) => {
      const status = String(row.delivery_status ?? "not_planned");
      return (
        isDeliveryOrder(row) &&
        ["not_planned", "planned", "in_progress"].includes(status)
      );
    }).length;

    const lowStock = stockRows.filter(
      (item) =>
        Number(item.quantity ?? 0) <= Number(item.minimum_quantity ?? 0),
    ).length;

    const currentBalance = accountingRows.reduce((total, entry) => {
      const amount = Number(entry.amount ?? 0) || 0;
      return total + (entry.entry_type === "income" ? amount : -amount);
    }, 0);

    const activeDealSessions = (dealState.sessions ?? []).filter((session) =>
      ["choosing", "playing", "banker_call"].includes(
        String(session.status ?? ""),
      ),
    ).length;

    const configured = managerAccess
      ? !circuitSetting.error && !catalog.error && !reservations.error
      : true;

    return {
      ...EMPTY_OVERVIEW,
      configured,
      ordersConfigured: ordersAccess && !ordersPending.error,
      teamRegistrationsConfigured: managerAccess && !teamRegistrations.error,
      wheelConfigured: managerAccess && !wheel.error,
      tombolaConfigured: managerAccess && !tombolaRound.error,
      bingoConfigured: managerAccess && !bingoRound.error,
      dealConfigured: managerAccess && !deal.error,
      teamMailConfigured: ordersAccess && !unreadMail.error,
      motorsV41Configured:
        ordersAccess && !appointments.error && !deliveryOrders.error,
      circuitLabel:
        String(circuitSetting.data?.label ?? "À configurer") || "À configurer",
      motorsLabel:
        String(motorsSetting.data?.label ?? "À configurer") || "À configurer",
      motorsStatusConfigured: managerAccess && !motorsSetting.error,
      catalogVehicles: countOf(catalog),
      pendingOrders: countOf(ordersPending),
      pendingDeliveries,
      pendingAppointments: countOf(appointments),
      pendingTeamRegistrations: countOf(teamRegistrations),
      pendingHomologations: countOf(homologations),
      pendingReservations: countOf(reservations),
      lowStock,
      currentBalance,
      generalEvents: countOf(events),
      unusedWheelGains: countOf(wheel),
      tombolaTickets: countOf(tombolaTickets),
      bingoCards: countOf(bingoCards),
      activeDealSessions,
      dealEditionOpen: Boolean(dealState.edition),
      unreadTeamMail: firstNumber(unreadMail.data),
    };
  } catch (error) {
    console.error("[Dashboard] Impossible de charger le résumé léger", error);
    return EMPTY_OVERVIEW;
  }
}
