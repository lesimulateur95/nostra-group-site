import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasRpProfile, isManager } from "@/lib/auth/user-profile";

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

  if (user && isDashboardPage && !isManager(user)) {
    const { data: profile } = await supabase
      .from("member_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const allowed = profile?.role === "manager";
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/accueil";
      return NextResponse.redirect(url);
    }
  }

  if (user && isCommissionerPage && !isManager(user)) {
    const { data: profile } = await supabase
      .from("member_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.role !== "commissioner") {
      const url = request.nextUrl.clone();
      url.pathname = "/accueil";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
