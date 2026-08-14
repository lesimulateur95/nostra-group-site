import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ urgence?: string; message?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  let message = params.message || "Le site Nostra Group est temporairement en maintenance.";
  let enabled = true;
  let direction = false;

  if (authData.user) {
    const [{ data: gate }, { data: isDirection }] = await Promise.all([
      supabase.rpc("nostra_security_gate", {
        p_path: "/maintenance",
        p_user_agent: null,
        p_ip_hash: null,
      }),
      supabase.rpc("nostra_security_is_direction", { p_user_id: authData.user.id }),
    ]);
    const payload = (gate ?? {}) as {
      maintenance_message?: string;
      maintenance_enabled?: boolean;
    };
    if (params.urgence !== "1") {
      message = payload.maintenance_message ?? message;
    }
    enabled = payload.maintenance_enabled ?? true;
    direction = Boolean(isDirection);
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.logo}>N</div>
        <span>NOSTRA GROUP</span>
        <h1>{params.urgence === "1" ? "Service temporairement suspendu" : enabled ? "Site en maintenance" : "Maintenance terminée"}</h1>
        <p>{params.urgence === "1" ? message : enabled ? message : "Le site est de nouveau accessible."}</p>
        <div className={styles.actions}>
          <Link href={enabled ? "/" : "/accueil"}>Réessayer</Link>
          {direction && <Link href="/dashboard/securite?onglet=maintenance">Ouvrir l’administration</Link>}
        </div>
      </section>
    </main>
  );
}
