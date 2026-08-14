import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { hasRpProfile, isManager } from "@/lib/auth/user-profile";

type V156GatePayload = { configured?: boolean; allowed?: boolean; blocked?: boolean; reason?: string | null; until?: string | null; scope?: string | null; message?: string | null; matched_page?: string | null };

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

const OPERATIONS_DASHBOARD_PREFIXES = [
  "/dashboard/catalogue",
  "/dashboard/commandes",
  "/dashboard/livraisons",
  "/dashboard/rendez-vous-motors",
  "/dashboard/stocks",
  "/dashboard/reservations",
  "/dashboard/homologations",
  "/dashboard/inscriptions-ecuries",
  "/dashboard/championnats",
] as const;

function isOperationsDashboardPath(pathname: string): boolean {
  return OPERATIONS_DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

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

function hasOperationsRole(roles: string[]): boolean {
  return roles.some((role) => ["employee", "commercial", "manager"].includes(role));
}

function hasCompletedRpNames(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false;
  const row = profile as Record<string, unknown>;
  const firstName = typeof row.rp_first_name === "string" ? row.rp_first_name.trim() : "";
  const lastName = typeof row.rp_last_name === "string" ? row.rp_last_name.trim() : "";
  return firstName.length >= 2 && lastName.length >= 2;
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

function redirectTo(
  request: NextRequest,
  pathname: string,
  params?: Record<string, string>,
) {
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
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
  const isRaceControlApi = path.startsWith("/api/race-control/");
  const isPublic =
    path === "/" ||
    path.startsWith("/auth/") ||
    path === "/verification" ||
    path.startsWith("/verification/") ||
    path === "/maintenance" ||
    path === "/compte-bloque" ||
    path === "/compte-supprime" ||
    path === "/acces-restreint";
  // Un compte incomplet peut uniquement ouvrir la page principale du profil
  // afin d'enregistrer prénom + nom. Les sous-pages du profil restent bloquées.
  const isProfileSetupPage = path === "/profil";
  const isDashboardPage = path === "/dashboard" || path.startsWith("/dashboard/");
  const isCommissionerPage =
    path === "/commissaires" || path.startsWith("/commissaires/");

  if (!user && !isPublic) {
    return isApi
      ? NextResponse.json({ error: "Connexion requise" }, { status: 401 })
      : redirectTo(request, "/");
  }

  let profileComplete = hasRpProfile(user);
  if (user && !profileComplete) {
    const { data: memberProfile } = await supabase
      .from("member_profiles")
      .select("rp_first_name,rp_last_name")
      .eq("user_id", user.id)
      .maybeSingle();
    profileComplete = hasCompletedRpNames(memberProfile);
  }

  if (user && path === "/") {
    return redirectTo(request, profileComplete ? "/accueil" : "/profil", profileComplete ? undefined : { setup: "required" });
  }

  let securityGate: SecurityGatePayload | null = null;

  if (user && !isPublic) {
    const forwardedFor =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ipHash = await hashValue(forwardedFor);
    const [gateResult, customGateResult, blacklistResult, emergencyResult] = await Promise.all([
      supabase.rpc("nostra_security_gate", {
        p_path: path,
        p_user_agent: request.headers.get("user-agent"),
        p_ip_hash: ipHash,
      }),
      (supabase as any).rpc("nostra_custom_access_gate_v156", { p_path: path }),
      (supabase as any).rpc("nostra_blacklist_gate_v156", { p_path: path }),
      (supabase as any).rpc("nostra_emergency_gate_v156", { p_path: path }),
    ]);

    const customGate = !customGateResult.error && customGateResult.data && typeof customGateResult.data === "object" ? customGateResult.data as V156GatePayload : null;
    const blacklistGate = !blacklistResult.error && blacklistResult.data && typeof blacklistResult.data === "object" ? blacklistResult.data as V156GatePayload : null;
    const emergencyGate = !emergencyResult.error && emergencyResult.data && typeof emergencyResult.data === "object" ? emergencyResult.data as V156GatePayload : null;

    if (blacklistGate?.blocked) {
      if (isApi) return NextResponse.json({ error: "Accès restreint", reason: blacklistGate.reason, scope: blacklistGate.scope, until: blacklistGate.until }, { status: 403 });
      return redirectTo(request, "/acces-restreint", {
        reason: blacklistGate.reason ?? "Accès temporairement restreint",
        scope: blacklistGate.scope ?? "all",
        until: blacklistGate.until ?? "",
      });
    }

    if (emergencyGate?.blocked) {
      if (isApi) return NextResponse.json({ error: emergencyGate.message ?? "Service temporairement indisponible" }, { status: 503 });
      return redirectTo(request, "/maintenance", { urgence: "1", message: emergencyGate.message ?? "Mode urgence Nostra" });
    }

    if (
      !gateResult.error &&
      gateResult.data &&
      typeof gateResult.data === "object"
    ) {
      securityGate = gateResult.data as SecurityGatePayload;

      // Les permissions des rôles personnalisés sont réellement restrictives :
      // lorsqu'une page est configurée pour ces rôles, être rattaché à un rôle
      // non autorisé ne doit pas hériter automatiquement de toutes les pages de
      // son rôle de base. La Direction conserve toujours son accès de secours.
      if (
        customGate?.configured === true &&
        customGate.allowed === false &&
        securityGate.is_direction !== true
      ) {
        if (isApi) {
          return NextResponse.json({ error: "Accès refusé pour ce rôle" }, { status: 403 });
        }
        return redirectTo(request, "/accueil", {
          acces: "refuse",
          page: customGate.matched_page ?? "Page protégée",
        });
      }

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

      if (
        securityGate.maintenance_enabled &&
        !securityGate.maintenance_bypass
      ) {
        if (isApi) {
          return NextResponse.json(
            {
              error:
                securityGate.maintenance_message ?? "Site en maintenance",
            },
            { status: 503 },
          );
        }

        return redirectTo(request, "/maintenance");
      }

      if (securityGate.page_allowed === false && customGate?.allowed !== true) {
        let resolvedRoles = normalizeRoles(securityGate.roles, null);

        // La matrice Supabase peut encore contenir les anciens réglages.
        // Pour les seules pages opérationnelles demandées, on vérifie le rôle
        // réel avant de refuser l'accès.
        const needsOperationsRole =
          isOperationsDashboardPath(path) &&
          !hasOperationsRole(resolvedRoles);
        const needsCommissionerRole =
          isRaceControlApi &&
          !resolvedRoles.some((role) =>
            ["manager", "commissioner"].includes(role),
          );

        if (needsOperationsRole || needsCommissionerRole) {
          const rpcResult = await supabase.rpc("nostra_roles");
          if (!rpcResult.error) {
            resolvedRoles = normalizeRoles(rpcResult.data, null);
          }
        }

        const operationsOverride =
          isOperationsDashboardPath(path) && hasOperationsRole(resolvedRoles);
        const raceControlOverride =
          isRaceControlApi &&
          resolvedRoles.some((role) =>
            ["manager", "commissioner"].includes(role),
          );

        if (!operationsOverride && !raceControlOverride) {
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
  }

  if (user && !isPublic && !isProfileSetupPage && !profileComplete) {
    if (isApi) {
      return NextResponse.json(
        { error: "Merci de remplir vos informations personnelles dans votre profil.", code: "profile_required" },
        { status: 403 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/profil";
    url.searchParams.set("setup", "required");
    return NextResponse.redirect(url);
  }

  // Secours tant que la matrice Supabase n'est pas disponible.
  if (
    user &&
    securityGate === null &&
    (isDashboardPage || isCommissionerPage) &&
    !isManager(user)
  ) {
    let roles: string[] = [];

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

    const dashboardRoles = [
      "direction",
      "manager",
      "commissioner",
      "employee",
      "commercial",
    ];

    if (
      isDashboardPage &&
      !roles.some((role) => dashboardRoles.includes(role))
    ) {
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
