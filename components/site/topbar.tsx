import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { getRpName, getSiteRole, isManager } from "@/lib/auth/user-profile";
import { createClient } from "@/lib/supabase/server";

export async function Topbar() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const rpName = getRpName(user);
  const role = getSiteRole(user);
  const manager = isManager(user);

  return (
    <header className="topbar">
      <Link href="/accueil" className="brand-mini">
        <span className="brand-mark">N</span>
        <span>NOSTRA GROUP</span>
      </Link>
      <div className="top-actions">
        {rpName && <span className="top-identity"><strong>{rpName}</strong><small>{role}</small></span>}
        <Link href="/accueil" className="top-link">Accueil</Link>
        <Link href="/profil" className="top-link">Mon profil</Link>
        {manager && <Link href="/dashboard" className="top-link top-link-gold">Dashboard</Link>}
        <form action={signOut}>
          <button className="logout" type="submit">Déconnexion</button>
        </form>
      </div>
    </header>
  );
}
