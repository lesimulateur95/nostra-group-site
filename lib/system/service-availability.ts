import { createClient } from "@/lib/supabase/server";

export const MASTER_SERVICE_KEY = "circuit_services_master" as const;

export const SERVICE_KEYS = [
  MASTER_SERVICE_KEY,
  "circuit_license_payments",
  "circuit_vehicle_homologations",
  "circuit_team_homologations",
  "circuit_team_creation",
] as const;

export type ServiceKey = (typeof SERVICE_KEYS)[number];

export type ServiceAvailability = {
  serviceKey: ServiceKey;
  label: string;
  isOpen: boolean;
  configuredOpen: boolean;
  closedByMaster: boolean;
  closedMessage: string;
  reopensAt: string | null;
  configuredClosedMessage: string;
  configuredReopensAt: string | null;
  publicPath: string;
  isMaster: boolean;
};

export type ServiceAvailabilityHistory = {
  id: number;
  serviceKey: ServiceKey;
  serviceLabel: string;
  changeType: "opened" | "closed" | "settings_updated";
  isOpen: boolean;
  closedMessage: string;
  reopensAt: string | null;
  changedAt: string;
  changedByName: string;
};

type ServiceDefinition = Pick<
  ServiceAvailability,
  "serviceKey" | "label" | "closedMessage" | "publicPath" | "isMaster"
>;

type ServiceRow = {
  service_key?: unknown;
  is_open?: unknown;
  closed_message?: unknown;
  reopens_at?: unknown;
};

export const SERVICE_DEFINITIONS: Record<ServiceKey, ServiceDefinition> = {
  circuit_services_master: {
    serviceKey: "circuit_services_master",
    label: "Fermeture générale Nostra Circuit",
    closedMessage:
      "Les inscriptions, paiements et demandes Nostra Circuit sont temporairement clôturés.",
    publicPath: "/circuit/administration-sportive",
    isMaster: true,
  },
  circuit_license_payments: {
    serviceKey: "circuit_license_payments",
    label: "Paiement des licences",
    closedMessage: "Le paiement des licences est actuellement clôturé.",
    publicPath: "/circuit/administration-sportive/payer-ma-licence",
    isMaster: false,
  },
  circuit_vehicle_homologations: {
    serviceKey: "circuit_vehicle_homologations",
    label: "Homologation des véhicules",
    closedMessage:
      "Les demandes d’homologation de véhicules sont actuellement clôturées.",
    publicPath: "/circuit/administration-sportive/homologation-vehicules",
    isMaster: false,
  },
  circuit_team_homologations: {
    serviceKey: "circuit_team_homologations",
    label: "Homologation des écuries",
    closedMessage:
      "Les demandes d’homologation d’écuries sont actuellement clôturées.",
    publicPath: "/circuit/administration-sportive/homologation-ecuries",
    isMaster: false,
  },
  circuit_team_creation: {
    serviceKey: "circuit_team_creation",
    label: "Création d’écurie",
    closedMessage: "Les créations d’écuries sont actuellement clôturées.",
    publicPath: "/circuit/administration-sportive/creation-ecurie",
    isMaster: false,
  },
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableDateValue(value: unknown): string | null {
  const raw = stringValue(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function rowFor(
  rows: Map<ServiceKey, ServiceRow>,
  serviceKey: ServiceKey,
): ServiceRow | undefined {
  return rows.get(serviceKey);
}

function configuredOpen(row: ServiceRow | undefined): boolean {
  return row?.is_open !== false;
}

function messageFor(
  row: ServiceRow | undefined,
  definition: ServiceDefinition,
): string {
  return stringValue(row?.closed_message) ?? definition.closedMessage;
}

function reopeningFor(row: ServiceRow | undefined): string | null {
  return nullableDateValue(row?.reopens_at);
}

export function isServiceKey(value: unknown): value is ServiceKey {
  return SERVICE_KEYS.includes(value as ServiceKey);
}

export async function getServiceAvailability(
  serviceKey: ServiceKey,
): Promise<ServiceAvailability> {
  const [service] = await getServiceAvailabilities([serviceKey]);
  return service;
}

export async function getServiceAvailabilities(
  serviceKeys: readonly ServiceKey[],
): Promise<ServiceAvailability[]> {
  const uniqueKeys = Array.from(
    new Set<ServiceKey>([MASTER_SERVICE_KEY, ...serviceKeys]),
  );

  const rows = new Map<ServiceKey, ServiceRow>();

  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("nostra_service_availability")
      .select("service_key,is_open,closed_message,reopens_at")
      .in("service_key", uniqueKeys);

    if (!error && Array.isArray(data)) {
      for (const rawRow of data as ServiceRow[]) {
        if (isServiceKey(rawRow.service_key)) {
          rows.set(rawRow.service_key, rawRow);
        }
      }
    }
  } catch {
    // Les valeurs par défaut gardent le site utilisable si la migration SQL
    // n'a pas encore été exécutée.
  }

  const masterDefinition = SERVICE_DEFINITIONS[MASTER_SERVICE_KEY];
  const masterRow = rowFor(rows, MASTER_SERVICE_KEY);
  const masterOpen = configuredOpen(masterRow);
  const masterMessage = messageFor(masterRow, masterDefinition);
  const masterReopensAt = reopeningFor(masterRow);

  return serviceKeys.map((serviceKey) => {
    const definition = SERVICE_DEFINITIONS[serviceKey];
    const row = rowFor(rows, serviceKey);
    const ownConfiguredOpen = configuredOpen(row);
    const closedByMaster = serviceKey !== MASTER_SERVICE_KEY && !masterOpen;

    return {
      ...definition,
      configuredOpen: ownConfiguredOpen,
      isOpen:
        serviceKey === MASTER_SERVICE_KEY
          ? ownConfiguredOpen
          : ownConfiguredOpen && masterOpen,
      closedByMaster,
      configuredClosedMessage: messageFor(row, definition),
      configuredReopensAt: reopeningFor(row),
      closedMessage: closedByMaster
        ? masterMessage
        : messageFor(row, definition),
      reopensAt: closedByMaster
        ? masterReopensAt
        : reopeningFor(row),
    };
  });
}

export async function canManageServiceAvailability(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return false;

    const { data, error } = await (supabase as any).rpc(
      "nostra_service_manager",
      { p_user_id: authData.user.id },
    );

    return !error && data === true;
  } catch {
    return false;
  }
}

export async function getServiceAvailabilityHistory(
  limit = 20,
): Promise<ServiceAvailabilityHistory[]> {
  try {
    const supabase = await createClient();
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const { data, error } = await (supabase as any)
      .from("nostra_service_availability_history")
      .select(
        "id,service_key,change_type,is_open,closed_message,reopens_at,changed_at,changed_by_name",
      )
      .order("changed_at", { ascending: false })
      .limit(safeLimit);

    if (error || !Array.isArray(data)) return [];

    return data.flatMap((row: Record<string, unknown>) => {
      if (!isServiceKey(row.service_key)) return [];

      const changeType = stringValue(row.change_type);
      if (
        changeType !== "opened" &&
        changeType !== "closed" &&
        changeType !== "settings_updated"
      ) {
        return [];
      }

      const id = Number(row.id);
      const changedAt = nullableDateValue(row.changed_at);
      if (!Number.isFinite(id) || !changedAt) return [];

      const definition = SERVICE_DEFINITIONS[row.service_key];

      return [
        {
          id,
          serviceKey: row.service_key,
          serviceLabel: definition.label,
          changeType,
          isOpen: row.is_open !== false,
          closedMessage:
            stringValue(row.closed_message) ?? definition.closedMessage,
          reopensAt: nullableDateValue(row.reopens_at),
          changedAt,
          changedByName: stringValue(row.changed_by_name) ?? "Direction Nostra",
        },
      ];
    });
  } catch {
    return [];
  }
}
