import { createClient } from "@/lib/supabase/server";

export const SERVICE_KEYS = [
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
  closedMessage: string;
  publicPath: string;
};

type ServiceDefinition = Omit<ServiceAvailability, "isOpen">;

export const SERVICE_DEFINITIONS: Record<ServiceKey, ServiceDefinition> = {
  circuit_license_payments: {
    serviceKey: "circuit_license_payments",
    label: "Paiement des licences",
    closedMessage: "Le paiement des licences est actuellement clôturé.",
    publicPath: "/circuit/administration-sportive/payer-ma-licence",
  },
  circuit_vehicle_homologations: {
    serviceKey: "circuit_vehicle_homologations",
    label: "Homologation des véhicules",
    closedMessage:
      "Les demandes d’homologation de véhicules sont actuellement clôturées.",
    publicPath: "/circuit/administration-sportive/homologation-vehicules",
  },
  circuit_team_homologations: {
    serviceKey: "circuit_team_homologations",
    label: "Homologation des écuries",
    closedMessage:
      "Les demandes d’homologation d’écuries sont actuellement clôturées.",
    publicPath: "/circuit/administration-sportive/homologation-ecuries",
  },
  circuit_team_creation: {
    serviceKey: "circuit_team_creation",
    label: "Création d’écurie",
    closedMessage: "Les créations d’écuries sont actuellement clôturées.",
    publicPath: "/circuit/administration-sportive/creation-ecurie",
  },
};

export function isServiceKey(value: unknown): value is ServiceKey {
  return SERVICE_KEYS.includes(value as ServiceKey);
}

export async function getServiceAvailability(
  serviceKey: ServiceKey,
): Promise<ServiceAvailability> {
  const definition = SERVICE_DEFINITIONS[serviceKey];
  const fallback: ServiceAvailability = {
    ...definition,
    isOpen: true,
  };

  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("nostra_service_availability")
      .select("service_key,is_open,closed_message")
      .eq("service_key", serviceKey)
      .maybeSingle();

    if (error || !data) return fallback;

    return {
      ...definition,
      isOpen: data.is_open !== false,
      closedMessage:
        typeof data.closed_message === "string" && data.closed_message.trim()
          ? data.closed_message.trim()
          : definition.closedMessage,
    };
  } catch {
    return fallback;
  }
}

export async function getServiceAvailabilities(
  serviceKeys: readonly ServiceKey[],
): Promise<ServiceAvailability[]> {
  return Promise.all(serviceKeys.map(getServiceAvailability));
}
