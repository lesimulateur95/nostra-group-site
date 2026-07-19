import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { getOwnWheelSpins, getWheelModuleConfigured } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabels: Record<string, string> = {
  unused: "À utiliser",
  used: "Utilisé",
  lost: "Perdu",
};

export default async function ProfileGamesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const configured = await getWheelModuleConfigured();
  const spins = configured ? await getOwnWheelSpins(data.user.id) : [];
  const available = spins.filter((spin) => spin.redemption_status === "unused").length;
  const used = spins.filter((spin) => spin.redemption_status === "used").length;

  return (
    <>
      <ProfileSectionHeader eyebrow="JEUX NOSTRA GROUP" title="Mes bonus & résultats" description="Retrouve ici tous les résultats obtenus à la Roue de la chance et le statut de chaque gain." />

      {!configured && <div className="dashboard-feedback">La Roue de la chance n’est pas encore activée par le Gérant.</div>}

      {configured && (
        <>
          <section className="profile-games-kpis">
            <article><span>Tirages</span><strong>{spins.length}</strong></article>
            <article><span>Bonus disponibles</span><strong>{available}</strong></article>
            <article><span>Bonus utilisés</span><strong>{used}</strong></article>
          </section>

          <section className="profile-data-section profile-standalone-section">
            <div className="profile-data-heading"><div><p className="eyebrow">HISTORIQUE</p><h2>Roue de la chance</h2></div><Link href="/evenements/roue-de-la-chance">Tourner la roue →</Link></div>
            <div className="profile-game-list">
              {spins.length === 0 && <p className="empty-state">Tu n’as encore effectué aucun tirage.</p>}
              {spins.map((spin) => (
                <article className={`profile-game-row profile-game-row-${spin.redemption_status}`} key={spin.id}>
                  <span className="profile-game-icon">{spin.prize_type === "loss" ? "✕" : "◆"}</span>
                  <div><small>{new Date(spin.awarded_at).toLocaleString("fr-FR")}</small><strong>{spin.prize_label}</strong></div>
                  <span className={`wheel-gain-status wheel-gain-status-${spin.redemption_status}`}>{statusLabels[spin.redemption_status] ?? spin.redemption_status}</span>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
