import { createClient } from "@/lib/supabase/server";

export type LoyaltyTier = {
  code: string;
  label: string;
  catalog_discount_percent: number;
  plate_discount_percent: number;
  benefits: string[];
  sort_order?: number;
};

export type LoyaltyState = {
  configured: boolean;
  tier: LoyaltyTier | null;
  preferences: {
    apply_catalog_discount: boolean;
    apply_plate_discount: boolean;
  };
  catalog_cart: {
    vehicle_subtotal: number;
    delivery_subtotal: number;
    discounted_vehicle_subtotal: number;
    discount_percent: number;
  };
  plate_settings: {
    base_price: number;
    active: boolean;
  };
  plate_cart: {
    plate_text: string;
    vehicle_label: string;
    notes: string | null;
    base_price: number;
  } | null;
};

export type LoyaltyAdminCitizen = {
  user_id: string;
  name: string;
  email: string | null;
  role: string | null;
  roles: string[] | null;
  tier_code: string | null;
  tier_label: string | null;
  assigned_at: string | null;
};

export type PlateOrder = {
  id: number;
  order_number: string;
  customer_name: string;
  plate_text: string;
  vehicle_label: string;
  notes: string | null;
  status: string;
  base_price: number;
  loyalty_tier_code: string | null;
  discount_percent: number;
  total: number;
  created_at: string;
};

export type LoyaltyAdminState = {
  configured: boolean;
  citizens: LoyaltyAdminCitizen[];
  tiers: LoyaltyTier[];
  plate_orders: PlateOrder[];
  plate_settings: {
    base_price: number;
    active: boolean;
  };
};

const emptyState: LoyaltyState = {
  configured: false,
  tier: null,
  preferences: {
    apply_catalog_discount: false,
    apply_plate_discount: false,
  },
  catalog_cart: {
    vehicle_subtotal: 0,
    delivery_subtotal: 0,
    discounted_vehicle_subtotal: 0,
    discount_percent: 0,
  },
  plate_settings: {
    base_price: 0,
    active: false,
  },
  plate_cart: null,
};

function numeric(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function parseTier(value: unknown): LoyaltyTier | null {
  if (!value || typeof value !== "object") return null;

  const row = value as Record<string, unknown>;
  const code = String(row.code ?? "");
  const label = String(row.label ?? "");

  if (!code || !label) return null;

  return {
    code,
    label,
    catalog_discount_percent: numeric(
      row.catalog_discount_percent,
    ),
    plate_discount_percent: numeric(
      row.plate_discount_percent,
    ),
    benefits: Array.isArray(row.benefits)
      ? row.benefits.map(String)
      : [],
    sort_order: numeric(row.sort_order),
  };
}

export async function getPublicLoyaltyTiers(): Promise<
  LoyaltyTier[]
> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("loyalty_tiers")
      .select(
        "code,label,catalog_discount_percent,plate_discount_percent,benefits,sort_order",
      )
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error || !data) return [];

    return data.flatMap((row: unknown) => {
      const tier = parseTier(row);
      return tier ? [tier] : [];
    });
  } catch {
    return [];
  }
}

export async function getMyLoyaltyState(): Promise<
  LoyaltyState
> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc(
      "nostra_current_loyalty_state",
    );

    if (error || !data || typeof data !== "object") {
      return emptyState;
    }

    const source = data as Record<string, unknown>;
    const preferences =
      source.preferences &&
      typeof source.preferences === "object"
        ? (source.preferences as Record<string, unknown>)
        : {};
    const cart =
      source.catalog_cart &&
      typeof source.catalog_cart === "object"
        ? (source.catalog_cart as Record<string, unknown>)
        : {};
    const settings =
      source.plate_settings &&
      typeof source.plate_settings === "object"
        ? (source.plate_settings as Record<string, unknown>)
        : {};
    const plateCart =
      source.plate_cart &&
      typeof source.plate_cart === "object"
        ? (source.plate_cart as Record<string, unknown>)
        : null;

    return {
      configured: source.configured === true,
      tier: parseTier(source.tier),
      preferences: {
        apply_catalog_discount:
          preferences.apply_catalog_discount === true,
        apply_plate_discount:
          preferences.apply_plate_discount === true,
      },
      catalog_cart: {
        vehicle_subtotal: numeric(cart.vehicle_subtotal),
        delivery_subtotal: numeric(cart.delivery_subtotal),
        discounted_vehicle_subtotal: numeric(
          cart.discounted_vehicle_subtotal,
        ),
        discount_percent: numeric(cart.discount_percent),
      },
      plate_settings: {
        base_price: numeric(settings.base_price),
        active: settings.active === true,
      },
      plate_cart: plateCart
        ? {
            plate_text: String(plateCart.plate_text ?? ""),
            vehicle_label: String(
              plateCart.vehicle_label ?? "",
            ),
            notes:
              typeof plateCart.notes === "string"
                ? plateCart.notes
                : null,
            base_price: numeric(plateCart.base_price),
          }
        : null,
    };
  } catch {
    return emptyState;
  }
}

export async function getLoyaltyAdminState(): Promise<
  LoyaltyAdminState
> {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any).rpc(
      "nostra_loyalty_admin_state",
    );

    if (error || !data || typeof data !== "object") {
      return {
        configured: false,
        citizens: [],
        tiers: [],
        plate_orders: [],
        plate_settings: {
          base_price: 0,
          active: false,
        },
      };
    }

    const source = data as Record<string, unknown>;
    const settings =
      source.plate_settings &&
      typeof source.plate_settings === "object"
        ? (source.plate_settings as Record<string, unknown>)
        : {};

    const tiers = Array.isArray(source.tiers)
      ? source.tiers.flatMap((value) => {
          const tier = parseTier(value);
          return tier ? [tier] : [];
        })
      : [];

    const citizens = Array.isArray(source.citizens)
      ? source.citizens.map((value) => {
          const row = value as Record<string, unknown>;

          return {
            user_id: String(row.user_id ?? ""),
            name: String(row.name ?? "Citoyen Nostra"),
            email:
              typeof row.email === "string"
                ? row.email
                : null,
            role:
              typeof row.role === "string"
                ? row.role
                : null,
            roles: Array.isArray(row.roles)
              ? row.roles.map(String)
              : null,
            tier_code:
              typeof row.tier_code === "string"
                ? row.tier_code
                : null,
            tier_label:
              typeof row.tier_label === "string"
                ? row.tier_label
                : null,
            assigned_at:
              typeof row.assigned_at === "string"
                ? row.assigned_at
                : null,
          };
        })
      : [];

    const plateOrders = Array.isArray(source.plate_orders)
      ? source.plate_orders.map((value) => {
          const row = value as Record<string, unknown>;

          return {
            id: numeric(row.id),
            order_number: String(row.order_number ?? ""),
            customer_name: String(row.customer_name ?? ""),
            plate_text: String(row.plate_text ?? ""),
            vehicle_label: String(row.vehicle_label ?? ""),
            notes:
              typeof row.notes === "string"
                ? row.notes
                : null,
            status: String(row.status ?? "pending"),
            base_price: numeric(row.base_price),
            loyalty_tier_code:
              typeof row.loyalty_tier_code === "string"
                ? row.loyalty_tier_code
                : null,
            discount_percent: numeric(
              row.discount_percent,
            ),
            total: numeric(row.total),
            created_at: String(row.created_at ?? ""),
          };
        })
      : [];

    return {
      configured: source.configured === true,
      citizens,
      tiers,
      plate_orders: plateOrders,
      plate_settings: {
        base_price: numeric(settings.base_price),
        active: settings.active === true,
      },
    };
  } catch {
    return {
      configured: false,
      citizens: [],
      tiers: [],
      plate_orders: [],
      plate_settings: {
        base_price: 0,
        active: false,
      },
    };
  }
}
