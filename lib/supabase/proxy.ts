import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { hasRpProfile, isManager } from "@/lib/auth/user-profile";

type SecurityGatePayload = {
  roles?: string[];
  is_direction?: boolean;
  account_blocked?: boolean;
  blocked_until?: string | null;
  blocked_reason?: string | null;
  maintenance_enabled?: boolean;
  maintenance_message?: string | null;
  maintenance_bypass?: boolean;
  page_allowed?: boolean;
  matched_page?: string | null;
};

function normalizeRole(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const aliases: Record<string, string> = {
    member: "citizen",
    membre: "citizen",
    citoyen: "citizen",
    employe: "employee",
    staff: "employee",
    administrator: "employee",
    vendeur: "commercial",
    commissaire: "commissioner",
    gerant: "manager",
  };

  return aliases[normalized] ?? normalized;
}

function normalizeRoles(roles: unknown, role: unknown): string[] {
  const values = Array.isArray(roles)
    ? roles.filter((value): value is string => typeof value === "string")
    : [];

  if (values.length > 0) {
    return [...new Set(values.map(normalizeRole))];
  }

  if (typeof role === "string") {
    return [normalizeRole(role)];
  }

  return ["citizen"];
}

async function hashValue(value: string | null): Promise<string | null> {
  if (!value) return null;
  try {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

function redirectTo(request: NextRequest, pathname: string, params?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  const isPublic =
    path === "/" ||
    path.startsWith("/auth/") ||
    path === "/maintenance" ||
    path === "/compte-bloque";
  const isProfilePage = path === "/profil" || path.startsWith("/profil/");
  const isDashboardPage = path === "/dashboard" || path.startsWith("/dashboard/");
  const isCommissionerPage = path === "/commissaires" || path.startsWith("/commissaires/");

  if (!user && !isPublic) {
    return isApi
      ? NextResponse.json({ error: "Connexion requise" }, { status: 401 })
      : redirectTo(request, "/");
  }

  if (user && path === "/") {
    return redirectTo(request, hasRpProfile(user) ? "/accueil" : "/profil");
  }

  let securityGate: SecurityGatePayload | null = null;

  if (user && !isPublic) {
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ipHash = await hashValue(forwardedFor);
    const gateResult = await supabase.rpc("nostra_security_gate", {
      p_path: path,
      p_user_agent: request.headers.get("user-agent"),
      p_ip_hash: ipHash,
    });

    if (!gateResult.error && gateResult.data && typeof gateResult.data === "object") {
      securityGate = gateResult.data as SecurityGatePayload;

      if (securityGate.account_blocked) {
        if (isApi) {
          return NextResponse.json(
            {
              error: "Compte temporairement bloqué",
              reason: securityGate.blocked_reason,
              until: securityGate.blocked_until,
            },
            { status: 403 },
          );
        }
        return redirectTo(request, "/compte-bloque", {
          reason: securityGate.blocked_reason ?? "Blocage temporaire",
          until: securityGate.blocked_until ?? "",
        });
      }

      if (securityGate.maintenance_enabled && !securityGate.maintenance_bypass) {
        if (isApi) {
          return NextResponse.json(
            { error: securityGate.maintenance_message ?? "Site en maintenance" },
            { status: 503 },
          );
        }
        return redirectTo(request, "/maintenance");
      }

      if (securityGate.page_allowed === false) {
        if (isApi) {
          return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
        return redirectTo(request, "/accueil", {
          acces: "refuse",
          page: securityGate.matched_page ?? "Page protégée",
        });
      }
    }
  }

  if (user && !isPublic && !isProfilePage && !hasRpProfile(user)) {
    const url = request.nextUrl.clone();
    url.pathname = "/profil";
    url.searchParams.set("setup", "required");
    return NextResponse.redirect(url);
  }

  // Les anciens contrôles statiques restent uniquement comme secours tant que V64
  // n’est pas installée. Une fois le centre actif, la matrice du Dashboard fait foi.
  if (
    user &&
    securityGate === null &&
    (isDashboardPage || isCommissionerPage) &&
    !isManager(user)
  ) {
    let roles = securityGate?.roles?.map(normalizeRole) ?? [];

    if (roles.length === 0) {
      const rpcResult = await supabase.rpc("nostra_roles");
      roles = !rpcResult.error
        ? normalizeRoles(rpcResult.data, null)
        : ["citizen"];

      if (rpcResult.error) {
        const { data: profile } = await supabase
          .from("member_profiles")
          .select("roles,role")
          .eq("user_id", user.id)
          .maybeSingle();
        roles = normalizeRoles(profile?.roles, profile?.role);
      }
    }

    const dashboardRoles = [
      "direction",
      "manager",
      "commissioner",
      "employee",
      "commercial",
    ];

    if (isDashboardPage && !roles.some((role) => dashboardRoles.includes(role))) {
      return redirectTo(request, "/accueil");
    }

    if (
      isCommissionerPage &&
      !roles.includes("direction") &&
      !roles.includes("manager") &&
      !roles.includes("commissioner")
    ) {
      return redirectTo(request, "/accueil");
    }
  }

  return response;
}
