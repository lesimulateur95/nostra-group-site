import { NextResponse } from "next/server";
import {
  getAvatarUrl,
  getDiscordId,
  getDiscordName,
  hasRpProfile,
} from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let destination = "/accueil";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (user) {
      const metadata = user.user_metadata ?? {};
      await supabase.from("member_profiles").upsert({
        user_id: user.id,
        discord_id: getDiscordId(user),
        discord_name: getDiscordName(user),
        email: user.email ?? null,
        avatar_url: getAvatarUrl(user),
        rp_first_name: typeof metadata.rp_first_name === "string" ? metadata.rp_first_name : null,
        rp_last_name: typeof metadata.rp_last_name === "string" ? metadata.rp_last_name : null,
        role: getDiscordId(user) === "331843410962939908" ? "manager" : undefined,
        roles: getDiscordId(user) === "331843410962939908" ? ["manager"] : undefined,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    destination = hasRpProfile(user) ? "/accueil" : "/profil";
  }

  return NextResponse.redirect(new URL(destination, request.url));
}
