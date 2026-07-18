import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginButton } from "@/components/auth/login-button";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) redirect("/accueil");

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-label="Connexion Nostra Group">
        <div className="auth-logos">
          <Image className="auth-logo" src="/universe-life.svg" alt="Universe Life" width={420} height={130} priority />
          <Image className="auth-logo" src="/nostra-group.svg" alt="Nostra Group" width={420} height={130} priority />
        </div>
        <div className="auth-actions">
          <LoginButton />
        </div>
      </section>
    </main>
  );
}
