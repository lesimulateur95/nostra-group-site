import Link from "next/link";

import {
  clearTestDocumentsV88,
  deletePastFortuneGameV88,
  resetDocumentCounterV88,
  resetGameDataV88,
} from "@/app/actions/test-reset-v88";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/server";

import styles from "./remise-a-zero.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{
  success?: string | string[];
  error?: string | string[];
}>;

type UnknownRecord = Record<string, unknown>;

type Overview = {
  counts: Record<string, number>;
  past_fortune_games: UnknownRecord[];
  logs: UnknownRecord[];
};

const EMPTY_OVERVIEW: Overview = {
  counts: {},
  past_fortune_games: [],
  logs: [],
};

const GAME_MODULES = [
  {
    scope: "fortune",
    icon: "🎡",
    title: "Roue de la Fortune",
    description:
      "Supprime les parties, joueurs, manches et historique. La roue et la banque d’énigmes restent configurées.",
    countKey: "fortune",
  },
  {
    scope: "daily_wheel",
    icon: "🎟️",
    title: "Roue de la chance",
    description:
      "Efface tous les tirages quotidiens et les récompenses de test enregistrées dans les profils.",
    countKey: "daily_wheel",
  },
  {
    scope: "deal",
    icon: "📦",
    title: "À prendre ou à laisser",
    description:
      "Supprime les éditions, participants, boîtes, offres et résultats enregistrés pendant les tests.",
    countKey: "deal",
  },
  {
    scope: "treasure",
    icon: "🗺️",
    title: "Chasse au trésor",
    description:
      "Supprime les chasses, indices et images envoyées. Le réglage d’activation du jeu reste présent.",
    countKey: "treasure",
  },
  {
    scope: "bingo",
    icon: "🔢",
    title: "Bingo",
    description:
      "Efface achats, cartons, tirages et gagnants, puis recrée une manche vide avec le même titre et le même prix.",
    countKey: "bingo",
  },
  {
    scope: "tombola",
    icon: "🏆",
    title: "Tombola",
    description:
      "Efface paniers, achats, tickets et gagnants, puis recrée une tombola vide avec le même titre et le même prix.",
    countKey: "tombola",
  },
] as const;

const SUCCESS_MESSAGES: Record<string, string> = {
  "fortune-game-deleted": "La partie de la Roue de la Fortune a été supprimée.",
  "document-counter-reset": "Le compteur des factures est reparti au début.",
  "test-documents-cleared":
    "Les documents de test ont été supprimés et leurs compteurs ont été remis au début.",
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function list(value: unknown): UnknownRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is UnknownRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "Date inconnue";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

function formatMoney(value: unknown): string {
  return `${numberValue(value).toLocaleString("fr-FR")} €`;
}

function successMessage(code: string): string {
  if (SUCCESS_MESSAGES[code]) return SUCCESS_MESSAGES[code];
  if (code.startsWith("game-reset-")) {
    return code === "game-reset-all"
      ? "Tous les jeux ont été remis à zéro."
      : "Le jeu sélectionné a été remis à zéro.";
  }
  return "Action terminée.";
}

async function getOverview(): Promise<{
  overview: Overview;
  setupError: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc(
    "nostra_test_reset_overview_v88",
  );

  if (error) {
    return {
      overview: EMPTY_OVERVIEW,
      setupError: error.message || "Le module V88 n’est pas installé.",
    };
  }

  const root = record(data);
  const countsRaw = record(root.counts);
  const counts = Object.fromEntries(
    Object.entries(countsRaw).map(([key, value]) => [key, numberValue(value)]),
  );

  return {
    overview: {
      counts,
      past_fortune_games: list(root.past_fortune_games),
      logs: list(root.logs),
    },
    setupError: null,
  };
}

async function ResetDashboardContent({ searchParams }: { searchParams: SearchParams }) {
  const [{ overview, setupError }, params] = await Promise.all([
    getOverview(),
    searchParams,
  ]);
  const success = firstValue(params.success);
  const error = firstValue(params.error);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>DIRECTION · DONNÉES DE TEST</span>
          <h1>Remise à zéro avant l’ouverture</h1>
          <p>
            Nettoie uniquement les essais des jeux et des documents. Les citoyens,
            rôles, catalogues, véhicules, commandes et réglages du site ne sont pas
            supprimés.
          </p>
        </div>
        <div className={styles.heroLinks}>
          <Link href="/dashboard">Retour au Dashboard</Link>
          <Link href="/dashboard/systeme">Centre système</Link>
        </div>
      </header>

      {success ? (
        <div className={styles.successBanner}>{successMessage(success)}</div>
      ) : null}
      {error ? <div className={styles.errorBanner}>{error}</div> : null}
      {setupError ? (
        <div className={styles.setupBanner}>
          <strong>Installation SQL nécessaire</strong>
          <span>{setupError}</span>
          <code>supabase/test-reset-v88.sql</code>
        </div>
      ) : null}

      <section className={styles.warning}>
        <div className={styles.warningIcon}>!</div>
        <div>
          <strong>Zone destructive réservée au Gérant</strong>
          <p>
            Chaque action demande une phrase précise. Une remise à zéro ne peut pas
            être annulée depuis le site. Fais-la uniquement quand tu as terminé les
            tests.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <span>ROUE DE LA FORTUNE</span>
            <h2>Supprimer une ancienne partie</h2>
          </div>
          <span className={styles.counter}>
            {overview.past_fortune_games.length} affichée(s)
          </span>
        </header>

        {overview.past_fortune_games.length > 0 ? (
          <div className={styles.historyList}>
            {overview.past_fortune_games.map((game, index) => {
              const gameId = stringValue(game.game_id ?? game.id, `partie-${index + 1}`);
              const winner = stringValue(game.winner_name, "Aucun gagnant enregistré");
              const status = stringValue(game.status, "terminée");
              const finishedAt = game.finished_at ?? game.updated_at ?? game.created_at;

              return (
                <article className={styles.historyCard} key={`${gameId}-${index}`}>
                  <div className={styles.historyInfo}>
                    <div className={styles.historyTopline}>
                      <strong>Partie {gameId.slice(0, 12)}</strong>
                      <span>{status}</span>
                    </div>
                    <p>
                      Gagnant : <b>{winner}</b> · Gain : {formatMoney(game.total_prize ?? game.final_prize_value)}
                    </p>
                    <small>{formatDate(finishedAt)}</small>
                  </div>

                  <form action={deletePastFortuneGameV88} className={styles.inlineDangerForm}>
                    <input type="hidden" name="game_id" value={gameId} />
                    <label>
                      Écris <b>SUPPRIMER PARTIE</b>
                      <input
                        name="confirmation"
                        autoComplete="off"
                        placeholder="SUPPRIMER PARTIE"
                        required
                      />
                    </label>
                    <button type="submit" disabled={Boolean(setupError)}>
                      Supprimer
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            Aucune ancienne partie enregistrée dans l’historique.
          </div>
        )}
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <span>JEUX</span>
            <h2>Remise à zéro séparée</h2>
          </div>
          <p>Les paramètres utiles sont conservés lorsque c’est possible.</p>
        </header>

        <div className={styles.moduleGrid}>
          {GAME_MODULES.map((module) => (
            <article className={styles.moduleCard} key={module.scope}>
              <div className={styles.moduleHeading}>
                <span className={styles.moduleIcon}>{module.icon}</span>
                <div>
                  <h3>{module.title}</h3>
                  <span>{overview.counts[module.countKey] ?? 0} ligne(s) principale(s)</span>
                </div>
              </div>
              <p>{module.description}</p>
              <form action={resetGameDataV88} className={styles.resetForm}>
                <input type="hidden" name="scope" value={module.scope} />
                <label>
                  Confirmation : <b>REMETTRE A ZERO</b>
                  <input
                    name="confirmation"
                    autoComplete="off"
                    placeholder="REMETTRE A ZERO"
                    required
                  />
                </label>
                <button type="submit" disabled={Boolean(setupError)}>
                  Remettre ce jeu à zéro
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.documentSection}`}>
        <header className={styles.sectionHeader}>
          <div>
            <span>DOCUMENTS</span>
            <h2>Compteurs et documents de test</h2>
          </div>
          <div className={styles.countPair}>
            <span>{overview.counts.invoices ?? 0} facture(s)</span>
            <span>{overview.counts.document_registry ?? 0} entrée(s) registre</span>
          </div>
        </header>

        <div className={styles.documentGrid}>
          <article className={styles.documentCard}>
            <h3>Remettre seulement le compteur à zéro</h3>
            <p>
              À utiliser après avoir supprimé toutes les factures. Si une facture
              existe encore, l’action est refusée pour éviter un numéro en double.
              Les autres entrées du registre restent intactes.
            </p>
            <form action={resetDocumentCounterV88} className={styles.resetForm}>
              <label>
                Confirmation : <b>COMPTEUR DOCUMENTS</b>
                <input
                  name="confirmation"
                  autoComplete="off"
                  placeholder="COMPTEUR DOCUMENTS"
                  required
                />
              </label>
              <button type="submit" disabled={Boolean(setupError)}>
                Remettre le compteur au début
              </button>
            </form>
          </article>

          <article className={`${styles.documentCard} ${styles.dangerCard}`}>
            <h3>Supprimer tous les documents de test</h3>
            <p>
              Efface les factures, le registre documentaire et les signatures, puis
              remet les compteurs au début. Les comptes citoyens, commandes, licences
              sources et véhicules ne sont pas supprimés.
            </p>
            <form action={clearTestDocumentsV88} className={styles.resetForm}>
              <label>
                Confirmation : <b>SUPPRIMER DOCUMENTS TEST</b>
                <input
                  name="confirmation"
                  autoComplete="off"
                  placeholder="SUPPRIMER DOCUMENTS TEST"
                  required
                />
              </label>
              <button type="submit" disabled={Boolean(setupError)}>
                Tout vider et remettre à zéro
              </button>
            </form>
          </article>
        </div>
      </section>

      <section className={styles.globalReset}>
        <div>
          <span>OUVERTURE DU SERVEUR</span>
          <h2>Remettre tous les jeux à zéro</h2>
          <p>
            Efface en une seule action toutes les parties et données de test des six
            jeux ci-dessus. Cette action ne touche pas aux documents : ils disposent
            de leur propre commande séparée.
          </p>
        </div>
        <form action={resetGameDataV88} className={styles.globalForm}>
          <input type="hidden" name="scope" value="all" />
          <label>
            Écris exactement <b>TOUT REMETTRE A ZERO</b>
            <input
              name="confirmation"
              autoComplete="off"
              placeholder="TOUT REMETTRE A ZERO"
              required
            />
          </label>
          <button type="submit" disabled={Boolean(setupError)}>
            Remettre tous les jeux à zéro
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <span>TRAÇABILITÉ</span>
            <h2>Dernières remises à zéro</h2>
          </div>
        </header>

        {overview.logs.length > 0 ? (
          <div className={styles.logList}>
            {overview.logs.map((log, index) => (
              <div className={styles.logRow} key={stringValue(log.id, `log-${index}`)}>
                <div>
                  <strong>{stringValue(log.action_key)}</strong>
                  <span>{stringValue(log.scope_key)}</span>
                </div>
                <time>{formatDate(log.created_at)}</time>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>Aucune remise à zéro enregistrée.</div>
        )}
      </section>
    </main>
  );
}

export default function TestResetDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <DashboardShell allowedRoles={["manager"]}>
      <ResetDashboardContent searchParams={searchParams} />
    </DashboardShell>
  );
}
