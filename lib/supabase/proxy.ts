import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasRpProfile, isManager } from "@/lib/auth/user-profile";

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
    direction: "manager",
  };

  return aliases[normalized] ?? normalized;
}

function normalizeRoles(
  roles: unknown,
  role: unknown,
): string[] {
  const values = Array.isArray(roles)
    ? roles.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  if (values.length > 0) {
    return [...new Set(values.map(normalizeRole))];
  }

  if (typeof role === "string") {
    return [normalizeRole(role)];
  }

  return ["citizen"];
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
  const isPublic = path === "/" || path.startsWith("/auth/");
  const isProfilePage = path === "/profil" || path.startsWith("/profil/");
  const isDashboardPage = path === "/dashboard" || path.startsWith("/dashboard/");
  const isCommissionerPage = path === "/commissaires" || path.startsWith("/commissaires/");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = hasRpProfile(user) ? "/accueil" : "/profil";
    return NextResponse.redirect(url);
  }

  if (user && !isPublic && !isProfilePage && !hasRpProfile(user)) {
    const url = request.nextUrl.clone();
    url.pathname = "/profil";
    url.searchParams.set("setup", "required");
    return NextResponse.redirect(url);
  }

  if (user && (isDashboardPage || isCommissionerPage) && !isManager(user)) {
    const { data: profile } = await supabase
      .from("member_profiles")
      .select("roles,role")
      .eq("user_id", user.id)
      .maybeSingle();
    const roles = normalizeRoles(profile?.roles, profile?.role);

    const dashboardRoles = [
      "manager",
      "commissioner",
      "employee",
      "commercial",
    ];

    if (
      isDashboardPage &&
      !roles.some((role) => dashboardRoles.includes(role))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/accueil";
      return NextResponse.redirect(url);
    }

    if (isCommissionerPage && !roles.includes("manager") && !roles.includes("commissioner")) {
      const url = request.nextUrl.clone();
      url.pathname = "/accueil";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
