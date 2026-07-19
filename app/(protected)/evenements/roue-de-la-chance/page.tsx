import Link from "next/link";
import { redirect } from "next/navigation";
import { WheelGame } from "@/components/games/wheel-game";
import { EditablePage } from "@/components/site/editable-page";
import { getOwnWheelSpins, getWheelModuleConfigured } from "@/lib/backoffice/data";
import { WHEEL_PRIZE_SUMMARY } from "@/lib/games/wheel-config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;


function parisDayKey(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

export default async function WheelPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");

  const configured = await getWheelModuleConfigured();
  const allOwnSpins = configured ? await getOwnWheelSpins(data.user.id) : [];
  const recent = allOwnSpins.slice(0, 5);
  const todayInFrance = parisDayKey(new Date());
  const alreadySpunToday = allOwnSpins.some((spin) => parisDayKey(spin.awarded_at) === todayInFrance);

  const intro = (
    <article className="circuit-document wheel-intro-document">
      <header className="document-hero">
        <p className="eyebrow">JEUX NOSTRA GROUP</p>
        <h1 className="page-title">Roue de la chance</h1>
        <p className="lead">Lance un tirage parmi 23 cases. Le résultat est enregistré automatiquement dans ton espace Jeux.</p>
      </header>
    </article>
  );

  return (
    <>
      <EditablePage slug="evenements-roue" eyebrow="Événements & Jeux" defaultTitle="Roue de la chance">{intro}</EditablePage>
      <WheelGame configured={configured} alreadySpunToday={alreadySpunToday} />

      <section className="wheel-information-grid">
        <article className="backoffice-panel wheel-prize-panel">
          <div className="panel-heading"><span className="panel-icon">◆</span><div><h2>Répartition des 23 cases</h2><p>Tous les gains et cases Perdu présents sur la roue.</p></div></div>
          <div className="wheel-prize-list">
            {WHEEL_PRIZE_SUMMARY.map((prize) => <div key={prize.label}><span>{prize.label}</span><strong>{prize.count} case{prize.count > 1 ? "s" : ""}</strong></div>)}
          </div>
        </article>

        <article className="backoffice-panel wheel-recent-panel">
          <div className="panel-heading"><span className="panel-icon">↻</span><div><h2>Mes derniers tirages</h2><p>Les cinq résultats les plus récents.</p></div></div>
          <div className="wheel-recent-list">
            {!configured && <p className="empty-state">La roue doit être activée depuis le Dashboard.</p>}
            {configured && recent.length === 0 && <p className="empty-state">Tu n’as encore effectué aucun tirage.</p>}
            {recent.map((spin) => (
              <div key={spin.id} className={spin.prize_type === "loss" ? "wheel-history-loss" : "wheel-history-win"}>
                <span>{new Date(spin.awarded_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <strong>{spin.prize_label}</strong>
                <small>{spin.redemption_status === "used" ? "Utilisé" : spin.redemption_status === "lost" ? "Perdu" : "À utiliser"}</small>
              </div>
            ))}
          </div>
          <Link href="/profil/jeux" className="text-link wheel-profile-link">Voir tout mon historique →</Link>
        </article>
      </section>
    </>
  );
}
