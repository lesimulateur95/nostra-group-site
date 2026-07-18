import { NextResponse } from "next/server";
import { hasRpProfile } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let destination = "/accueil";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
    const { data } = await supabase.auth.getUser();
    destination = hasRpProfile(data.user) ? "/accueil" : "/profil";
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
